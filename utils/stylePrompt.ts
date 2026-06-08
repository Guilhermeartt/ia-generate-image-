type PromptStyle = {
  id?: string;
  label?: string;
  promptSuffix?: string;
} | null | undefined;

const PHOTOREALISTIC_STYLE_HINTS = [
  'cinematográfico',
  'cinematografico',
  'documental',
  'publicidade',
  'cinematic photography',
  'documentary photojournalism',
  'commercial photography',
];

const ILLUSTRATION_STYLE_HINTS = [
  'anime',
  'cartoon',
  'animation style',
  'illustration',
  'manga',
  'comic',
  'pixar',
  'disney',
  'dreamworks',
  'ghibli',
  'chibi',
];

const styleText = (style: PromptStyle): string =>
  `${style?.id ?? ''} ${style?.label ?? ''} ${style?.promptSuffix ?? ''}`.toLowerCase();

export const isPhotorealisticStyle = (style: PromptStyle): boolean => {
  const text = styleText(style);
  return PHOTOREALISTIC_STYLE_HINTS.some(hint => text.includes(hint));
};

export const isIllustrationStyle = (style: PromptStyle): boolean => {
  const text = styleText(style);
  return ILLUSTRATION_STYLE_HINTS.some(hint => text.includes(hint));
};

export const buildStyleDirective = (style: PromptStyle): string => {
  if (!style?.promptSuffix) return '';

  if (isPhotorealisticStyle(style)) {
    return [
      'STYLE OVERRIDE: render as live-action photorealistic cinematography with real-world production design.',
      'When humans appear in the scene, they must be real photographed people — never illustrated, stylized, or rendered. When the scene contains NO humans (close-ups of devices, products, environments, motion-graphics inserts), do not invent or add people.',
      'If the source text or character names mention "animação", "animated", "anime", "cartoon", "illustration", "2D", or "3D", treat those words only as script labels or character names, not as the visual style.',
      'Do NOT generate anime, cartoon, cel-shaded, illustrated, CGI, Pixar-like, vector, comic-book, or stylized animation visuals.',
      style.promptSuffix,
    ].join(' ');
  }

  if (isIllustrationStyle(style)) {
    return [
      'STYLE OVERRIDE: render the whole image consistently in the selected illustrated/animated visual style.',
      style.promptSuffix,
    ].join(' ');
  }

  return style.promptSuffix;
};

export const buildSceneAnalysisStyleInstruction = (style: PromptStyle): string => {
  if (!style?.promptSuffix) return '';

  if (isPhotorealisticStyle(style)) {
    return [
      'Estilo visual global escolhido pelo usuário: FOTORREALISTA / CINEMATOGRÁFICO.',
      'Regra prioritária: o prompt de imagem deve descrever uma cena live-action fotorrealista com fotografia cinematográfica real.',
      'Pessoas: quando houver personagens na Descrição visual, retrate-os como pessoas reais fotografadas (nunca ilustração/CGI). Quando NÃO houver pessoas (close em tela, produto, ambiente, motion-graphics insert), NÃO invente pessoas — e adicione "no people, no hands, no faces" às negative_constraints.',
      'Se o storyboard, o tipo da cena ou nomes de personagens mencionarem "Animação", "animated", "anime", "cartoon", "2D", "3D" ou "ilustração", trate isso como rótulo textual do roteiro, não como estética visual.',
      'Não gere prompt com estilo anime, cartoon, ilustração, CGI, cel shading ou personagens desenhados.',
      `Direção estética: ${style.promptSuffix}`,
    ].join(' ');
  }

  if (isIllustrationStyle(style)) {
    return `Estilo visual global escolhido pelo usuário: ${style.label}. O prompt deve seguir esta estética de forma consistente: ${style.promptSuffix}`;
  }

  return `Estilo visual global escolhido pelo usuário: ${style.label}. Direção estética: ${style.promptSuffix}`;
};

export const applyPromptStyle = (prompt: string, style: PromptStyle): string => {
  const directive = buildStyleDirective(style);
  if (!directive) return prompt;
  return `${directive}\n\nSCENE PROMPT:\n${prompt}`;
};
