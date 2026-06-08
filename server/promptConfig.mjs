/**
 * promptConfig.mjs
 *
 * JSON-based prompt configurations for the storyboard pipeline.
 * Each config is a plain object — easy to read, override, or extend.
 * Builder functions convert configs into final prompt strings.
 */

// ── Default config: storyboard structure ─────────────────────────────────────

export const DEFAULT_STORYBOARD_STRUCTURE_CONFIG = {
  role: 'Você é um diretor de storyboard para vídeos profissionais brasileiros.',
  goal: 'Leia o roteiro e transforme em uma tabela de storyboard. Cada linha deve representar um frame visual gerável por IA.',

  /** Output fields sent to the model. Use {tipo_cena_options} as placeholder. */
  fields: {
    ordem:    'número sequencial global.',
    local:    'local/ambiente visível.',
    locucao:  'narração/voice-over/fala que acompanha a cena. Se não houver, deixe vazio.',
    imagem:   'somente o que se vê na tela. Não copie locução como descrição visual.',
    lettering:'texto exato visível na tela. Se não houver, deixe vazio. Se houver múltiplos letterings em uma mesma CENA numerada, junte-os separados por " / ".',
    tipo_cena:'DERIVE este campo OBRIGATORIAMENTE a partir do conteúdo de "imagem". Use exatamente um de: {tipo_cena_options}. Siga a árvore de decisão abaixo, na ordem (a primeira que casar vence):\n' +
              '  1. "imagem" descreve um logo isolado, marca, vinheta de entrada ou abertura → "Abertura".\n' +
              '  2. "imagem" descreve um logo final, cartão de encerramento, créditos ou call-to-action de saída → "Encerramento".\n' +
              '  3. "imagem" descreve uma passagem gráfica, fade, swipe entre cenas, sem conteúdo narrativo próprio → "Transição".\n' +
              '  4. "imagem" descreve ícones, diagramas, fluxogramas, gráficos, infográficos, tela dividida com elementos abstratos, ilustração vetorial de conceito, dados visualizados, ou animação 2D abstrata → "Motion Graphics".\n' +
              '  5. "imagem" descreve um personagem desenhado, ilustrado, animado, mascote, ou cena claramente em estilo 2D/3D animado → "Animação".\n' +
              '  6. "imagem" descreve um produto isolado, packshot, hero shot de produto, ou objeto em destaque sem pessoa → "Produto".\n' +
              '  7. "imagem" descreve uma entrevista (pessoa falando para a câmera com microfone, set de entrevista, plano fixo de fala) → "Entrevista".\n' +
              '  8. "imagem" descreve um depoimento (pessoa real falando à câmera em ambiente natural, sem set formal) → "Depoimento".\n' +
              '  9. "imagem" descreve uma pessoa real em ação (trabalhando, andando, manipulando objetos, no escritório, na rua, na cozinha) SEM falar à câmera → "B-roll".\n' +
              ' 10. Em qualquer outro caso (cena com locução em off, ambiente ilustrativo, sem categoria mais específica acima) → "Narração".\n' +
              'REGRA NEGATIVA: "Animação" NUNCA se aplica a pessoas reais — só a personagens desenhados/ilustrados/animados. Se a "imagem" diz "empreendedora", "cliente", "personagem feminina" sem qualquer indício de estilo animado, é PESSOA REAL → "B-roll" ou "Narração", nunca "Animação".\n' +
              'REGRA NEGATIVA: "Motion Graphics" só vale quando a "imagem" é dominada por ÍCONES/DIAGRAMAS/DADOS — não use quando a cena tem pessoa real ou produto real, mesmo que tenha algum elemento gráfico secundário.',
  },

  /** Valid values for tipo_cena — drives the directive lookup in scene analysis. */
  tipo_cena_options: [
    'Narração', 'Entrevista', 'B-roll', 'Motion Graphics',
    'Animação', 'Produto', 'Depoimento', 'Abertura', 'Encerramento', 'Transição',
  ],

  /**
   * Rule groups — each group is an independent array.
   * Add, remove, or disable individual rules without touching others.
   */
  rules: {
    /** How to handle numbered CENA markers in the source script. */
    scene_structure: [
      'Se o roteiro tiver CENA numerada (ex: CENA 0, CENA 1, CENA 2...), NUNCA divida uma única CENA em múltiplas linhas. Uma CENA numerada = exatamente uma linha no storyboard, mesmo que tenha múltiplos letterings, conceitos visuais ou beats internos.',
      'Nunca junte duas CENAS numeradas diferentes em uma única linha.',
    ],

    /** When to create additional rows (very conservative). */
    split_conditions: [
      'Crie linhas separadas APENAS para segmentos sem numeração própria onde houver mudança explícita de local físico ou de personagem focal com enquadramento diferente.',
      'NUNCA divida por mudança de lettering isolada ou por múltiplos conceitos dentro de uma CENA numerada.',
    ],

    /** Fidelity to the source IMAGEM: field. */
    content_fidelity: [
      'Se o roteiro tiver o campo "IMAGEM:" explícito, use-o como base fiel do campo "imagem". Preserve a intenção original; adapte apenas para clareza visual sem substituir por descrição inventada.',
      'Se NÃO houver campo "IMAGEM:" explícito, proponha uma imagem concreta que represente visualmente a ideia da locução.',
    ],

    /** General output quality rules. */
    general: [
      'Preserve a ordem narrativa.',
      'Lettering deve ser texto literal, não descrição.',
      'Locução não é personagem.',
      'Cada imagem deve ser clara o bastante para virar um prompt visual sem depender do texto anterior.',
    ],
  },
};

