import { GoogleGenAI, Type, Modality, GenerateContentResponse, GenerateImagesResponse } from '@google/genai';
import type { Character, ImageModel, TextAnalysisResult } from '../types';

// ── Pricing constants (as of May 2026) ──────────────────────────────────────
// Flash image models: $0.060 per 1K output tokens
// Pro image model:    $0.030 per 1K output tokens
// Imagen 4:           $0.040 fixed per image (no token count)
const MODEL_PRICE_PER_TOKEN: Record<string, number> = {
  'gemini-2.5-flash-image':           0.060 / 1000,
  'gemini-3.1-flash-image-preview':   0.060 / 1000,
  'gemini-3-pro-image-preview':       0.030 / 1000,
};
const USD_TO_BRL = 5.80;
const IMAGEN_COST_USD = 0.040;

const calcCost = (model: string, tokens: number): { tokens: number; costBRL: number } => {
  const pricePerToken = MODEL_PRICE_PER_TOKEN[model] ?? (0.060 / 1000);
  return { tokens, costBRL: parseFloat((tokens * pricePerToken * USD_TO_BRL).toFixed(4)) };
};

// Re-instantiate the client on each call to ensure the latest API Key is used if needed
const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("A variável de ambiente GEMINI_API_KEY não está definida. Crie um arquivo .env.local com GEMINI_API_KEY=sua_chave.");
  }
  return new GoogleGenAI({ apiKey });
};

const callGeminiWithRetry = async <T>(
  apiCall: () => Promise<T>,
  maxRetries = 10,
  initialDelay = 5000
): Promise<T> => {
  let attempt = 0;
  let delay = initialDelay;

  while (true) {
    try {
      return await apiCall();
    } catch (error: any) {
      attempt++;
      const errorMessage = error.message || error.toString();
      
      const isRetryable = errorMessage.includes('429') || 
                          errorMessage.includes('503') ||
                          errorMessage.includes('UNAVAILABLE') || 
                          errorMessage.includes('overloaded') ||
                          errorMessage.includes('internal error') ||
                          errorMessage.includes('Internal server error') ||
                          errorMessage.includes('Resource has been exhausted') ||
                          errorMessage.includes('quota');

      if (!isRetryable || attempt > maxRetries) {
        console.error(`[Gemini Service] Erro fatal ou limite de tentativas excedido (${attempt}/${maxRetries}):`, errorMessage);
        throw error;
      }

      let retryDelayMs = delay;

      // Special handling for 503/Overloaded: wait significantly longer
      if (errorMessage.includes('overloaded') || errorMessage.includes('503')) {
          retryDelayMs = Math.max(retryDelayMs, 12000); // Mínimo de 12 segundos para sobrecarga
      }

      // Add Jitter (randomness between 0% and 30% extra) to prevent thundering herd
      retryDelayMs = retryDelayMs * (1 + Math.random() * 0.3);

      console.warn(`[Gemini Service] Tentativa ${attempt}/${maxRetries} falhou (${errorMessage.substring(0, 100)}...). Aguardando ${(retryDelayMs/1000).toFixed(1)}s.`);
      
      await new Promise(resolve => setTimeout(resolve, retryDelayMs));
      
      // Exponential backoff with cap at 60 seconds
      delay = Math.min(delay * 1.5, 60000);
    }
  }
};

/**
 * Helper to get aspect ratio instruction for Models that do NOT support `imageConfig` (like Gemini 2.5 Flash).
 */
const getAspectRatioPromptFragment = (aspectRatio: string): string => {
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

export const generateGeneralContext = async (csvContent: string, promptTemplate: string): Promise<string> => {
  const model = 'gemini-2.5-pro';
  const response = await callGeminiWithRetry<GenerateContentResponse>(() => getAiClient().models.generateContent({
    model,
    contents: `${promptTemplate}\n\nConteúdo do CSV:\n${csvContent}`,
  }));
  return response.text?.trim() || '';
};

export const generateCharacters = async (
  csvContent: string,
  promptTemplate: string
): Promise<Character[]> => {
  const model = 'gemini-2.5-pro';
  const response = await callGeminiWithRetry<GenerateContentResponse>(() => getAiClient().models.generateContent({
    model,
    contents: `${promptTemplate}\n\nConteúdo do CSV:\n${csvContent}`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: {
              type: Type.STRING,
              description: 'O nome do personagem.',
            },
            physical_characteristics: {
              type: Type.STRING,
              description: 'Uma descrição das características físicas do personagem.',
            },
          },
          required: ['name', 'physical_characteristics'],
        },
      },
    },
  }));

  const jsonText = response.text?.trim();
  if (!jsonText) throw new Error("Resposta vazia do modelo.");

  try {
    return JSON.parse(jsonText);
  } catch(e) {
    console.error("Failed to parse JSON from Gemini:", jsonText);
    throw new Error("Não foi possível extrair os personagens. O modelo retornou um formato inválido.");
  }
};

