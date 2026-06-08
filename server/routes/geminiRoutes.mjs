import { GoogleGenAI, Type, Modality } from '@google/genai';
import { getBillingContext, hasPlatformProvider, getPlatformProvider, recordUsage, calcImageCost, imageCostEntry, textCostEntry, IMAGEN_COST_USD, USD_TO_BRL } from '../billing.mjs';
import { publicUser, getUserById, getScriptSceneLimit } from '../auth.mjs';
import { enforceAspectRatio, isSupportedAspectRatio } from '../imageProcessing.mjs';
import {
  buildStoryboardStructurePrompt,
  buildSceneAnalysisPrompt,
  DEFAULT_STORYBOARD_STRUCTURE_CONFIG,
  DEFAULT_SCENE_ANALYSIS_CONFIG,
} from '../promptConfig.mjs';

// ── Gemini helpers ────────────────────────────────────────────────────────────
const getAiClient = (req) => {
  const ctx = getBillingContext(req);
  if (ctx.vertex?.apiKey) {
    return new GoogleGenAI({ vertexai: true, apiKey: ctx.vertex.apiKey });
  }
  if (ctx.vertex) {
    return new GoogleGenAI({ vertexai: true, project: ctx.vertex.project, location: ctx.vertex.location });
  }
  return new GoogleGenAI({ apiKey: ctx.apiKey });
};

const normalizeGeneratedImage = async (result, aspectRatio, mode = 'cover') => {
  if (!isSupportedAspectRatio(aspectRatio)) return result;
  try {
    const normalized = await enforceAspectRatio({
      base64Data: result.base64Data,
      mimeType: result.mimeType,
      aspectRatio,
      mode,
    });
    return { ...result, ...normalized };
  } catch (error) {
    console.warn('[Image Processing] Falha ao normalizar aspect ratio:', error?.message || error);
    return result;
  }
};

const promptJsonSchema = {
  type: Type.OBJECT,
  properties: {
    scene_goal: { type: Type.STRING },
    visual_style: {
      type: Type.OBJECT,
      properties: {
        style_family: { type: Type.STRING },
        medium: { type: Type.STRING },
        realism_level: { type: Type.STRING },
        style_rules: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
    },
    action: {
      type: Type.OBJECT,
      properties: {
        main_action: { type: Type.STRING },
        subject_relationship: { type: Type.STRING },
        emotional_state: { type: Type.STRING },
      },
    },
    camera: {
      type: Type.OBJECT,
      properties: {
        scene_type: { type: Type.STRING },
        shot_type: { type: Type.STRING },
        angle: { type: Type.STRING },
        lens: { type: Type.STRING },
        framing: { type: Type.STRING },
        depth_of_field: { type: Type.STRING },
      },
    },
    characters: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          role_in_frame: { type: Type.STRING },
          visual_continuity: { type: Type.STRING },
        },
      },
    },
    environment: {
      type: Type.OBJECT,
      properties: {
        location: { type: Type.STRING },
        time_of_day: { type: Type.STRING },
        set_design: { type: Type.STRING },
        atmosphere: { type: Type.STRING },
      },
    },
    lighting: {
      type: Type.OBJECT,
      properties: {
        key_light: { type: Type.STRING },
        fill_light: { type: Type.STRING },
        contrast: { type: Type.STRING },
        color_temperature: { type: Type.STRING },
      },
    },
    color_texture: {
      type: Type.OBJECT,
      properties: {
        palette: { type: Type.STRING },
        texture: { type: Type.STRING },
        finishing: { type: Type.STRING },
      },
    },
    lettering: {
      type: Type.OBJECT,
      properties: {
        has_text: { type: Type.BOOLEAN },
        exact_text: { type: Type.STRING },
        language: { type: Type.STRING, description: 'Idioma do texto literal (ex.: "Portuguese (pt-BR)", "English"). Obrigatório quando has_text=true e o texto não é inglês — modelos de imagem corrompem acentos sem essa dica.' },
        placement: { type: Type.STRING },
        text_rules: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
    },
    required_elements: { type: Type.ARRAY, items: { type: Type.STRING } },
    negative_constraints: { type: Type.ARRAY, items: { type: Type.STRING } },
    output: {
      type: Type.OBJECT,
      properties: {
        aspect_ratio_hint: { type: Type.STRING },
        quality: { type: Type.STRING },
      },
    },
  },
};

const normalizeSceneAnalysisResult = (parsed) => {
  if (!parsed || typeof parsed !== 'object') return parsed;
  if (parsed.prompt_json && typeof parsed.prompt_json === 'object') {
    return {
      ...parsed,
      image_prompt: JSON.stringify(parsed.prompt_json, null, 2),
    };
  }
  return parsed;
};

const parseGeminiErrorPayload = (errorMessage) => {
  const match = String(errorMessage || '').match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
};

const normalizeGeminiError = (error) => {
  const rawMessage = error?.message || String(error);
  const payload = parseGeminiErrorPayload(rawMessage);
  const upstream = payload?.error || {};
  const status = Number(error?.status || error?.statusCode || upstream?.code) || 500;
  const code = upstream?.status || error?.code || '';
  const message = upstream?.message || rawMessage;
  const combined = `${status} ${code} ${message}`;

  if (
    status === 403 ||
    code === 'PERMISSION_DENIED' ||
    /denied access|permission_denied|permission denied/i.test(combined)
  ) {
    const friendly = new Error(
      'A API Gemini recusou o acesso deste projeto/API key (403 PERMISSION_DENIED). ' +
      'Troque a API key ou confira no Google AI Studio/Google Cloud se o projeto está liberado, com a API/modelo habilitado e faturamento/permissões válidos.'
    );
    friendly.status = 403;
    friendly.code = 'GEMINI_PERMISSION_DENIED';
    return friendly;
  }

  if (
    status === 401 ||
    code === 'UNAUTHENTICATED' ||
    /api_key_invalid|unauthenticated|invalid api key/i.test(combined)
  ) {
    const friendly = new Error(
      'A API key Gemini parece inválida ou expirada. Verifique a chave salva nas configurações e tente novamente.'
    );
    friendly.status = 401;
    friendly.code = 'GEMINI_API_KEY_INVALID';
    return friendly;
  }

  return error;
};

