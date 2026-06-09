// Constantes de dados estáticos usadas pelo SceneCard.
// Extraídas do componente para reduzir ruído e permitir reuso/teste.

/** Sugestões rápidas para o painel de referência visual. */
export const REF_QUICK_PROMPTS = [
  'Close-up no rosto do personagem',
  'Destaque na mão / objeto em foco',
  'Plano aberto mostrando o ambiente',
  'Ângulo baixo (câmera no chão)',
  'Ângulo alto (visão aérea)',
  'Continuar a cena com mesmo estilo',
  'Detalhe expressão facial',
  'Plano americano (meio corpo)',
];

/** Sugestões de como mesclar uma referência na cena. */
export const REF_BLEND_SUGGESTIONS = [
  'Coloque o objeto no cenário mantendo escala realista',
  'Use o estilo e iluminação da referência',
  'Incorpore o produto em destaque na cena',
  'Mescle o ambiente da referência com os personagens',
];

/** Sugestões de direção criativa ao recriar o prompt de uma cena. */
export const CREATIVE_DIRECTION_SUGGESTIONS = [
  'Mais cinematográfico e dramático',
  'Tom clean e minimalista',
  'Outro ângulo / enquadramento',
  'Paleta de cores mais quente',
  'Mais close e íntimo',
  'Plano aberto, ambiente amplo',
  'Iluminação noturna e contrastada',
  'Estilo ilustração / arte digital',
];

/** Categorias de elementos visuais que podem ser removidos de uma imagem. */
export const REMOVE_VISUAL_OPTIONS = [
  {
    id: 'text',
    label: 'Textos e legendas',
    prompt:
      'Remova completamente textos, letras, números, legendas, placas com texto e qualquer escrita visível da imagem.',
  },
  {
    id: 'logos',
    label: 'Logos e marcas',
    prompt:
      'Remova completamente logotipos, marcas, selos, símbolos comerciais e qualquer branding visível da imagem.',
  },
  {
    id: 'graphics',
    label: 'Gráficos e diagramas',
    prompt:
      'Remova completamente gráficos, diagramas, infográficos, tabelas, ícones explicativos e elementos visuais de apresentação da imagem.',
  },
  {
    id: 'screens',
    label: 'Telas e painéis',
    prompt:
      'Remova completamente telas, janelas, botões, cards, painéis, menus e elementos que pareçam interface digital.',
  },
  {
    id: 'ui',
    label: 'UI, GUI e HUD',
    prompt:
      'Remova completamente interfaces, mockups, app UI, HUD, UI, GUI e qualquer camada de interface sobreposta à cena.',
  },
  {
    id: 'poster',
    label: 'Pôster ou ficha',
    prompt:
      'Remova completamente aparência de pôster, ficha de personagem, capa, layout editorial ou composição gráfica com texto.',
  },
];

/** Prompt combinado que remove todas as categorias visuais de uma vez. */
export const REMOVE_ALL_VISUAL_PROMPT = REMOVE_VISUAL_OPTIONS.map((option) => option.prompt).join(' ');