export const analyzeScene = async (
  location: string,
  description: string,
  characterList: Character[],
  style: string,
  promptTemplate: string
): Promise<{ tagged_description: string; image_prompt: string }> => {
  const model = 'gemini-2.5-pro';
  const characterNames = characterList.map(c => c.name).join(', ');

  const styleInstruction = style && style.trim() !== ''
    ? `Instrução de Estilo Crucial: O prompt DEVE refletir um enquadramento de câmera do tipo "${style}". Descreva a cena a partir desta perspectiva cinematográfica.`
    : 'Use um enquadramento padrão que melhor se adeque à cena, pois nenhum estilo específico foi fornecido.';

  const finalPrompt = promptTemplate
    .replace('{character_list}', characterNames)
    .replace('{location}', location)
    .replace('{description}', description)
    .replace('{style_instruction}', styleInstruction);

  const response = await callGeminiWithRetry<GenerateContentResponse>(() => getAiClient().models.generateContent({
    model,
    contents: finalPrompt,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          tagged_description: {
            type: Type.STRING,
            description: 'A descrição da cena com tags de personagem.',
          },
          image_prompt: {
            type: Type.STRING,
            description: 'O prompt para geração de imagem.',
          },
        },
        required: ['tagged_description', 'image_prompt'],
      },
    },
  }));

  const jsonText = response.text?.trim();
  if (!jsonText) throw new Error("Resposta vazia do modelo.");

  try {
    const result = JSON.parse(jsonText) as { tagged_description: string; image_prompt: string };
    return result;
  } catch(e) {
    console.error("Failed to parse JSON from Gemini:", jsonText);
    throw new Error("Não foi possível analisar a cena. O modelo retornou um formato inválido.");
  }
};