// ── Default config: scene analysis / image prompt ────────────────────────────

export const DEFAULT_SCENE_ANALYSIS_CONFIG = {
  role: 'Você é um diretor de fotografia e especialista em geração de imagens com IA para vídeos profissionais brasileiros.',

  /**
   * Per tipo_cena style directives.
   * Each entry has: framing, aesthetic, content_note.
   * content_note always reinforces that CONTENT follows the visual description —
   * not this directive. Only framing/aesthetic come from here.
   */
  tipo_cena_styles: {
    'Narração': {
      framing:      'plano médio ou close-up do apresentador, ou imagem ambiente que ilustra visualmente a ideia central sem transformar a locução em texto na tela',
      aesthetic:    'clean, profissional, jornalístico ou corporativo conforme o contexto, com leitura imediata do assunto',
      content_note: 'IMPORTANTE: o CONTEÚDO da imagem deve seguir fielmente a "Descrição visual" — esta diretriz define apenas enquadramento e tratamento estético.',
    },
    'Entrevista': {
      framing:      'plano médio ou americano, regra dos terços, entrevistado levemente fora do centro, fundo desfocado (bokeh)',
      aesthetic:    'atmosfera intimista, autêntica, boa iluminação natural ou softbox',
      content_note: 'IMPORTANTE: o CONTEÚDO da imagem deve seguir fielmente a "Descrição visual".',
    },
    'B-roll': {
      framing:      'plano aberto, panorâmico ou detalhe — aquele que melhor cobre a ação/ambiente',
      aesthetic:    'movimento implícito, composição dinâmica. Sem pessoas posando; ação real e ambiente natural',
      content_note: 'IMPORTANTE: o CONTEÚDO da imagem deve seguir fielmente a "Descrição visual"; não substitua personagens ou ambientes.',
    },
    'Motion Graphics': {
      framing:      'composição centrada e equilibrada, hierarquia visual clara, espaço negativo suficiente para leitura de elementos gráficos',
      aesthetic:    'fundo limpo, formas geométricas, ícones ou elementos abstratos coerentes com o tema, paleta de cores coesa e moderna. Sem fotografias realistas.',
      content_note: 'IMPORTANTE: o CONTEÚDO (quais elementos aparecem, quais conceitos são mostrados) deve seguir fielmente a "Descrição visual" — esta diretriz define apenas o estilo gráfico, não inventa novos conteúdos.',
    },
    'Animação': {
      framing:      'composição cinematográfica dentro do estilo de animação escolhido',
      aesthetic:    'estilo ilustrado ou animado, traços artísticos, cores vibrantes (ex: 2D flat, cel-shading, stop-motion feel)',
      content_note: 'IMPORTANTE: o CONTEÚDO da imagem deve seguir fielmente a "Descrição visual".',
    },
    'Produto': {
      framing:      'produto em destaque absoluto, ângulo que valoriza forma e textura',
      aesthetic:    'iluminação de estúdio impecável, fundo neutro ou contextual, sem distrações. Estilo: advertising photography, hero shot.',
      content_note: 'IMPORTANTE: o CONTEÚDO deve seguir fielmente a "Descrição visual".',
    },
    'Depoimento': {
      framing:      'close-up ou plano médio, câmera 85mm portrait feel',
      aesthetic:    'fundo autêntico (home office, sala, ambiente natural), expressão genuína. Iluminação suave.',
      content_note: 'IMPORTANTE: o CONTEÚDO da imagem deve seguir fielmente a "Descrição visual".',
    },
    'Abertura': {
      framing:      'plano geral grandioso, perspectiva baixa, grande angular, ou silhueta dramática',
      aesthetic:    'frame de impacto máximo com presença e autoridade visual',
      content_note: 'IMPORTANTE: o CONTEÚDO deve seguir fielmente a "Descrição visual".',
    },
    'Encerramento': {
      framing:      'pull-back, plano aberto, ou close simbólico',
      aesthetic:    'sensação de conclusão e reflexão. Tom: resolutivo, positivo ou inspirador',
      content_note: 'IMPORTANTE: o CONTEÚDO deve seguir fielmente a "Descrição visual".',
    },
    'Transição': {
      framing:      'frame limpo, minimalista ou abstrato',
      aesthetic:    'desfoque proposital, textura, fundo sólido, ou elemento gráfico de passagem',
      content_note: 'IMPORTANTE: o CONTEÚDO deve seguir fielmente a "Descrição visual".',
    },
  },

  /** Image prompt generation settings. */
  image_prompt: {
    prompt_json_schema: {
      scene_goal: 'intenção dramática/comunicacional da imagem em uma frase',
      visual_style: {
        style_family: 'realista, fotorrealista, 3D/CGI, 2D/animação, motion graphics, ilustração, pintura etc.',
        medium: 'fotografia live-action, render 3D, ilustração 2D, frame de motion graphics, pintura etc.',
        realism_level: 'nível de realismo/estilização',
        style_rules: 'regras objetivas do estilo; incluir proibições quando houver conflito, ex: no anime/no cartoon para cinematográfico',
      },
      action: {
        main_action: 'o que acontece no frame',
        subject_relationship: 'como personagens/objetos se relacionam visualmente. Use null quando não houver múltiplos sujeitos (NUNCA use "N/A")',
        emotional_state: 'estado emocional visível',
      },
      camera: {
        scene_type: 'tipo_cena original do storyboard',
        shot_type: 'posição/tamanho do plano (ex.: Close-up, Insert shot, Wide). Escolha UM valor — não combine "Close-up" + "Insert shot"',
        angle: 'ângulo da câmera',
        lens: 'lente ou sensação ótica',
        framing: 'distribuição/hierarquia dos elementos no quadro. Não repita o shot_type aqui',
        depth_of_field: 'profundidade de campo. Se "shallow", o fundo DEVE ser descrito como suavemente desfocado em set_design — e "no blurry background" NÃO pode aparecer em negative_constraints',
      },
      characters: 'lista de personagens com nome, papel no frame e continuidade visual. Array vazio quando a cena não tem pessoas',
      environment: {
        location: 'local visível',
        time_of_day: 'hora/clima se informado ou inferido com cautela. Seja coerente com lighting.key_light — não diga "bright daylight office" se a luz principal vem da própria tela',
        set_design: 'objetos e cenário obrigatórios',
        atmosphere: 'atmosfera visual',
      },
      lighting: {
        key_light: 'luz principal',
        fill_light: 'preenchimento/ambiente',
        contrast: 'contraste',
        color_temperature: 'temperatura de cor',
      },
      color_texture: {
        palette: 'paleta concisa — 3 a 4 cores concretas (ex.: "navy, off-white, cool grey, accent emerald"). Evite descrições prolixas',
        texture: 'textura',
        finishing: 'acabamento final',
      },
      lettering: {
        has_text: 'true se houver texto visível exigido',
        exact_text: 'texto literal quando houver LETTERING — preserve acentos, casing e pontuação',
        language: 'idioma do texto (ex.: "Portuguese (pt-BR)", "English"). Crucial para o modelo não corromper acentos',
        placement: 'onde o texto aparece',
        text_rules: 'array de regras: preservar grafia exata, não traduzir, não parafrasear, renderizar como tipografia limpa (não manuscrita)',
      },
      required_elements: 'array de elementos visuais que não podem faltar. NÃO repita aqui o texto literal do lettering — ele já está em lettering.exact_text',
      negative_constraints: 'array do que deve ser evitado. REGRA: nunca contradiga escolhas positivas — se shallow DoF foi escolhido, NÃO inclua "no blurry background"; se a cena não tem pessoas, inclua "no people, no hands, no faces"; se for live-action, inclua "no cartoon, no anime, no illustration, no CGI" apenas uma vez',
      output: {
        aspect_ratio_hint: 'proporção pretendida quando conhecida',
        quality: 'direção objetiva de qualidade visual',
      },
    },
    /** Ordered structure fields for the generated English prompt. */
    structure_fields: [
      'Scene goal: intenção dramática/comunicacional que a imagem precisa transmitir',
      'Main subject: personagem, objeto ou ação principal — baseado na Descrição visual',
      'Required visual elements: personagens, objetos, lettering literal e ambiente que NÃO podem faltar',
      'Action: o que acontece no frame — fiel à Descrição visual, sem eventos extras',
      'Environment: local, época, clima, detalhes de produção e objetos narrativos — fiel ao Local e à Descrição visual',
      'Composition: tipo de plano, lente, ângulo, posição dos elementos, hierarquia visual e profundidade',
      'Lighting: fonte de luz, contraste, temperatura, direção da luz e sombras',
      'Color and texture: paleta, acabamento, grão, realismo ou estilo gráfico',
      'Mood: emoção dominante traduzida visualmente',
      'Continuity: manter aparência física, figurino, escala, objetos recorrentes e estilo geral já descritos',
      'Negative constraints: o que deve ser evitado nesta imagem',
    ],
    /** Critical content fidelity rule injected into Task 4. */
    content_rule: 'REGRA CRÍTICA DE CONTEÚDO: Primeiro preserve o conteúdo narrativo obrigatório da Descrição visual; só depois aplique estética, câmera e iluminação. O que aparece na imagem (personagens, objetos, ambiente, ações e lettering) deve ser derivado fielmente da Descrição visual do storyboard. Não invente elementos que contradizem, substituem ou desviam o foco original. A diretriz de tipo de cena define apenas tratamento visual e enquadramento, nunca o conteúdo.',
    word_range: { min: 110, max: 190 },
    language: 'inglês',
  },

  /** End-frame prompt settings (used for video tools). */
  end_frame_prompt: {
    description: 'Prompt em inglês descrevendo o estado FINAL desta cena — após qualquer movimento ou ação. Mesmo local, mesma atmosfera, posição diferente. Para Motion Graphics ou estáticos, descreva um leve zoom-in ou mudança de ângulo.',
    word_range: { min: 40, max: 90 },
  },

  /** Restrictions applied to all generated prompts. */
  restrictions: [
    'Não invente texto na imagem.',
    'Não inclua marcas, logos, UI, botões, interface, legendas falsas ou artefatos gráficos, exceto quando o roteiro pedir LETTERING.',
    'Não transforme narração/locução em personagem.',
    'Não use [LOCUÇÃO], [NARRADOR], [OFF], [V.O.] como personagem.',
    'Ignore marcadores internos como [ref:3], (img 3) ou continuidade da cena anterior.',
    'Não troque o tipo de mídia pedido: se for Motion Graphics, não gere fotografia; se for cena fotorrealista, não transforme em ilustração.',
    'Não use termos genéricos de qualidade como "masterpiece" ou "8K" no lugar de direção visual concreta.',
    'COERÊNCIA: nunca contradiga escolhas positivas em negative_constraints. Exemplos proibidos: "shallow depth_of_field" + "no blurry background"; "real human subjects" + "no people visible"; "warm daylight" + "screen as primary light source". Resolva o conflito antes de escrever.',
    'NÃO duplique informação: o texto literal do lettering vai APENAS em lettering.exact_text. Não repita em required_elements nem em set_design.',
    'Para lettering em português ou outros idiomas não-ingleses, sempre preencha lettering.language com o código do idioma (ex.: "Portuguese (pt-BR)") — modelos de imagem corrompem acentos sem essa dica.',
  ],
};