const callGeminiWithRetry = async (apiCall, maxRetries = 10, initialDelay = 5000) => {
  let attempt = 0;
  let delay = initialDelay;

  while (true) {
    try {
      return await apiCall();
    } catch (error) {
      attempt += 1;
      const errorMessage = error?.message || String(error);
      // Includes cause chain (undici/node fetch wraps the real reason in error.cause)
      const causeMessage = error?.cause?.message || error?.cause?.code || '';
      const fullMessage = `${errorMessage} ${causeMessage}`.trim();

      const isRetryable =
        fullMessage.includes('429') ||
        fullMessage.includes('503') ||
        fullMessage.includes('UNAVAILABLE') ||
        fullMessage.includes('overloaded') ||
        fullMessage.includes('internal error') ||
        fullMessage.includes('Internal server error') ||
        fullMessage.includes('Resource has been exhausted') ||
        fullMessage.includes('quota') ||
        // Transient network failures (undici / Node fetch)
        fullMessage.includes('fetch failed') ||
        fullMessage.includes('ECONNRESET') ||
        fullMessage.includes('ETIMEDOUT') ||
        fullMessage.includes('ENOTFOUND') ||
        fullMessage.includes('ECONNREFUSED') ||
        fullMessage.includes('EAI_AGAIN') ||
        fullMessage.includes('UND_ERR_SOCKET') ||
        fullMessage.includes('socket hang up');

      if (!isRetryable || attempt > maxRetries) {
        console.error(`[Gemini Proxy] Erro fatal ou limite excedido (${attempt}/${maxRetries}):`, fullMessage);
        throw normalizeGeminiError(error);
      }

      let retryDelayMs = delay;
      if (fullMessage.includes('overloaded') || fullMessage.includes('503')) {
        retryDelayMs = Math.max(retryDelayMs, 12000);
      }
      retryDelayMs = retryDelayMs * (1 + Math.random() * 0.3);

      console.warn(`[Gemini Proxy] Tentativa ${attempt}/${maxRetries} falhou (${fullMessage.slice(0, 120)}). Aguardando ${(retryDelayMs / 1000).toFixed(1)}s.`);
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      delay = Math.min(delay * 1.5, 60000);
    }
  }
};

const getAspectRatioPromptFragment = (aspectRatio) => {
  switch (aspectRatio) {
    case '16:9':
      return 'uma proporção estrita de 16:9 paisagem (como uma cena de cinema widescreen, 1920x1080px)';
    case '1:1':
      return 'uma proporção estrita de 1:1 quadrada (como um post de Instagram, 1080x1080px)';
    case '9:16':
      return 'uma proporção estrita de 9:16 retrato (como a tela de um celular, 1080x1920px)';
    case '4:3':
      return 'uma proporção estrita de 4:3 (como uma tela de TV clássica)';
    case '3:4':
      return 'uma proporção estrita de 3:4 retrato (mais alta que um quadrado)';
    default:
      return 'uma proporção estrita de 16:9 paisagem (como uma cena de cinema widescreen, 1920x1080px)';
  }
};