export const generateImage = async (
    prompt: string,
    imageModel: ImageModel,
    aspectRatio?: string,
    numberOfImages: number = 1,
    generalContext?: string,
    resolution: '1K' | '2K' | '4K' = '1K'
): Promise<{ base64Data: string; mimeType: string; tokens?: number; costBRL?: number; }> => {
  let finalPrompt = prompt;

  if (generalContext) {
    finalPrompt = `**Contexto Geral:** ${generalContext}\n\n**Tarefa da Imagem:** ${prompt}`;
  }

  // === Strategy: Imagen (Dedicated Endpoint) ===
  if (imageModel === 'imagen-4.0-generate-001') {
      const validImagenRatios = ["1:1", "3:4", "4:3", "9:16", "16:9"];
      const config: any = {
          numberOfImages: Math.max(1, Math.min(4, numberOfImages)),
          outputMimeType: 'image/png',
      };
      if (aspectRatio && validImagenRatios.includes(aspectRatio)) {
          config.aspectRatio = aspectRatio;
      } else {
          config.aspectRatio = '1:1'; 
      }
      
      const response = await callGeminiWithRetry<GenerateImagesResponse>(() => getAiClient().models.generateImages({
          model: imageModel,
          prompt: finalPrompt,
          config: config,
      }));
      
      const image = response.generatedImages[0]?.image?.imageBytes;
      if (image) {
          return {
              base64Data: image,
              mimeType: 'image/png',
              costBRL: parseFloat((IMAGEN_COST_USD * USD_TO_BRL).toFixed(4)),
          };
      }

      // Use type casting to access promptFeedback which might not be in the strictest type definition yet
      const blockReason = (response as any).promptFeedback?.blockReason;
      if (blockReason) {
          throw new Error(`A geração de imagem foi bloqueada. Motivo: ${blockReason}. Por favor, ajuste o prompt.`);
      }

  }

  // === Strategy: Gemini 3 Pro (Uses Image Config) ===
  else if (imageModel === 'gemini-3-pro-image-preview') {
       const validRatios = ["1:1", "3:4", "4:3", "9:16", "16:9"];
       const ratio = validRatios.includes(aspectRatio || '') ? aspectRatio : "16:9";
       
       // Note: We do NOT add text instructions for aspect ratio here because 3 Pro supports it natively via config
       
       const response = await callGeminiWithRetry<GenerateContentResponse>(() => getAiClient().models.generateContent({
          model: imageModel,
          contents: { parts: [{ text: finalPrompt }] },
          config: {
              imageConfig: {
                  aspectRatio: ratio,
                  imageSize: resolution // Applies '1K', '2K' or '4K'
              }
          },
      }));

      // Search all parts for inline data
      const outputTokens3Pro = response.usageMetadata?.candidatesTokenCount;
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
            const costData = outputTokens3Pro ? calcCost('gemini-3-pro-image-preview', outputTokens3Pro) : {};
            return {
                base64Data: part.inlineData.data,
                mimeType: part.inlineData.mimeType,
                ...costData,
            };
        }
      }

      const blockReason = response.promptFeedback?.blockReason;
      if (blockReason) {
        throw new Error(`A geração de imagem (3 Pro) foi bloqueada. Motivo: ${blockReason}.`);
      }
      const finishReason = response.candidates?.[0]?.finishReason;
      if (finishReason && finishReason !== 'STOP') {
        if (finishReason === 'NO_IMAGE') {
            throw new Error('A IA se recusou a gerar uma imagem. Isso geralmente ocorre devido a filtros de segurança rigorosos ou prompts muito complexos. Tente simplificar a descrição.');
        }
        throw new Error(`A geração de imagem (3 Pro) falhou. Motivo: ${finishReason}.`);
      }

  }

  // === Strategy: Gemini Flash models (Uses Prompt Engineering + Modality) ===
  else {
      // Both gemini-2.5-flash-image and gemini-3.1-flash-image-preview use the same strategy
      if (aspectRatio) {
        const ratioInstruction = getAspectRatioPromptFragment(aspectRatio);
        finalPrompt = `INSTRUÇÃO CRÍTICA: Gere uma única imagem de alta qualidade com ${ratioInstruction}.\n\n${finalPrompt}`;
      }

      const response = await callGeminiWithRetry<GenerateContentResponse>(() => getAiClient().models.generateContent({
          model: imageModel, // use the actual model (flash or 3.1-flash)
          contents: { parts: [{ text: finalPrompt }] },
          config: {
              responseModalities: [Modality.IMAGE],
          },
      }));

      const outputTokensFlash = response.usageMetadata?.candidatesTokenCount;
      const part = response.candidates?.[0]?.content?.parts[0];
      if (part?.inlineData) {
          const costData = outputTokensFlash ? calcCost(imageModel, outputTokensFlash) : {};
          return {
              base64Data: part.inlineData.data,
              mimeType: part.inlineData.mimeType,
              ...costData,
          };
      }
      const blockReason = response.promptFeedback?.blockReason;
      if (blockReason) {
        throw new Error(`A geração de imagem foi bloqueada. Motivo: ${blockReason}. Por favor, ajuste o prompt.`);
      }
      const finishReason = response.candidates?.[0]?.finishReason;
      if (finishReason && finishReason !== 'STOP') {
        if (finishReason === 'NO_IMAGE') {
            throw new Error('A IA não conseguiu gerar uma imagem para este prompt. Tente simplificar a descrição ou o prompt.');
        }
        throw new Error(`A geração de imagem falhou. Motivo: ${finishReason}.`);
      }
  }
  
  throw new Error('A geração de imagem falhou, nenhum dado de imagem foi recebido.');
};