// ── Builder: storyboard structure prompt ─────────────────────────────────────

/**
 * Converts a StoryboardStructureConfig into the final prompt string.
 * @param {Partial<typeof DEFAULT_STORYBOARD_STRUCTURE_CONFIG>} overrides
 * @param {number} maxRows
 * @returns {string}
 */
export function buildStoryboardStructurePrompt(overrides = {}, maxRows = 200) {
  const c = deepMerge(DEFAULT_STORYBOARD_STRUCTURE_CONFIG, overrides);
  const tipoOptions = (c.tipo_cena_options ?? []).join(', ');

  const fieldsBlock = Object.entries(c.fields)
    .map(([key, desc]) => `- "${key}": ${String(desc).replace('{tipo_cena_options}', tipoOptions)}`)
    .join('\n');

  const rulesBlock = Object.entries(c.rules)
    .flatMap(([, rules]) => (rules ?? []).map(r => `- ${r}`))
    .join('\n');

  return `${c.role}

${c.goal}

Campos:
${fieldsBlock}

Regras:
${rulesBlock}
- Limite a ${maxRows} linhas.

Roteiro:
{script_text}

Responda APENAS com JSON válido.`;
}

// ── Builder: scene analysis prompt ───────────────────────────────────────────

/**
 * Converts a SceneAnalysisConfig + row data into the final prompt string.
 * @param {Partial<typeof DEFAULT_SCENE_ANALYSIS_CONFIG>} overrides
 * @param {object} row  - StoryboardRow fields
 * @param {string} characterBlock
 * @param {string} generalContext
 * @returns {string}
 */
