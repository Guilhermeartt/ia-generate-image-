
import type { AppSettings, StoryboardStructureConfig, SceneAnalysisConfig } from '../types';

export const DEFAULT_PROMPTS: AppSettings = {
  scriptStructuringPrompt: `Você é um supervisor de storyboard e decupagem visual para geração de imagens por IA.

Sua tarefa é converter o roteiro abaixo em uma lista de cenas/subcenas visuais, preservando a narrativa e preparando cada linha para virar uma imagem.

Regras obrigatórias:
- Preserve a ordem exata do roteiro.
- Se o roteiro já tiver CENA numerada (ex: CENA 1, CENA 2, CENA 3), preserve esse número no "scene_id". NUNCA atribua scene_ids diferentes para conteúdo dentro de uma mesma CENA numerada.
- Nunca junte duas CENAS numeradas diferentes na mesma linha.
- Crie subcenas (mesmo scene_id, sub_id diferente) APENAS quando houver mudança explícita de local físico ou personagem focal com enquadramento próprio DENTRO da mesma CENA. Nunca divida por múltiplos letterings ou por múltiplos conceitos dentro de uma CENA — nesses casos, crie uma única subcena que capture todos os elementos.
- Se houver múltiplos letterings em uma CENA, junte-os no "context" separados por " / ".
- Cada linha deve representar UM frame visual gerável.
- Se o roteiro tiver campo "IMAGEM:" explícito, use-o como base fiel do campo "context". Não substitua por descrição inventada diferente. Se não houver campo "IMAGEM:", use a locução para inferir emoção, tema e intenção visual.
- Se houver texto visível na tela, preserve literalmente com o prefixo "LETTERING:".
- Não invente acontecimentos importantes. Inferências de ambiente são permitidas apenas quando necessárias.
- "scene_id" deve ser string numérica começando em 1.
- "sub_id" deve ser string numérica começando em 1 dentro de cada cena.
- "order" deve ser a ordem global, começando em 1.
- "loc" deve descrever local/ambiente visível. Se não existir, inferir com cautela.
- "context" deve conter: ação visual, personagem em foco, objetos importantes, atmosfera, emoção e qualquer lettering.
- "style" é o tipo de plano/câmera. Use apenas um destes valores quando fizer sentido: Close-up, Medium Shot, Wide Shot, Panoramic Shot, American Shot, Detail Shot, High-Angle Shot, Low-Angle Shot, Over-the-Shoulder Shot, POV Shot, Establishing Shot, Aerial/Drone Shot, Macro Shot, Dutch Angle ou vazio.
- Limite a no máximo {max_scenes} linhas.

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
{script_text}

Responda APENAS com JSON válido.`,

  generalContextPrompt: `Analise todo o conteúdo do roteiro fornecido abaixo de um arquivo CSV. Com base em todos os locais e descrições de cena, gere um único parágrafo conciso que resuma o contexto geral. Este contexto deve descrever o cenário geral, o humor dominante, a atmosfera e o estilo visual da história (por exemplo, "Um thriller noir corajoso e encharcado de chuva, ambientado na Nova York dos anos 1940. O clima é tenso e melancólico, com um estilo visual que enfatiza sombras de alto contraste e cores dessaturadas."). Este contexto será usado para guiar todas as gerações de imagens. Responda APENAS com o parágrafo de contexto como uma única string.`,

  characterGenerationPrompt: `Analise o seguinte conteúdo de um roteiro em CSV. Extraia uma lista de todos os personagens únicos. Para cada personagem, forneça seu nome, uma descrição concisa de suas características físicas e o tipo de presença no roteiro.

**Características físicas — REGRAS OBRIGATÓRIAS (siga a ordem):**
1. **Comece SEMPRE pelo gênero/identidade**, como primeira palavra da descrição. Use exatamente um destes rótulos: "Homem", "Mulher", "Menino", "Menina", "Pessoa não-binária". Para não-humanos, use "Personagem masculino", "Personagem feminina" ou "Criatura" + gênero quando aplicável.
2. Em seguida, idade aparente (ex.: "32 anos", "idoso ~70", "criança ~8").
3. Depois, etnia/fenótipo aparente (ex.: "afrodescendente", "asiática", "latina", "branca de traços nórdicos"). Se o roteiro não especificar, infira com diversidade — nunca padronize todos como brancos.
4. Cabelo: cor, comprimento, textura e penteado base.
5. Olhos: cor e formato marcante quando relevante.
6. Pele: tom e textura (ex.: "pele oliva com sardas", "pele negra retinta").
7. Biotipo/estatura: altura aparente e compleição (ex.: "alta e magra", "compacto e musculoso").
8. Traços distintivos: cicatrizes, tatuagens, óculos, barba, piercings, marcas faciais.
9. Figurino base recorrente: a roupa/look mais característico que aparece nas cenas, para manter continuidade visual.
Mantenha tudo em UMA frase ou parágrafo curto, separado por vírgulas, sem rótulos como "Gênero:" ou "Idade:". Exemplo correto: "Mulher, 34 anos, latina, cabelos castanhos longos e ondulados, olhos verdes amendoados, pele oliva, estatura média e porte atlético, pequena cicatriz na sobrancelha esquerda, jaqueta de couro preta e jeans escuro."

**Tipo de personagem:**
- Use "personagem" quando o personagem age, fala, reage ou aparece fisicamente em pelo menos uma cena.
- Use "citado" quando o personagem é apenas mencionado pelo nome em falas ou descrições, mas nunca aparece fisicamente.

**EXCLUSÕES OBRIGATÓRIAS — NUNCA inclua estes como personagens:**
- Termos técnicos de roteiro: LOCUÇÃO, LOC, NARRADOR, NARRADORA, VOICE-OVER, VO, V.O., OFF, NARRAÇÃO, APRESENTADOR (quando for apenas um papel genérico sem nome), REPÓRTER (genérico)
- Rótulos de campo do CSV: "LOCUÇÃO:", "LETTERING:", "IMAGEM:", "TIPO:"
- Se um texto começa com "LOCUÇÃO:" é narração em off, NÃO um personagem.

**Instrução Crítica:** Ao criar as descrições, garanta que o elenco de personagens seja diverso em etnia, idade e aparência geral, a menos que o roteiro especifique o contrário. Seja criativo ao preencher os detalhes que faltam para evitar a criação de personagens que pareçam semelhantes.

Responda SOMENTE com um array JSON.`,

  sceneAnalysisPrompt: `Você é diretor de fotografia, diretor de arte e prompt designer para geração de imagens cinematográficas.

Contexto geral da história:
{general_context}

Personagens conhecidos:
{character_list}

Cena:
Local: {location}
Descrição: {description}

Enquadramento solicitado:
{style_instruction}

Tarefas:
1. Reescreva a descrição da cena com tags [Nome] apenas para personagens existentes na lista.
2. Liste personagens detectados usando nomes exatos da lista.
3. Defina a intenção visual da cena em uma frase curta: o que esta imagem precisa comunicar antes de pensar em câmera, lente ou estilo.
4. Crie um prompt em inglês, pronto para geração de imagem.

Antes de escrever o prompt final, siga esta ordem de decisão:
1. Identifique o conteúdo obrigatório da descrição visual.
2. Defina o sujeito principal e a hierarquia do frame.
3. Escolha composição, lente e ângulo que melhor comunicam a intenção visual.
4. Aplique iluminação, cor e textura coerentes com o contexto.
5. Inclua restrições negativas apenas quando evitam erro comum.

O prompt de imagem deve seguir esta estrutura:
- Scene goal: intenção dramática/comunicacional que a imagem precisa transmitir.
- Main subject: personagem, objeto ou ação principal.
- Required visual elements: personagens, objetos, lettering literal e ambiente que não podem faltar.
- Action: o que está acontecendo no frame.
- Environment: local, época, detalhes de produção e objetos narrativos.
- Composition: tipo de plano, lente, ângulo, hierarquia visual, posição dos personagens e profundidade.
- Lighting: fonte de luz, contraste, temperatura, direção da luz e sombras.
- Color and texture: paleta, acabamento, grão, realismo ou estilo.
- Mood: emoção dominante.
- Continuity: manter aparência dos personagens, figurino, escala, objetos recorrentes e estilo geral.
- Text rule: se houver LETTERING, incluir exatamente o texto informado; se não houver, proibir qualquer texto visível.

Restrições:
- Preserve primeiro o conteúdo narrativo obrigatório; estilo, câmera e iluminação vêm depois.
- Não invente texto na imagem.
- Não inclua marcas, logos, UI, botões, interface, legendas falsas ou artefatos gráficos, exceto quando o roteiro pedir LETTERING.
- Não transforme narração/locução em personagem.
- Não use [LOCUÇÃO], [NARRADOR], [OFF], [V.O.] como personagem.
- Ignore marcadores internos como [ref:3], (img 3) ou continuidade da cena anterior.
- Não troque o tipo de mídia pedido: se for Motion Graphics, não gere fotografia; se for cena fotorrealista, não transforme em ilustração.
- Não use termos genéricos de qualidade como "masterpiece" ou "8K" no lugar de direção visual concreta.
- O prompt final deve ter entre 110 e 190 palavras em inglês, em um único parágrafo, sem markdown e sem rótulos como "Main subject:".
- Se houver lettering, preserve APENAS no image_prompt com prefixo "LETTERING:". NÃO repita o texto do lettering em tagged_description — esse campo deve descrever somente os elementos visuais da cena.

Também gere:
- mood: frase curta em português.
- suggests_split: true se a cena tiver mais de um momento visual forte.
- split_reason: motivo curto ou vazio.
- end_frame_prompt: prompt em inglês de 40 a 90 palavras descrevendo o estado final da ação para vídeo.

Responda SOMENTE com JSON:
{
  "tagged_description": "",
  "detected_characters": [],
  "visual_intention": "",
  "image_prompt": "",
  "mood": "",
  "suggests_split": false,
  "split_reason": "",
  "end_frame_prompt": ""
}`,

  characterImagePrompt: `Retrato fotorrealista de altíssima qualidade de uma única pessoa. Detalhes do personagem: {physical_characteristics}. A pessoa deve estar centralizada no quadro. Estilo: iluminação cinematográfica e natural, foco nítido no personagem, fundo sutil e levemente desfocado que complementa o personagem sem distrair. Qualidade: nível de fotografia profissional, com atenção a detalhes como textura da pele, cabelo e olhos.

Restrições obrigatórias: a imagem deve conter apenas o personagem e um fundo fotográfico simples. Não incluir textos, letras, legendas, números, logotipos, marcas, gráficos, diagramas, infográficos, telas, janelas, botões, cards, painéis, interfaces, mockups, elementos de aplicativo, HUD, UI ou GUI. Não criar pôster, ficha de personagem, capa, layout editorial ou composição com texto. Crítico: Sem desenhos, sem renderizações 3D, sem elementos de fantasia ou artefatos de IA. A imagem DEVE ter uma proporção estrita de 1:1 (quadrada).`,

  // ── JSON configs for the storyboard pipeline ─────────────────────────────
  storyboardStructureConfig: {
    role: 'Você é um diretor de storyboard para vídeos profissionais brasileiros.',
    goal: 'Leia o roteiro e transforme em uma tabela de storyboard. Cada linha deve representar um frame visual gerável por IA.',
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
    tipo_cena_options: [
      'Narração', 'Entrevista', 'B-roll', 'Motion Graphics',
      'Animação', 'Produto', 'Depoimento', 'Abertura', 'Encerramento', 'Transição',
    ],
    rules: {
      scene_structure: [
        'Se o roteiro tiver CENA numerada (ex: CENA 0, CENA 1, CENA 2...), NUNCA divida uma única CENA em múltiplas linhas. Uma CENA numerada = exatamente uma linha no storyboard, mesmo que tenha múltiplos letterings, conceitos visuais ou beats internos.',
        'Nunca junte duas CENAS numeradas diferentes em uma única linha.',
      ],
      split_conditions: [
        'Crie linhas separadas APENAS para segmentos sem numeração própria onde houver mudança explícita de local físico ou de personagem focal com enquadramento diferente.',
        'NUNCA divida por mudança de lettering isolada ou por múltiplos conceitos dentro de uma CENA numerada.',
      ],
      content_fidelity: [
        'Se o roteiro tiver o campo "IMAGEM:" explícito, use-o como base fiel do campo "imagem". Preserve a intenção original; adapte apenas para clareza visual sem substituir por descrição inventada.',
        'Se NÃO houver campo "IMAGEM:" explícito, proponha uma imagem concreta que represente visualmente a ideia da locução.',
      ],
      general: [
        'Preserve a ordem narrativa.',
        'Lettering deve ser texto literal, não descrição.',
        'Locução não é personagem.',
        'Cada imagem deve ser clara o bastante para virar um prompt visual sem depender do texto anterior.',
      ],
    },
  } satisfies StoryboardStructureConfig,

  sceneAnalysisConfig: {
    role: 'Você é um diretor de fotografia e especialista em geração de imagens com IA para vídeos profissionais brasileiros.',
    tipo_cena_styles: {
      'Narração':       { framing: 'plano médio ou close-up do apresentador, ou imagem ambiente que ilustra visualmente a ideia central sem transformar a locução em texto na tela', aesthetic: 'clean, profissional, jornalístico ou corporativo conforme o contexto, com leitura imediata do assunto', content_note: 'IMPORTANTE: o CONTEÚDO da imagem deve seguir fielmente a "Descrição visual" — esta diretriz define apenas enquadramento e tratamento estético.' },
      'Entrevista':     { framing: 'plano médio ou americano, regra dos terços, entrevistado levemente fora do centro, fundo desfocado (bokeh)', aesthetic: 'atmosfera intimista, autêntica, boa iluminação natural ou softbox', content_note: 'IMPORTANTE: o CONTEÚDO da imagem deve seguir fielmente a "Descrição visual".' },
      'B-roll':         { framing: 'plano aberto, panorâmico ou detalhe — aquele que melhor cobre a ação/ambiente', aesthetic: 'movimento implícito, composição dinâmica. Sem pessoas posando; ação real e ambiente natural', content_note: 'IMPORTANTE: o CONTEÚDO da imagem deve seguir fielmente a "Descrição visual"; não substitua personagens ou ambientes.' },
      'Motion Graphics':{ framing: 'composição centrada e equilibrada, hierarquia visual clara, espaço negativo suficiente para leitura de elementos gráficos', aesthetic: 'fundo limpo, formas geométricas, ícones ou elementos abstratos coerentes com o tema, paleta de cores coesa e moderna. Sem fotografias realistas.', content_note: 'IMPORTANTE: o CONTEÚDO (quais elementos aparecem, quais conceitos são mostrados) deve seguir fielmente a "Descrição visual" — esta diretriz define apenas o estilo gráfico, não inventa novos conteúdos.' },
      'Animação':       { framing: 'composição cinematográfica dentro do estilo de animação escolhido', aesthetic: 'estilo ilustrado ou animado, traços artísticos, cores vibrantes (ex: 2D flat, cel-shading, stop-motion feel)', content_note: 'IMPORTANTE: o CONTEÚDO da imagem deve seguir fielmente a "Descrição visual".' },
      'Produto':        { framing: 'produto em destaque absoluto, ângulo que valoriza forma e textura', aesthetic: 'iluminação de estúdio impecável, fundo neutro ou contextual, sem distrações. Estilo: advertising photography, hero shot.', content_note: 'IMPORTANTE: o CONTEÚDO deve seguir fielmente a "Descrição visual".' },
      'Depoimento':     { framing: 'close-up ou plano médio, câmera 85mm portrait feel', aesthetic: 'fundo autêntico (home office, sala, ambiente natural), expressão genuína. Iluminação suave.', content_note: 'IMPORTANTE: o CONTEÚDO da imagem deve seguir fielmente a "Descrição visual".' },
      'Abertura':       { framing: 'plano geral grandioso, perspectiva baixa, grande angular, ou silhueta dramática', aesthetic: 'frame de impacto máximo com presença e autoridade visual', content_note: 'IMPORTANTE: o CONTEÚDO deve seguir fielmente a "Descrição visual".' },
      'Encerramento':   { framing: 'pull-back, plano aberto, ou close simbólico', aesthetic: 'sensação de conclusão e reflexão. Tom: resolutivo, positivo ou inspirador', content_note: 'IMPORTANTE: o CONTEÚDO deve seguir fielmente a "Descrição visual".' },
      'Transição':      { framing: 'frame limpo, minimalista ou abstrato', aesthetic: 'desfoque proposital, textura, fundo sólido, ou elemento gráfico de passagem', content_note: 'IMPORTANTE: o CONTEÚDO deve seguir fielmente a "Descrição visual".' },
    },
    image_prompt: {
      prompt_json_schema: {
        scene_goal: 'intenção dramática/comunicacional da imagem em uma frase',
        visual_style: {
          style_family: 'realista, fotorrealista, 3D/CGI, 2D/animação, motion graphics, ilustração, pintura etc.',
          medium: 'fotografia live-action, render 3D, ilustração 2D, frame de motion graphics, pintura etc.',
          realism_level: 'nível de realismo/estilização',
          style_rules: 'regras objetivas do estilo; incluir proibições quando houver conflito',
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
      structure_fields: [
        'Scene goal: intenção dramática/comunicacional que a imagem precisa transmitir',
        'Main subject: personagem, objeto ou ação principal — baseado na Descrição visual',
        'Required visual elements: personagens, objetos, lettering literal e ambiente que NÃO podem faltar',
        'Action: o que acontece no frame — fiel à Descrição visual',
        'Environment: local, época, clima, detalhes de produção e objetos narrativos — fiel ao Local e à Descrição visual',
        'Composition: tipo de plano, lente, ângulo, posição dos elementos, hierarquia visual e profundidade',
        'Lighting: fonte de luz, contraste, temperatura, direção da luz e sombras',
        'Color and texture: paleta, acabamento, grão, realismo ou estilo',
        'Mood: emoção dominante traduzida visualmente',
        'Continuity: manter aparência física, figurino, escala, objetos recorrentes e estilo geral já descritos',
        'Negative constraints: o que deve ser evitado nesta imagem',
      ],
      content_rule: 'REGRA CRÍTICA DE CONTEÚDO: Primeiro preserve o conteúdo narrativo obrigatório da Descrição visual; só depois aplique estética, câmera e iluminação. O que aparece na imagem (personagens, objetos, ambiente, ações e lettering) deve ser derivado fielmente da Descrição visual do storyboard. Não invente elementos que contradizem, substituem ou desviam o foco original. A diretriz de tipo de cena define apenas tratamento visual e enquadramento, nunca o conteúdo.',
      word_range: { min: 110, max: 190 },
      language: 'inglês',
    },
    end_frame_prompt: {
      description: 'Prompt em inglês descrevendo o estado FINAL desta cena — após qualquer movimento ou ação. Mesmo local, mesma atmosfera, posição diferente. Para Motion Graphics ou estáticos, descreva um leve zoom-in ou mudança de ângulo.',
      word_range: { min: 40, max: 90 },
    },
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
  } satisfies SceneAnalysisConfig,
};