export const generateSceneImage = async (
    prompt: string,
    characterReferences: { name: string; base64Data: string; mimeType: string; }[],
    aspectRatio: string,
    generalContext?: string,
    sceneReference?: { base64Data: string; mimeType: string; },
    model: string = 'gemini-2.5-flash-image',
    resolution: '1K' | '2K' | '4K' = '1K',
    extraReferences?: { base64Data: string; mimeType: string; }[],
    blendInstruction?: string,
): Promise<{ base64Data: string; mimeType: string; tokens?: number; costBRL?: number; }> => {

    const imageParts = [];
    if (sceneReference) {
        imageParts.push({ inlineData: { data: sceneReference.base64Data, mimeType: sceneReference.mimeType } });
    }
    imageParts.push(...characterReferences.map(ref => ({
        inlineData: { data: ref.base64Data, mimeType: ref.mimeType }
    })));
    // Extra object/style references appended after character refs
    if (extraReferences && extraReferences.length > 0) {
        imageParts.push(...extraReferences.map(ref => ({
            inlineData: { data: ref.base64Data, mimeType: ref.mimeType }
        })));
    }

    // Prepare Prompt Text
    const contextHeader = generalContext ? `**Contexto Geral:** ${generalContext}\n\n` : '';

    let sceneReferencePromptPart = '';
    if (sceneReference) {
        sceneReferencePromptPart = `- **Referência de Cena (primeira imagem):** Use-a para manter a continuidade do ambiente, iluminação e estilo visual. As ações e poses nesta imagem são do passado; não as copie.`;
    }

    let characterReferencePromptPart = '';
    if (characterReferences.length > 0) {
        const charInstructions = characterReferences.map((ref) =>
            `*   **[${ref.name}]:** Use a imagem de referência correspondente para replicar sua aparência exata (rosto, cabelo, roupas, etc.).`
        ).join('\n');
        characterReferencePromptPart = `- **Referências de Personagem (imagens seguintes):**\n${charInstructions}`;
    }

    let extraReferencesPromptPart = '';
    if (extraReferences && extraReferences.length > 0) {
        const startIndex = (sceneReference ? 1 : 0) + characterReferences.length + 1;
        const refInstructions = extraReferences.map((_, i) =>
            `*   **[Referência de Objeto ${i + 1} — imagem ${startIndex + i}]:** Incorpore os elementos visuais desta imagem na cena gerada, mantendo consistência de proporção, iluminação e estilo.`
        ).join('\n');
        extraReferencesPromptPart = `- **Referências de Objetos/Estilos Externos (últimas ${extraReferences.length} imagem${extraReferences.length > 1 ? 'ns' : ''}):**\n${refInstructions}`;
        if (blendInstruction && blendInstruction.trim()) {
            extraReferencesPromptPart += `\n  - **Instrução de mesclagem do usuário:** ${blendInstruction.trim()}`;
        }
    }

    const instructionParts = [
        sceneReferencePromptPart,
        characterReferencePromptPart,
        extraReferencesPromptPart,
    ].filter(Boolean);

    const instructionsBlock = instructionParts.length > 0 
        ? `**Instruções de Referência:**\n${instructionParts.join('\n\n')}\n\n` 
        : '';

    let finalPrompt = `${contextHeader}**Sua Tarefa:** Crie uma nova imagem de cena, seguindo as instruções e referências abaixo.

${instructionsBlock}**Descrição da Nova Cena (Ação e Enquadramento):**
> ${prompt}`;

    // === Model Specific Configuration ===
    const config: any = {};
    const parts = [...imageParts];

    if (model === 'gemini-3-pro-image-preview') {
        // For Pro, we use config for aspect ratio
        config.imageConfig = {
            aspectRatio: aspectRatio || "16:9",
            imageSize: resolution
        };
        // Just add the prompt text
        parts.push({ text: finalPrompt });

    } else {
        // For Flash (default), we inject aspect ratio into the prompt text
        const ratioInstruction = getAspectRatioPromptFragment(aspectRatio);
        finalPrompt += `\n\n**Requisito Crítico de Formato:** A imagem final DEVE ter ${ratioInstruction}.`;
        
        config.responseModalities = [Modality.IMAGE];
        parts.push({ text: finalPrompt });
    }

    const response = await callGeminiWithRetry<GenerateContentResponse>(() => getAiClient().models.generateContent({
        model,
        contents: { parts },
        config,
    }));

    // Robust check for image part (works for both models)
    const sceneOutputTokens = response.usageMetadata?.candidatesTokenCount;
    for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
            const costData = sceneOutputTokens ? calcCost(model, sceneOutputTokens) : {};
            return {
                base64Data: part.inlineData.data,
                mimeType: part.inlineData.mimeType,
                ...costData,
            };
        }
    }

    const blockReason = response.promptFeedback?.blockReason;
    if (blockReason) {
      throw new Error(`A geração de imagem com referências foi bloqueada. Motivo: ${blockReason}. Por favor, ajuste o prompt.`);
    }
    const finishReason = response.candidates?.[0]?.finishReason;
    if (finishReason && finishReason !== 'STOP') {
      if (finishReason === 'NO_IMAGE') {
            throw new Error('A IA não conseguiu gerar uma imagem para este prompt. Tente simplificar a descrição da cena ou usar menos personagens de referência.');
        }
      throw new Error(`A geração de imagem com referências falhou. Motivo: ${finishReason}.`);
    }

    throw new Error('A geração de imagem com referências falhou, nenhum dado de imagem foi recebido.');
};