const parseJson = (text, errorMessage) => {
  let jsonText = text?.trim();
  if (!jsonText) throw new Error('Resposta vazia do modelo.');
  // Strip Markdown code fences (```json ... ``` or ``` ... ```) if present.
  const fenceMatch = jsonText.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fenceMatch) jsonText = fenceMatch[1].trim();
  // As a last resort, try to extract the first JSON object or array.
  if (!/^[{\[]/.test(jsonText)) {
    const extracted = jsonText.match(/[{\[][\s\S]*[}\]]/);
    if (extracted) jsonText = extracted[0];
  }
  try {
    return JSON.parse(jsonText);
  } catch {
    console.error('[Gemini Proxy] Failed to parse JSON:', jsonText.slice(0, 300));
    throw new Error(errorMessage);
  }
};

const resolveImageToBase64 = async (src) => {
  if (src.startsWith('data:')) {
    const comma = src.indexOf(',');
    if (comma === -1) throw new Error('Data URL malformada.');
    const meta = src.slice(5, comma);
    const mimeType = meta.split(';')[0] || 'image/png';
    const base64Data = src.slice(comma + 1);
    if (!base64Data) throw new Error('Data URL sem conteúdo base64.');
    return { base64Data, mimeType };
  }

  const res = await fetch(src);
  if (!res.ok) throw new Error(`Falha ao carregar imagem: ${res.status}`);
  const contentType = res.headers.get('content-type') || 'image/png';
  const arrayBuffer = await res.arrayBuffer();
  return {
    base64Data: Buffer.from(arrayBuffer).toString('base64'),
    mimeType: contentType,
  };
};

export default function registerGeminiRoutes(app, { asyncRoute, imageJsonParser }) {
  app.get('/api/gemini/status', (req, res) => {
    const platform = getPlatformProvider();
    res.json({
      hasPlatformKey: hasPlatformProvider(),
      platformProvider: platform?.kind || null,
      vertex: platform?.kind === 'vertex'
        ? { project: platform.project, location: platform.location }
        : platform?.kind === 'vertex_express'
          ? { express: true }
          : null,
      user: publicUser(req.user),
    });
  });

  app.post('/api/gemini/general-context', asyncRoute(async (req) => {
    const { csvContent, promptTemplate } = req.body;
    if (!csvContent || String(csvContent).length > 400_000) throw new Error('CSV inválido ou muito grande (máx. 400 KB).');
    const model = 'gemini-2.5-pro';
    const response = await callGeminiWithRetry(() => getAiClient(req).models.generateContent({
      model,
      contents: `${promptTemplate}\n\nConteúdo do CSV:\n${csvContent}`,
    }));

    return {
      result: response.text?.trim() || '',
      costEntry: textCostEntry('Contexto Geral', model, response),
    };
  }));

  app.post('/api/gemini/characters', asyncRoute(async (req) => {
    const { csvContent, promptTemplate } = req.body;
    if (!csvContent || String(csvContent).length > 400_000) throw new Error('CSV inválido ou muito grande (máx. 400 KB).');
    const model = 'gemini-2.5-pro';
    const response = await callGeminiWithRetry(() => getAiClient(req).models.generateContent({
      model,
      contents: `${promptTemplate}\n\nConteúdo do CSV:\n${csvContent}`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING, description: 'O nome do personagem.' },
              physical_characteristics: { type: Type.STRING, description: 'Descrição física do personagem em uma frase. DEVE começar obrigatoriamente com o gênero/identidade como primeira palavra: "Homem", "Mulher", "Menino", "Menina" ou "Pessoa não-binária" (para não-humanos: "Personagem masculino", "Personagem feminina" ou "Criatura"). Em seguida, na ordem: idade aparente, etnia/fenótipo, cabelo (cor/comprimento/textura), olhos, pele, biotipo/estatura, traços distintivos e figurino base. Tudo separado por vírgulas, sem rótulos como "Gênero:" ou "Idade:".' },
              character_type: { type: Type.STRING, enum: ['personagem', 'citado'], description: 'Use "personagem" se o personagem aparece fisicamente nas cenas (age, fala, interage). Use "citado" se ele apenas é mencionado pelo nome mas não aparece.' },
            },
            required: ['name', 'physical_characteristics', 'character_type'],
          },
        },
      },
    }));

    return {
      result: parseJson(response.text, 'Não foi possível extrair os personagens. O modelo retornou um formato inválido.'),
      costEntry: textCostEntry('Personagens', model, response),
    };
  }));

  app.post('/api/gemini/script-to-scenes', asyncRoute(async (req) => {
    const { scriptText, maxScenes = 80, promptTemplate } = req.body;
    const model = 'gemini-2.5-pro';
    const requestedMaxScenes = Math.max(1, Math.min(500, Number(maxScenes) || 80));
    const planSceneLimit = getScriptSceneLimit(req);

    if (!scriptText || String(scriptText).trim().length < 20) {
      throw new Error('Cole um roteiro com conteúdo suficiente para análise.');
    }
    if (requestedMaxScenes > planSceneLimit) {
      throw new Error(`Seu limite atual é de ${planSceneLimit} linhas por roteiro. Reduza o limite ou faça upgrade do plano.`);
    }

    const defaultPrompt = `Você é um supervisor de storyboard e decupagem visual para geração de imagens por IA.

Sua tarefa é converter o roteiro abaixo em uma lista de cenas/subcenas visuais, preservando a narrativa e preparando cada linha para virar uma imagem.

Regras obrigatórias:
- Preserve a ordem exata do roteiro.
- Se o roteiro já tiver CENA, INT., EXT., DIA, NOITE ou numeração, respeite essa divisão.
- Nunca junte duas cenas numeradas diferentes na mesma linha.
- Divida em subcenas quando houver mudança clara de ação, enquadramento, local, tempo, personagem em foco ou lettering.
- Cada linha deve representar UM frame visual gerável.
- Não copie locução como imagem. Use a locução apenas para inferir emoção, tema e intenção visual.
- Se houver texto visível na tela, preserve literalmente com o prefixo "LETTERING:".
- Não invente acontecimentos importantes. Inferências de ambiente são permitidas apenas quando necessárias.
- "scene_id" deve ser string numérica começando em 1.
- "sub_id" deve ser string numérica começando em 1 dentro de cada cena.
- "order" deve ser a ordem global, começando em 1.
- "loc" deve descrever local/ambiente visível. Se não existir, inferir com cautela.
- "context" deve conter: ação visual, personagem em foco, objetos importantes, atmosfera, emoção e qualquer lettering.
- "style" é o tipo de plano/câmera. Use apenas um destes valores quando fizer sentido: Close-up, Medium Shot, Wide Shot, Panoramic Shot, American Shot, Detail Shot, High-Angle Shot, Low-Angle Shot, Over-the-Shoulder Shot, POV Shot, Establishing Shot, Aerial/Drone Shot, Macro Shot, Dutch Angle ou vazio.
- Limite a no máximo ${requestedMaxScenes} linhas.

Formato:
[
  {
    "scene_id": "1",
    "sub_id": "1",
    "order": "1",
    "loc": "local/ambiente",
    "context": "descrição visual objetiva e completa",
    "style": "tipo de plano"
  }
]

Roteiro:
${scriptText}

Responda APENAS com JSON válido.`;
    const template = String(promptTemplate || defaultPrompt);
    const prompt = template
      .replace('{max_scenes}', String(requestedMaxScenes))
      .replace('{script_text}', String(scriptText));
    const finalPrompt = template.includes('{script_text}')
      ? prompt
      : `${prompt}\n\nLimite máximo: ${requestedMaxScenes} linhas.\n\nRoteiro:\n${scriptText}`;

    const response = await callGeminiWithRetry(() => getAiClient(req).models.generateContent({
      model,
      contents: finalPrompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              scene_id: { type: Type.STRING },
              sub_id: { type: Type.STRING },
              order: { type: Type.STRING },
              loc: { type: Type.STRING },
              context: { type: Type.STRING },
              style: { type: Type.STRING },
            },
            required: ['scene_id', 'sub_id', 'order', 'loc', 'context', 'style'],
          },
        },
      },
    }));

    const rows = parseJson(response.text, 'Não foi possível estruturar o roteiro. O modelo retornou um formato inválido.');
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error('A IA não encontrou cenas suficientes no roteiro informado.');
    }

    return {
      result: rows.slice(0, requestedMaxScenes).map((row, index) => ({
        scene_id: String(row.scene_id || '').trim() || String(index + 1),
        sub_id: String(row.sub_id || '').trim() || '1',
        order: String(row.order || '').trim() || String(index + 1),
        loc: String(row.loc || '').trim(),
        context: String(row.context || '').trim(),
        style: String(row.style || '').trim(),
      })),
      costEntry: textCostEntry('Estruturação de Roteiro', model, response),
    };
  }));

  app.post('/api/gemini/structure-storyboard', asyncRoute(async (req) => {
    const { scriptText, maxRows = 200, storyboardConfig } = req.body;
    const model = 'gemini-2.5-pro';
    const requestedMax = Math.max(1, Math.min(500, Number(maxRows) || 200));
    const planSceneLimit = getScriptSceneLimit(req);

    if (!scriptText || String(scriptText).trim().length < 20) {
      throw new Error('Texto insuficiente para estruturar o storyboard.');
    }
    if (requestedMax > planSceneLimit) {
      throw new Error(`Seu limite atual é de ${planSceneLimit} linhas por roteiro. Reduza o limite ou faça upgrade do plano.`);
    }

    const promptTemplate = buildStoryboardStructurePrompt(storyboardConfig, requestedMax);
    const prompt = promptTemplate.replace('{script_text}', String(scriptText));

    const response = await callGeminiWithRetry(() => getAiClient(req).models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              ordem: { type: Type.INTEGER },
              local: { type: Type.STRING },
              locucao: { type: Type.STRING },
              imagem: { type: Type.STRING },
              lettering: { type: Type.STRING },
              tipo_cena: { type: Type.STRING },
            },
            required: ['ordem', 'local', 'locucao', 'imagem', 'lettering', 'tipo_cena'],
          },
        },
      },
    }));

    const rows = parseJson(response.text, 'Não foi possível estruturar o storyboard. O modelo retornou um formato inválido.');
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error('A IA não encontrou cenas suficientes no roteiro informado.');
    }

    return {
      result: rows.slice(0, requestedMax).map((row, i) => ({
        ordem: Number(row.ordem) || i + 1,
        local: String(row.local || '').trim(),
        locucao: String(row.locucao || '').trim(),
        imagem: String(row.imagem || '').trim(),
        lettering: String(row.lettering || '').trim(),
        tipo_cena: String(row.tipo_cena || '').trim(),
      })),
      costEntry: textCostEntry('Estruturação de Storyboard', model, response),
    };
  }));

  app.post('/api/gemini/analyze-storyboard-scene', asyncRoute(async (req) => {
    const { row, characterList = [], generalContext = '', sceneAnalysisConfig } = req.body;
    if (!row || !row.imagem) throw new Error('Linha de storyboard inválida.');
    const model = 'gemini-2.5-pro';

    const characterBlock = characterList.length > 0
      ? characterList.map(c => `- ${c.name}: ${c.physical_characteristics || 'descrição física não informada'}`).join('\n')
      : 'Nenhum personagem identificado ainda.';

    const prompt = buildSceneAnalysisPrompt(sceneAnalysisConfig, row, characterBlock, generalContext);

    const response = await callGeminiWithRetry(() => getAiClient(req).models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            tagged_description: { type: Type.STRING },
            detected_characters: { type: Type.ARRAY, items: { type: Type.STRING } },
            visual_intention: { type: Type.STRING },
            prompt_json: promptJsonSchema,
            image_prompt: { type: Type.STRING },
            mood: { type: Type.STRING },
            suggests_split: { type: Type.BOOLEAN },
            split_reason: { type: Type.STRING },
            end_frame_prompt: { type: Type.STRING },
          },
          required: ['tagged_description', 'detected_characters', 'visual_intention', 'prompt_json', 'image_prompt', 'mood', 'suggests_split', 'split_reason', 'end_frame_prompt'],
        },
      },
    }));

    const result = normalizeSceneAnalysisResult(parseJson(response.text, 'Não foi possível analisar a cena do storyboard.'));
    return {
      result,
      costEntry: textCostEntry('Análise de Cena (Storyboard)', model, response),
    };
  }));

  app.post('/api/gemini/analyze-scene', asyncRoute(async (req) => {
    const { location, description, characterList, style, promptTemplate, generalContext } = req.body;
    if (!description || String(description).length > 10_000) throw new Error('Descrição da cena inválida ou muito longa (máx. 10.000 chars).');
    const model = 'gemini-2.5-pro';
    const characterBlock = (characterList || []).length > 0
      ? (characterList || []).map((c) => `- ${c.name}: ${c.physical_characteristics || 'descrição física não informada'}`).join('\n')
      : 'Nenhum personagem listado.';
    const styleInstruction = style && style.trim() !== ''
      ? `Instrução de Estilo Crucial: O prompt DEVE refletir a direção abaixo. Se houver conflito entre a direção estética e termos do roteiro, preserve o conteúdo narrativo, mas siga a estética indicada.\n${style}`
      : 'Use o enquadramento cinematográfico que melhor se adeque à cena.';
    const contextBlock = generalContext
      ? generalContext
      : 'Contexto não fornecido — use seu julgamento com base na cena.';

    const finalPrompt = promptTemplate
      .replace('{character_list}', characterBlock)
      .replace('{location}', location || 'Local não especificado.')
      .replace('{description}', description)
      .replace('{style_instruction}', styleInstruction)
      .replace('{general_context}', contextBlock);

    const response = await callGeminiWithRetry(() => getAiClient(req).models.generateContent({
      model,
      contents: finalPrompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            tagged_description: { type: Type.STRING, description: 'A descrição da cena com tags de personagem no formato [Nome].' },
            detected_characters: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Nomes exatos dos personagens da lista que aparecem ou são mencionados nesta cena.',
            },
            visual_intention: { type: Type.STRING, description: 'Intenção visual da cena em uma frase curta em português.' },
            prompt_json: promptJsonSchema,
            image_prompt: { type: Type.STRING, description: 'Prompt detalhado em inglês para geração de imagem.' },
            mood: { type: Type.STRING, description: 'Mood/atmosfera predominante da cena em uma frase curta em português.' },
            suggests_split: { type: Type.BOOLEAN, description: 'Verdadeiro se a cena tiver ações ou locais visualmente distintos demais para um único frame.' },
            split_reason: { type: Type.STRING, description: 'Motivo pelo qual a cena deve ser dividida. Vazio se suggests_split for false.' },
            end_frame_prompt: { type: Type.STRING, description: 'Prompt em inglês descrevendo o estado visual final da cena, para uso como frame de saída em ferramentas de vídeo.' },
          },
          required: ['tagged_description', 'detected_characters', 'visual_intention', 'prompt_json', 'image_prompt', 'mood', 'suggests_split', 'split_reason', 'end_frame_prompt'],
        },
      },
    }));

    return {
      result: normalizeSceneAnalysisResult(parseJson(response.text, 'Não foi possível analisar a cena. O modelo retornou um formato inválido.')),
      costEntry: textCostEntry('Análise de Cena', model, response),
    };
  }));

  app.post('/api/gemini/generate-image', imageJsonParser, asyncRoute(async (req) => {
    const { prompt, imageModel, aspectRatio, numberOfImages = 1, generalContext, resolution = '1K', aspectRatioFitMode = 'cover' } = req.body;
    if (!prompt || String(prompt).length > 20_000) throw new Error('Prompt inválido ou muito longo (máx. 20.000 chars).');
    let finalPrompt = prompt;

    if (generalContext) {
      finalPrompt = `**Contexto Geral:** ${generalContext}\n\n**Tarefa da Imagem:** ${prompt}`;
    }

    if (imageModel === 'imagen-4.0-generate-001') {
      const validImagenRatios = ['1:1', '3:4', '4:3', '9:16', '16:9'];
      const config = {
        numberOfImages: Math.max(1, Math.min(4, numberOfImages)),
        outputMimeType: 'image/png',
        aspectRatio: validImagenRatios.includes(aspectRatio) ? aspectRatio : '1:1',
      };

      const response = await callGeminiWithRetry(() => getAiClient(req).models.generateImages({
        model: imageModel,
        prompt: finalPrompt,
        config,
      }));

      const image = response.generatedImages?.[0]?.image?.imageBytes;
      if (image) {
        const result = await normalizeGeneratedImage({
          base64Data: image,
          mimeType: 'image/png',
          costBRL: Number((IMAGEN_COST_USD * USD_TO_BRL).toFixed(4)),
        }, aspectRatio, aspectRatioFitMode);
        return {
          result,
          costEntry: imageCostEntry('Geração de Imagem', imageModel, result),
        };
      }

      const blockReason = response.promptFeedback?.blockReason;
      if (blockReason) throw new Error(`A geração de imagem foi bloqueada. Motivo: ${blockReason}. Por favor, ajuste o prompt.`);
    } else if (imageModel === 'gemini-3-pro-image-preview') {
      const validRatios = ['1:1', '3:4', '4:3', '9:16', '16:9'];
      const response = await callGeminiWithRetry(() => getAiClient(req).models.generateContent({
        model: imageModel,
        contents: { role: 'user', parts: [{ text: finalPrompt }] },
        config: {
          imageConfig: {
            aspectRatio: validRatios.includes(aspectRatio) ? aspectRatio : '16:9',
            imageSize: resolution,
          },
        },
      }));

      const outputTokens = response.usageMetadata?.candidatesTokenCount;
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          const result = await normalizeGeneratedImage({
            base64Data: part.inlineData.data,
            mimeType: part.inlineData.mimeType,
            ...(outputTokens ? calcImageCost(imageModel, outputTokens) : {}),
          }, aspectRatio, aspectRatioFitMode);
          return {
            result,
            costEntry: imageCostEntry('Geração de Imagem', imageModel, result),
          };
        }
      }

      const blockReason = response.promptFeedback?.blockReason;
      if (blockReason) throw new Error(`A geração de imagem (3 Pro) foi bloqueada. Motivo: ${blockReason}.`);
      const finishReason = response.candidates?.[0]?.finishReason;
      if (finishReason && finishReason !== 'STOP') {
        if (finishReason === 'NO_IMAGE') throw new Error('A IA se recusou a gerar uma imagem. Tente simplificar a descrição.');
        throw new Error(`A geração de imagem (3 Pro) falhou. Motivo: ${finishReason}.`);
      }
    } else {
      if (aspectRatio) {
        finalPrompt = `INSTRUÇÃO CRÍTICA: Gere uma única imagem de alta qualidade com ${getAspectRatioPromptFragment(aspectRatio)}.\n\n${finalPrompt}`;
      }

      const response = await callGeminiWithRetry(() => getAiClient(req).models.generateContent({
        model: imageModel,
        contents: { role: 'user', parts: [{ text: finalPrompt }] },
        config: { responseModalities: [Modality.IMAGE] },
      }));

      const outputTokens = response.usageMetadata?.candidatesTokenCount;
      const part = response.candidates?.[0]?.content?.parts?.[0];
      if (part?.inlineData) {
        const result = await normalizeGeneratedImage({
          base64Data: part.inlineData.data,
          mimeType: part.inlineData.mimeType,
          ...(outputTokens ? calcImageCost(imageModel, outputTokens) : {}),
        }, aspectRatio, aspectRatioFitMode);
        return {
          result,
          costEntry: imageCostEntry('Geração de Imagem', imageModel, result),
        };
      }

      const blockReason = response.promptFeedback?.blockReason;
      if (blockReason) throw new Error(`A geração de imagem foi bloqueada. Motivo: ${blockReason}. Por favor, ajuste o prompt.`);
      const finishReason = response.candidates?.[0]?.finishReason;
      if (finishReason && finishReason !== 'STOP') {
        if (finishReason === 'NO_IMAGE') throw new Error('A IA não conseguiu gerar uma imagem para este prompt. Tente simplificar a descrição ou o prompt.');
        throw new Error(`A geração de imagem falhou. Motivo: ${finishReason}.`);
      }
    }

    throw new Error('A geração de imagem falhou, nenhum dado de imagem foi recebido.');
  }));

  app.post('/api/gemini/generate-scene-image', imageJsonParser, asyncRoute(async (req) => {
    const {
      prompt,
      characterReferences = [],
      aspectRatio,
      generalContext,
      sceneReference,
      model = 'gemini-2.5-flash-image',
      resolution = '1K',
      extraReferences = [],
      blendInstruction,
      aspectRatioFitMode = 'cover',
    } = req.body;

    const imageParts = [];
    if (sceneReference) imageParts.push({ inlineData: { data: sceneReference.base64Data, mimeType: sceneReference.mimeType } });
    imageParts.push(...characterReferences.map((ref) => ({ inlineData: { data: ref.base64Data, mimeType: ref.mimeType } })));
    imageParts.push(...extraReferences.map((ref) => ({ inlineData: { data: ref.base64Data, mimeType: ref.mimeType } })));

    const contextHeader = generalContext ? `**Contexto Geral:** ${generalContext}\n\n` : '';
    const sceneReferencePromptPart = sceneReference
      ? '- **Referência de Cena (primeira imagem):** Use-a para manter a continuidade do ambiente, iluminação e estilo visual. As ações e poses nesta imagem são do passado; não as copie.'
      : '';

    const characterReferencePromptPart = characterReferences.length > 0
      ? `- **Referências de Personagem (imagens seguintes):**\n${characterReferences.map((ref) => `*   **[${ref.name}]:** Use a imagem de referência correspondente para replicar sua aparência exata (rosto, cabelo, roupas, etc.).`).join('\n')}`
      : '';

    let extraReferencesPromptPart = '';
    if (extraReferences.length > 0) {
      const startIndex = (sceneReference ? 1 : 0) + characterReferences.length + 1;
      extraReferencesPromptPart = `- **Referências de Objetos/Estilos Externos (últimas ${extraReferences.length} imagem${extraReferences.length > 1 ? 'ns' : ''}):**\n${extraReferences.map((_, i) => `*   **[Referência de Objeto ${i + 1} — imagem ${startIndex + i}]:** Incorpore os elementos visuais desta imagem na cena gerada, mantendo consistência de proporção, iluminação e estilo.`).join('\n')}`;
      if (blendInstruction?.trim()) {
        extraReferencesPromptPart += `\n  - **Instrução de mesclagem do usuário:** ${blendInstruction.trim()}`;
      }
    }

    const instructionParts = [sceneReferencePromptPart, characterReferencePromptPart, extraReferencesPromptPart].filter(Boolean);
    const instructionsBlock = instructionParts.length > 0
      ? `**Instruções de Referência:**\n${instructionParts.join('\n\n')}\n\n`
      : '';

    let finalPrompt = `${contextHeader}**Sua Tarefa:** Crie uma nova imagem de cena, seguindo as instruções e referências abaixo.

${instructionsBlock}**Descrição da Nova Cena (Ação e Enquadramento):**
> ${prompt}`;

    const config = {};
    const parts = [...imageParts];

    if (model === 'gemini-3-pro-image-preview') {
      config.imageConfig = {
        aspectRatio: aspectRatio || '16:9',
        imageSize: resolution,
      };
      parts.push({ text: finalPrompt });
    } else {
      finalPrompt += `\n\n**Requisito Crítico de Formato:** A imagem final DEVE ter ${getAspectRatioPromptFragment(aspectRatio)}.`;
      config.responseModalities = [Modality.IMAGE];
      parts.push({ text: finalPrompt });
    }

    const response = await callGeminiWithRetry(() => getAiClient(req).models.generateContent({
      model,
      contents: { role: 'user', parts },
      config,
    }));

    const outputTokens = response.usageMetadata?.candidatesTokenCount;
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        const result = await normalizeGeneratedImage({
          base64Data: part.inlineData.data,
          mimeType: part.inlineData.mimeType,
          ...(outputTokens ? calcImageCost(model, outputTokens) : {}),
        }, aspectRatio, aspectRatioFitMode);
        return {
          result,
          costEntry: imageCostEntry('Geração de Cena', model, result),
        };
      }
    }

    const blockReason = response.promptFeedback?.blockReason;
    if (blockReason) throw new Error(`A geração de imagem com referências foi bloqueada. Motivo: ${blockReason}. Por favor, ajuste o prompt.`);
    const finishReason = response.candidates?.[0]?.finishReason;
    if (finishReason && finishReason !== 'STOP') {
      if (finishReason === 'NO_IMAGE') throw new Error('A IA não conseguiu gerar uma imagem para este prompt. Tente simplificar a descrição da cena ou usar menos personagens de referência.');
      throw new Error(`A geração de imagem com referências falhou. Motivo: ${finishReason}.`);
    }

    throw new Error('A geração de imagem com referências falhou, nenhum dado de imagem foi recebido.');
  }));

  app.post('/api/gemini/edit-image', imageJsonParser, asyncRoute(async (req) => {
    const { base64ImageDataWithPrefix, maskBase64WithPrefix, prompt, generalContext } = req.body;
    if (!prompt || String(prompt).length > 10_000) throw new Error('Prompt de edição inválido ou muito longo (máx. 10.000 chars).');
    const model = 'gemini-2.5-flash-image';
    const parts = base64ImageDataWithPrefix.split(',');
    const mimeType = parts[0].match(/:(.*?);/)?.[1] || 'image/png';
    const base64Data = parts[1];

    // When a mask is provided, use two-image inpainting:
    // image 1 = original clean image, image 2 = mask showing the region to edit
    let finalPrompt;
    let contentParts;
    if (maskBase64WithPrefix) {
      const maskParts = maskBase64WithPrefix.split(',');
      const maskMime = maskParts[0].match(/:(.*?);/)?.[1] || 'image/png';
      const maskData = maskParts[1];
      const taskDesc = generalContext
        ? `**Contexto Geral:** ${generalContext}\n\n**Instrução:** ${prompt}`
        : prompt;
      finalPrompt =
        `The first image is the original scene. ` +
        `The second image is a mask: the cyan-highlighted region marks where to apply the edit. ` +
        `${taskDesc}. ` +
        `RULES: (1) Edit ONLY the cyan region from the mask. ` +
        `(2) Keep everything outside that region pixel-perfect identical to the first image. ` +
        `(3) Output a clean, natural image — NO overlays, tints, or selection markers in the result.`;
      contentParts = [
        { inlineData: { data: base64Data, mimeType } },
        { inlineData: { data: maskData, mimeType: maskMime } },
        { text: finalPrompt },
      ];
    } else {
      finalPrompt = generalContext
        ? `**Contexto Geral:** ${generalContext}\n\n**Tarefa de Edição:** ${prompt}`
        : prompt;
      contentParts = [{ inlineData: { data: base64Data, mimeType } }, { text: finalPrompt }];
    }

    const response = await callGeminiWithRetry(() => getAiClient(req).models.generateContent({
      model,
      contents: { role: 'user', parts: contentParts },
      config: { responseModalities: [Modality.IMAGE] },
    }));

    const outputTokens = response.usageMetadata?.candidatesTokenCount;
    const part = response.candidates?.[0]?.content?.parts?.[0];
    if (part?.inlineData) {
      const result = {
        base64Data: part.inlineData.data,
        mimeType: part.inlineData.mimeType,
        ...(outputTokens ? calcImageCost(model, outputTokens) : {}),
      };
      return {
        result,
        costEntry: imageCostEntry('Edição de Imagem', model, result),
      };
    }
    throw new Error('A edição de imagem falhou, nenhum dado de imagem foi recebido.');
  }));

  app.post('/api/gemini/isolate-character', imageJsonParser, asyncRoute(async (req) => {
    const { base64ImageDataWithPrefix } = req.body;
    const model = 'gemini-2.5-flash-image';
    const parts = base64ImageDataWithPrefix.split(',');
    const mimeType = parts[0].match(/:(.*?);/)?.[1] || 'image/png';
    const base64Data = parts[1];
    const prompt = 'CRITICAL INSTRUCTION: Your task is to perform a clean cutout of the main person in the image. Follow these steps precisely: 1. Identify the primary human subject. 2. Completely remove the entire original background. 3. Replace the background with a solid, uniform, light gray color (#d3d3d3). 4. Crop the image to a portrait format, showing only the person from the head to the shoulders. 5. Ensure the subject is perfectly centered in the final image. Do not add any new elements, shadows, or effects. The final output must be just the person on the plain gray background.';

    const response = await callGeminiWithRetry(() => getAiClient(req).models.generateContent({
      model,
      contents: { role: 'user', parts: [{ inlineData: { data: base64Data, mimeType } }, { text: prompt }] },
      config: { responseModalities: [Modality.IMAGE] },
    }));

    const outputTokens = response.usageMetadata?.candidatesTokenCount;
    const part = response.candidates?.[0]?.content?.parts?.[0];
    if (part?.inlineData) {
      const result = await normalizeGeneratedImage({
        base64Data: part.inlineData.data,
        mimeType: part.inlineData.mimeType,
        ...(outputTokens ? calcImageCost(model, outputTokens) : {}),
      }, '1:1', 'contain');
      return {
        result,
        costEntry: imageCostEntry('Isolamento de Personagem', model, result),
      };
    }
    throw new Error('O isolamento do personagem falhou, nenhum dado de imagem foi recebido.');
  }));

  app.post('/api/gemini/analyze-image-text', imageJsonParser, asyncRoute(async (req) => {
    const { imageSource, originalPrompt } = req.body;
    const model = 'gemini-2.5-flash';
    const { base64Data, mimeType } = await resolveImageToBase64(imageSource);
    const prompt = `Você é um revisor e transcritor meticuloso, especialista em português.
Analise a imagem e execute as seguintes etapas:

1. **Transcreva TODO o texto visível** na imagem no campo 'transcribedText'. Se não houver texto, deixe como string vazia.
2. **Identifique TODOS os erros** (ortografia, gramática, digitação, inconsistência com o prompt).
   - Para cada erro, forneça:
     • 'originalText': trecho exato na imagem
     • 'suggestedCorrection': correção proposta
     • 'explanation': breve motivo
     • 'boundingBox': posição do texto errado na imagem, como coordenadas normalizadas [0,1].
   - Liste múltiplos erros no array 'errors'. Se não houver erros, 'errors' deve ser um array vazio.
3. **Defina 'errorFound'** como true se houver pelo menos um erro, false caso contrário.

Contexto do prompt original desta imagem: "${originalPrompt}"

Responda APENAS com o objeto JSON conforme o schema definido.`;

    const response = await callGeminiWithRetry(() => getAiClient(req).models.generateContent({
      model,
      contents: { role: 'user', parts: [{ inlineData: { data: base64Data, mimeType } }, { text: prompt }] },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            errorFound: { type: Type.BOOLEAN, description: 'True se houver ao menos um erro.' },
            transcribedText: { type: Type.STRING, description: 'Todo o texto visível transcrito da imagem.' },
            errors: {
              type: Type.ARRAY,
              description: 'Lista de todos os erros encontrados.',
              items: {
                type: Type.OBJECT,
                properties: {
                  originalText: { type: Type.STRING, description: 'Trecho exato com erro.' },
                  suggestedCorrection: { type: Type.STRING, description: 'Correção sugerida.' },
                  explanation: { type: Type.STRING, description: 'Breve explicação do erro.' },
                  boundingBox: {
                    type: Type.OBJECT,
                    properties: {
                      x: { type: Type.NUMBER },
                      y: { type: Type.NUMBER },
                      w: { type: Type.NUMBER },
                      h: { type: Type.NUMBER },
                    },
                    required: ['x', 'y', 'w', 'h'],
                  },
                },
                required: ['originalText', 'suggestedCorrection'],
              },
            },
          },
          required: ['errorFound', 'transcribedText', 'errors'],
        },
      },
    }));

    const parsed = parseJson(response.text, 'Não foi possível analisar o texto da imagem. O modelo retornou um formato inválido.');
    if (!Array.isArray(parsed.errors)) parsed.errors = [];
    if (parsed.errorFound && parsed.errors.length === 0 && parsed.originalText) {
      parsed.errors = [{
        originalText: parsed.originalText,
        suggestedCorrection: parsed.suggestedCorrection ?? '',
        explanation: parsed.explanation,
      }];
    }

    return {
      result: parsed,
      costEntry: textCostEntry('Análise de Texto', model, response),
    };
  }));

  app.post('/api/gemini/split-prompts', asyncRoute(async (req) => {
    const { originalPrompt, generalContext, count, instructions } = req.body;
    const model = 'gemini-2.5-pro';
    const systemPrompt = `Você é um diretor de fotografia decompondo uma cena em ${count} planos individuais distintos.

Dado o prompt de imagem de uma cena, crie exatamente ${count} sub-prompts, cada um descrevendo um plano (shot) diferente dentro da mesma cena.
Cada sub-prompt deve capturar um ângulo diferente, tipo de enquadramento, detalhe ou momento específico — juntos eles contam a história completa da cena.
Os sub-prompts devem ser em inglês, detalhados e prontos para geração de imagem direta.
${instructions ? `Instrução adicional do usuário: ${instructions}` : ''}

Contexto geral da história: ${generalContext || 'Não fornecido'}

Prompt original da cena:
${originalPrompt}

Retorne APENAS um array JSON com exatamente ${count} strings. Sem markdown, sem explicação. Exemplo: ["cinematic close-up...", "wide establishing shot..."]`;

    const response = await callGeminiWithRetry(() => getAiClient(req).models.generateContent({
      model,
      contents: systemPrompt,
    }));

    const text = response.text?.trim() || '';
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('Falha ao gerar sub-prompts para divisão da cena.');

    let prompts;
    try {
      prompts = JSON.parse(match[0]);
    } catch {
      throw new Error('Falha ao interpretar os sub-prompts gerados.');
    }

    if (!Array.isArray(prompts) || prompts.length < count) {
      throw new Error('Número insuficiente de sub-prompts gerados.');
    }

    return {
      result: prompts.slice(0, count),
      costEntry: textCostEntry('Divisão de Cena', model, response),
    };
  }));

  app.post('/api/gemini/refine-scene', asyncRoute(async (req) => {
    const { location, description, imagePrompt, generalContext, characterList = [] } = req.body;
    if (!description || !imagePrompt) throw new Error('Informe a descrição e o prompt da cena para refinamento.');
    if (String(imagePrompt).length > 20_000) throw new Error('Prompt muito longo (máx. 20.000 chars).');

    const model = 'gemini-2.5-flash';
    const characterBlock = characterList.length > 0
      ? characterList.map((c) => `- ${c.name}: ${c.physical_characteristics}`).join('\n')
      : 'Nenhum personagem listado.';

    const prompt = `You are a visual story consultant reviewing a single scene from a screenplay or storyboard.

Story general context:
${generalContext || 'Not provided.'}

Characters in the story:
${characterBlock}

Scene being reviewed:
- Location: ${location || 'Not specified.'}
- Description: ${description}
- Current image prompt: ${imagePrompt}

Perform TWO analyses:

1. SPLIT ANALYSIS
   Decide if this scene is too complex for a single image.
   A scene should be split if it contains two or more distinct narrative beats, a significant location/time change, or contradictory camera framings.
   If yes: suggest 2 or 3 sub-scenes. Each must have:
   - "description": a brief (1-2 sentence) Portuguese description
   - "prompt": a ready-to-use English image generation prompt

2. ALTERNATIVE PROMPT
   Write ONE alternative English image generation prompt for the same narrative moment using a different camera angle, lighting mood, or visual metaphor.
   Also provide a brief Portuguese sentence explaining why this alternative might work better.

Respond ONLY with valid JSON (no markdown, no code fences):
{"needsSplit":boolean,"splitReason":"string or null","splitSuggestion":[{"description":"string","prompt":"string"}],"alternativePrompt":"string","alternativeReason":"string"}`;

    const response = await callGeminiWithRetry(() => getAiClient(req).models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            needsSplit: { type: Type.BOOLEAN },
            splitReason: { type: Type.STRING },
            splitSuggestion: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  description: { type: Type.STRING },
                  prompt: { type: Type.STRING },
                },
                required: ['description', 'prompt'],
              },
            },
            alternativePrompt: { type: Type.STRING },
            alternativeReason: { type: Type.STRING },
          },
          required: ['needsSplit', 'alternativePrompt', 'alternativeReason'],
        },
      },
    }));

    const parsed = parseJson(response.text, 'Não foi possível refinar a cena. O modelo retornou um formato inválido.');
    return {
      result: {
        needsSplit: Boolean(parsed.needsSplit),
        splitReason: parsed.splitReason || null,
        splitSuggestion: Array.isArray(parsed.splitSuggestion) && parsed.splitSuggestion.length > 0
          ? parsed.splitSuggestion
          : null,
        alternativePrompt: String(parsed.alternativePrompt || ''),
        alternativeReason: parsed.alternativeReason || undefined,
      },
      costEntry: textCostEntry('Refinamento de Cena', model, response),
    };
  }));

  app.post('/api/gemini/recreate-prompt', asyncRoute(async (req) => {
    const {
      location,
      description,
      currentImagePrompt,
      currentPromptJson,
      creativeDirection,
      style,
      characterList = [],
      generalContext,
    } = req.body;

    if (!creativeDirection || String(creativeDirection).trim() === '') {
      throw new Error('Informe a nova direção criativa para recriar o prompt.');
    }
    if (String(creativeDirection).length > 4_000) {
      throw new Error('Direção criativa muito longa (máx. 4.000 chars).');
    }
    if (currentImagePrompt && String(currentImagePrompt).length > 20_000) {
      throw new Error('Prompt atual muito longo (máx. 20.000 chars).');
    }

    const model = 'gemini-2.5-pro';
    const characterBlock = (characterList || []).length > 0
      ? (characterList || []).map((c) => `- ${c.name}: ${c.physical_characteristics || 'descrição física não informada'}`).join('\n')
      : 'Nenhum personagem listado.';
    const styleInstruction = style && String(style).trim() !== ''
      ? `Direção estética base (mantenha como referência, a menos que a nova direção criativa peça o contrário):\n${style}`
      : 'Sem direção estética base definida — use seu julgamento cinematográfico.';
    const contextBlock = generalContext || 'Contexto não fornecido — use seu julgamento com base na cena.';
    const currentJsonBlock = currentPromptJson
      ? JSON.stringify(currentPromptJson, null, 2)
      : (currentImagePrompt || 'Nenhum prompt anterior — crie do zero.');

    const finalPrompt = `Você é um diretor de arte e diretor de fotografia recriando a DIREÇÃO CRIATIVA de uma cena para geração de imagem por IA.

OBJETIVO: produzir um NOVO prompt visual estruturado que aplique a nova direção criativa solicitada pelo usuário, SEM trair o conteúdo narrativo da cena (mesmos personagens, mesma ação essencial, mesmo lettering/texto literal, se houver).

Contexto geral da história:
${contextBlock}

Personagens da história:
${characterBlock}

Cena sendo recriada:
- Local: ${location || 'Não especificado.'}
- Descrição narrativa (fonte da verdade do conteúdo): ${description || 'Não fornecida.'}

Prompt / estrutura atual (referência do ponto de partida):
${currentJsonBlock}

${styleInstruction}

NOVA DIREÇÃO CRIATIVA SOLICITADA PELO USUÁRIO (prioridade máxima para a estética/composição):
"""
${creativeDirection}
"""

REGRAS:
1. Preserve o CONTEÚDO narrativo: personagens presentes, ação principal, objetos essenciais e qualquer texto/lettering literal devem permanecer fiéis à descrição.
2. Aplique a nova direção criativa na ESTÉTICA e COMPOSIÇÃO: enquadramento, ângulo, lente, iluminação, paleta, atmosfera, mood, profundidade e estilo visual conforme pedido.
3. Se a direção pedir mudança de meio/estilo (ex.: fotorrealista → ilustração), reflita isso em visual_style.
4. Não invente novos personagens nem altere o significado da cena.
5. O image_prompt final deve ser em INGLÊS, detalhado e pronto para geração direta de imagem.
6. Preencha o objeto prompt_json de forma modular e coerente com o image_prompt.

Responda SOMENTE com JSON válido seguindo o schema fornecido.`;

    const response = await callGeminiWithRetry(() => getAiClient(req).models.generateContent({
      model,
      contents: finalPrompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            visual_intention: { type: Type.STRING, description: 'Intenção visual da cena recriada em uma frase curta em português.' },
            direction_summary: { type: Type.STRING, description: 'Resumo curto em português do que mudou em relação ao prompt anterior por causa da nova direção criativa.' },
            prompt_json: promptJsonSchema,
            image_prompt: { type: Type.STRING, description: 'Prompt detalhado em inglês para geração de imagem, refletindo a nova direção criativa.' },
          },
          required: ['visual_intention', 'prompt_json', 'image_prompt'],
        },
      },
    }));

    const parsed = parseJson(response.text, 'Não foi possível recriar o prompt. O modelo retornou um formato inválido.');
    return {
      result: normalizeSceneAnalysisResult(parsed),
      costEntry: textCostEntry('Recriação de Prompt', model, response),
    };
  }));

  app.post('/api/gemini/analyze-uploaded-image', imageJsonParser, asyncRoute(async (req) => {
    const { base64Data, mimeType, prompt } = req.body;
    if (!prompt || String(prompt).length > 10_000) throw new Error('Prompt inválido ou muito longo (máx. 10.000 chars).');
    const model = 'gemini-2.5-flash';
    const response = await callGeminiWithRetry(() => getAiClient(req).models.generateContent({
      model,
      contents: { role: 'user', parts: [{ inlineData: { data: base64Data, mimeType } }, { text: prompt }] },
    }));

    return {
      result: response.text?.trim() || 'Sem resposta.',
      costEntry: textCostEntry('Análise de Imagem', model, response),
    };
  }));
}