export function buildSceneAnalysisPrompt(overrides = {}, row, characterBlock, generalContext) {
  const c = deepMerge(DEFAULT_SCENE_ANALYSIS_CONFIG, overrides);
  const tipoCena = row.tipo_cena || '';
  const style = c.tipo_cena_styles?.[tipoCena];

  const tipoDirective = style
    ? `Tipo: ${tipoCena.toUpperCase()}.
Enquadramento: ${style.framing}.
Estética: ${style.aesthetic}.
${style.content_note}`
    : `Tipo: ${tipoCena || 'não especificado'}. Use o melhor enquadramento cinematográfico. IMPORTANTE: o CONTEÚDO da imagem deve seguir fielmente a "Descrição visual" acima.`;

  const structureFieldsBlock = (c.image_prompt.structure_fields ?? [])
    .map(f => `- ${f}`)
    .join('\n');
  const promptJsonSchemaBlock = JSON.stringify(c.image_prompt.prompt_json_schema ?? {}, null, 2);

  const restrictionsBlock = (c.restrictions ?? [])
    .map(r => `- ${r}`)
    .join('\n');

  const { min: pMin, max: pMax } = c.image_prompt.word_range;
  const { min: eMin, max: eMax } = c.end_frame_prompt.word_range;
  const lang = c.image_prompt.language;

  return `${c.role}

Analise a linha de storyboard abaixo e execute todas as tarefas.

**Contexto geral do projeto:**
${generalContext || 'Projeto audiovisual profissional.'}

**Linha do storyboard:**
- Tipo de cena: ${row.tipo_cena || '—'}
- Local: ${row.local || '—'}
- Locução (voice-over): ${row.locucao || '—'}
- Descrição visual: ${row.imagem || '—'}
- Lettering/texto em tela: ${row.lettering || '—'}

**Diretriz de tipo de cena:**
${tipoDirective}

**Personagens conhecidos do projeto:**
${characterBlock}

---

**Tarefa 1 — Descrição com tags:**
Reescreva a descrição visual adicionando tags [Nome] apenas para personagens da lista acima. Não invente personagens. "LOCUÇÃO" e "NARRADOR" não são personagens.
IMPORTANTE: NÃO inclua o texto do lettering em "tagged_description". O lettering já é exibido em campo separado — repetir o texto aqui causa duplicação visual. Descreva apenas os elementos visuais da cena (cenário, personagens, ação, atmosfera), nunca o texto literal do lettering.

**Tarefa 2 — Personagens detectados:**
Liste os nomes exatos (da lista acima) que aparecem ou são mencionados. Array vazio se nenhum.

**Tarefa 3 — Intenção visual:**
Defina em uma frase curta o que esta imagem precisa comunicar, antes de pensar em câmera, lente ou estilo. A intenção deve nascer da Descrição visual e da locução, não de elementos inventados.

**Tarefa 4 — Prompt de imagem profissional (em ${lang}):**
Crie primeiro um prompt modular em JSON no campo "prompt_json". Esse JSON é o contrato principal que será enviado ao modelo de imagem. Antes de preencher, siga esta ordem de decisão:
1. Identifique o conteúdo obrigatório da Descrição visual.
2. Defina o sujeito principal e a hierarquia do frame.
3. Escolha composição, lente e ângulo que melhor comunicam a intenção visual.
4. Aplique iluminação, cor e textura coerentes com o contexto.
5. Inclua restrições negativas somente quando elas evitam erro comum.

O campo "prompt_json" deve seguir estes módulos:
${promptJsonSchemaBlock}

Depois, crie também "image_prompt" como uma versão textual em ${lang}, em um único parágrafo, derivada fielmente do prompt_json.

O conteúdo do prompt deve seguir esta estrutura:
${structureFieldsBlock}
- Text rule: se há lettering "${row.lettering}", inclua exatamente esse texto; se não há, proíba texto visível

${c.image_prompt.content_rule}
Se há locução "${row.locucao}", reflita emocionalmente esse conteúdo na imagem sem copiar o texto.
O prompt deve ter entre ${pMin}-${pMax} palavras em ${lang}, em um único parágrafo, sem markdown e sem rótulos como "Main subject:".

**Tarefa 5 — Mood:**
Uma frase curta: o mood/atmosfera da cena (ex: "tenso e sombrio", "inspirador e luminoso").

**Tarefa 6 — Subcena:**
Esta cena precisa de múltiplos frames? "suggests_split": true se sim, false se não. "split_reason" vazio se não precisar.

**Tarefa 7 — Frame final para vídeo:**
${c.end_frame_prompt.description}
Prompt em ${lang} (${eMin}-${eMax} palavras).

Restrições:
${restrictionsBlock}

Responda SOMENTE com objeto JSON válido neste formato:
{
  "tagged_description": "string",
  "detected_characters": ["Nome"],
  "visual_intention": "string",
  "prompt_json": {
    "scene_goal": "string",
    "visual_style": {
      "style_family": "string",
      "medium": "string",
      "realism_level": "string",
      "style_rules": ["string"]
    },
    "action": {
      "main_action": "string",
      "subject_relationship": "string",
      "emotional_state": "string"
    },
    "camera": {
      "scene_type": "string",
      "shot_type": "string",
      "angle": "string",
      "lens": "string",
      "framing": "string",
      "depth_of_field": "string"
    },
    "characters": [{"name": "string", "role_in_frame": "string", "visual_continuity": "string"}],
    "environment": {
      "location": "string",
      "time_of_day": "string",
      "set_design": "string",
      "atmosphere": "string"
    },
    "lighting": {
      "key_light": "string",
      "fill_light": "string",
      "contrast": "string",
      "color_temperature": "string"
    },
    "color_texture": {
      "palette": "string",
      "texture": "string",
      "finishing": "string"
    },
    "lettering": {
      "has_text": false,
      "exact_text": "",
      "language": "",
      "placement": "",
      "text_rules": ["string"]
    },
    "required_elements": ["string"],
    "negative_constraints": ["string"],
    "output": {
      "aspect_ratio_hint": "string",
      "quality": "string"
    }
  },
  "image_prompt": "string",
  "mood": "string",
  "suggests_split": false,
  "split_reason": "",
  "end_frame_prompt": "string"
}`;
}

// ── Utility ───────────────────────────────────────────────────────────────────

/** Shallow-deep merge: top-level keys are merged, nested objects are spread. */
function deepMerge(base, override) {
  if (!override || typeof override !== 'object') return base;
  const result = { ...base };
  for (const [key, val] of Object.entries(override)) {
    if (val && typeof val === 'object' && !Array.isArray(val) && typeof base[key] === 'object') {
      result[key] = { ...base[key], ...val };
    } else {
      result[key] = val;
    }
  }
  return result;
}