export const editImage = async (base64ImageDataWithPrefix: string, prompt: string, generalContext?: string): Promise<{ base64Data: string; mimeType: string; tokens?: number; costBRL?: number; }> => {
  // Using Flash Image for editing is generally more consistent for instruction-based in-painting in this context
  const model = 'gemini-2.5-flash-image';

  const parts = base64ImageDataWithPrefix.split(',');
  const mimeType = parts[0].match(/:(.*?);/)?.[1] || 'image/png';
  const base64Data = parts[1];

  let finalPrompt = prompt;
  if (generalContext) {
    finalPrompt = `**Contexto Geral:** ${generalContext}\n\n**Tarefa de Edição:** ${prompt}`;
  }

  const response = await callGeminiWithRetry<GenerateContentResponse>(() => getAiClient().models.generateContent({
    model,
    contents: {
      parts: [
        { inlineData: { data: base64Data, mimeType: mimeType } },
        { text: finalPrompt },
      ],
    },
    config: {
      responseModalities: [Modality.IMAGE],
    },
  }));

  const editOutputTokens = response.usageMetadata?.candidatesTokenCount;
  const part = response.candidates?.[0]?.content?.parts[0];
  if (part?.inlineData) {
    const costData = editOutputTokens ? calcCost('gemini-2.5-flash-image', editOutputTokens) : {};
    return {
      base64Data: part.inlineData.data,
      mimeType: part.inlineData.mimeType,
      ...costData,
    };
  }
  throw new Error('A edição de imagem falhou, nenhum dado de imagem foi recebido.');
};

export const isolateCharacter = async (base64ImageDataWithPrefix: string): Promise<{ base64Data: string; mimeType: string; tokens?: number; costBRL?: number; }> => {
  const model = 'gemini-2.5-flash-image';

  const parts = base64ImageDataWithPrefix.split(',');
  const mimeType = parts[0].match(/:(.*?);/)?.[1] || 'image/png';
  const base64Data = parts[1];
  
  const prompt = `CRITICAL INSTRUCTION: Your task is to perform a clean cutout of the main person in the image. Follow these steps precisely: 1. Identify the primary human subject. 2. Completely remove the entire original background. 3. Replace the background with a solid, uniform, light gray color (#d3d3d3). 4. Crop the image to a portrait format, showing only the person from the head to the shoulders. 5. Ensure the subject is perfectly centered in the final image. Do not add any new elements, shadows, or effects. The final output must be just the person on the plain gray background.`;

  const response = await callGeminiWithRetry<GenerateContentResponse>(() => getAiClient().models.generateContent({
    model,
    contents: {
      parts: [
        { inlineData: { data: base64Data, mimeType: mimeType } },
        { text: prompt },
      ],
    },
    config: {
      responseModalities: [Modality.IMAGE],
    },
  }));

  const isolateOutputTokens = response.usageMetadata?.candidatesTokenCount;
  const part = response.candidates?.[0]?.content?.parts[0];
  if (part?.inlineData) {
    const costData = isolateOutputTokens ? calcCost('gemini-2.5-flash-image', isolateOutputTokens) : {};
    return {
      base64Data: part.inlineData.data,
      mimeType: part.inlineData.mimeType,
      ...costData,
    };
  }
  throw new Error('O isolamento do personagem falhou, nenhum dado de imagem foi recebido.');
};

export const analyzeImageText = async (
  base64ImageDataWithPrefix: string,
  originalPrompt: string
): Promise<TextAnalysisResult> => {
  const model = 'gemini-2.5-flash';
  const parts = base64ImageDataWithPrefix.split(',');
  const mimeType = parts[0].match(/:(.*?);/)?.[1] || 'image/png';
  const base64Data = parts[1];

  const prompt = `Você é um revisor e transcritor meticuloso, especialista em português. Sua tarefa é analisar a imagem fornecida, transcrever o texto e verificar se há erros.
1. **Transcreva todo o texto:** Leia atentamente e transcreva todo o texto visível na imagem.
2. **Verifique se há erros:** Examine o texto transcrito em busca de erros ortográficos, gramaticais e de digitação.
3. **Compare com o contexto:** O prompt criativo original para esta imagem foi: '${originalPrompt}'. O texto na imagem reflete corretamente a intenção deste prompt?
4. **Relate suas descobertas em um objeto JSON:**
   - **Sempre** forneça o texto completo que você encontrou no campo 'transcribedText'. Se não houver texto, este campo deve ser uma string vazia.
   - Se você encontrar um erro claro, defina 'errorFound' como true. Preencha 'originalText' com o trecho exato do erro, 'suggestedCorrection' com a sua sugestão e 'explanation' com uma breve explicação.
   - Se o texto parecer correto ou se não houver texto, defina 'errorFound' como false. Os campos 'originalText', 'suggestedCorrection' e 'explanation' podem ser deixados como strings vazias.

Responda APENAS com o objeto JSON.`;

  const response = await callGeminiWithRetry<GenerateContentResponse>(() => getAiClient().models.generateContent({
    model,
    contents: {
      parts: [
        { inlineData: { data: base64Data, mimeType: mimeType } },
        { text: prompt },
      ],
    },
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          errorFound: { type: Type.BOOLEAN },
          transcribedText: { type: Type.STRING, description: 'O texto completo transcrito da imagem.' },
          originalText: { type: Type.STRING, description: 'O texto incorreto encontrado na imagem (se houver).' },
          suggestedCorrection: { type: Type.STRING, description: 'Sua correção sugerida (se houver erro).' },
          explanation: { type: Type.STRING, description: 'Uma breve explicação do erro (se houver).' },
        },
        required: ['errorFound', 'transcribedText'],
      },
    },
  }));
  
  const jsonText = response.text?.trim();
  if (!jsonText) throw new Error("Resposta vazia do modelo.");

  try {
    return JSON.parse(jsonText);
  } catch(e) {
    console.error("Failed to parse JSON from Gemini text analysis:", jsonText);
    throw new Error("Não foi possível analisar o texto da imagem. O modelo retornou um formato inválido.");
  }
};

export const generateSplitPrompts = async (
  originalPrompt: string,
  generalContext: string,
  count: number,
  instructions: string
): Promise<string[]> => {
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

  const response = await callGeminiWithRetry<GenerateContentResponse>(() => getAiClient().models.generateContent({
    model,
    contents: systemPrompt,
  }));

  const text = response.text?.trim() || '';
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('Falha ao gerar sub-prompts para divisão da cena.');

  try {
    const prompts: string[] = JSON.parse(match[0]);
    if (!Array.isArray(prompts) || prompts.length < count) {
      throw new Error('Número insuficiente de sub-prompts gerados.');
    }
    return prompts.slice(0, count);
  } catch {
    throw new Error('Falha ao interpretar os sub-prompts gerados.');
  }
};

export const analyzeUploadedImage = async (
  base64Data: string,
  mimeType: string,
  prompt: string
): Promise<string> => {
  const model = 'gemini-2.5-flash';
  
  const response = await callGeminiWithRetry<GenerateContentResponse>(() => getAiClient().models.generateContent({
    model,
    contents: {
      parts: [
        { inlineData: { data: base64Data, mimeType: mimeType } },
        { text: prompt },
      ],
    },
  }));

  return response.text?.trim() || 'Sem resposta.';
};