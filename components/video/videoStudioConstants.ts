import type {
  SceneVideoLettering,
  VideoCgChamferSide,
  VideoClipTransition,
  VideoKenBurnsDirection,
  VideoLetteringStyle,
  VideoLogoPosition,
  VideoTransitionEasing,
} from '@/types';

export const FPS = 30;
export const TEXTAREA_DEBOUNCE_MS = 280;
export const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

export const ASPECT_RATIOS: Record<string, { width: number; height: number; label: string }> = {
  '16:9': { width: 1920, height: 1080, label: '16:9 — Horizontal' },
  '9:16': { width: 1080, height: 1920, label: '9:16 — Vertical' },
  '1:1': { width: 1080, height: 1080, label: '1:1 — Quadrado' },
  '4:3': { width: 1440, height: 1080, label: '4:3 — TV clássico' },
  '3:4': { width: 1080, height: 1440, label: '3:4 — Retrato' },
};

export type TransitionCategory = 'essential' | 'cinematic' | 'dynamic' | 'shapes' | 'graphic';

export interface TransitionOption {
  id: VideoClipTransition;
  label: string;
  shortLabel: string;
  description: string;
  category: TransitionCategory;
  recommendedSeconds: number;
}

export const TRANSITION_CATEGORY_LABELS: Record<TransitionCategory, string> = {
  essential: 'Essenciais',
  cinematic: 'Cinematográficas',
  dynamic: 'Dinâmicas',
  shapes: 'Shapes',
  graphic: 'Gráficas',
};

export const TRANSITION_OPTIONS: ReadonlyArray<TransitionOption> = [
  { id: 'cut', label: 'Corte seco', shortLabel: 'Cut', description: 'Troca instantânea, precisa e neutra.', category: 'essential', recommendedSeconds: 0 },
  { id: 'crossfade', label: 'Crossfade', shortLabel: 'Mix', description: 'Mistura suave e versátil entre planos.', category: 'essential', recommendedSeconds: 0.3 },
  { id: 'fade-black', label: 'Fade para preto', shortLabel: 'Preto', description: 'Marca passagem de tempo ou mudança de capítulo.', category: 'essential', recommendedSeconds: 0.5 },
  { id: 'fade-white', label: 'Fade para branco', shortLabel: 'Branco', description: 'Passagem luminosa, memória ou revelação.', category: 'essential', recommendedSeconds: 0.4 },
  { id: 'blur', label: 'Blur dissolve', shortLabel: 'Blur', description: 'Dissolve atmosférico com desfoque progressivo.', category: 'cinematic', recommendedSeconds: 0.4 },
  { id: 'zoom-blur', label: 'Zoom blur', shortLabel: 'Z Blur', description: 'Travelling óptico com profundidade e desfoque.', category: 'cinematic', recommendedSeconds: 0.45 },
  { id: 'iris', label: 'Iris reveal', shortLabel: 'Iris', description: 'Revela o próximo plano a partir do centro.', category: 'cinematic', recommendedSeconds: 0.55 },
  { id: 'clock-wipe', label: 'Clock wipe', shortLabel: 'Clock', description: 'Varredura radial limpa, inspirada em motion graphics.', category: 'cinematic', recommendedSeconds: 0.6 },
  { id: 'zoom', label: 'Zoom punch', shortLabel: 'Zoom', description: 'Impacto direto com aproximação rápida.', category: 'dynamic', recommendedSeconds: 0.25 },
  { id: 'whip-left', label: 'Whip pan ←', shortLabel: 'Whip ←', description: 'Pan veloz com motion blur para a esquerda.', category: 'dynamic', recommendedSeconds: 0.22 },
  { id: 'whip-right', label: 'Whip pan →', shortLabel: 'Whip →', description: 'Pan veloz com motion blur para a direita.', category: 'dynamic', recommendedSeconds: 0.22 },
  { id: 'shape-diamond', label: 'Shape · Diamante', shortLabel: '◆', description: 'Expansão geométrica em diamante a partir do centro.', category: 'shapes', recommendedSeconds: 0.45 },
  { id: 'shape-hexagon', label: 'Shape · Hexágono', shortLabel: '⬡', description: 'Revelação modular por hexágono expansivo.', category: 'shapes', recommendedSeconds: 0.5 },
  { id: 'shape-star', label: 'Shape · Estrela', shortLabel: '★', description: 'Abertura expressiva em estrela para momentos de destaque.', category: 'shapes', recommendedSeconds: 0.55 },
  { id: 'shape-diagonal', label: 'Shapes · Diagonal colorida', shortLabel: 'Shapes ↗', description: 'Ribbons e formas multicoloridas cruzam o quadro em uma passagem editorial.', category: 'shapes', recommendedSeconds: 0.75 },
  { id: 'slide-left', label: 'Slide ←', shortLabel: 'Slide ←', description: 'Empurra os planos para a esquerda.', category: 'graphic', recommendedSeconds: 0.35 },
  { id: 'slide-right', label: 'Slide →', shortLabel: 'Slide →', description: 'Empurra os planos para a direita.', category: 'graphic', recommendedSeconds: 0.35 },
  { id: 'slide-up', label: 'Slide ↑', shortLabel: 'Slide ↑', description: 'Empurra os planos para cima.', category: 'graphic', recommendedSeconds: 0.35 },
  { id: 'slide-down', label: 'Slide ↓', shortLabel: 'Slide ↓', description: 'Empurra os planos para baixo.', category: 'graphic', recommendedSeconds: 0.35 },
  { id: 'wipe-left', label: 'Wipe ←', shortLabel: 'Wipe ←', description: 'Revelação linear da direita para a esquerda.', category: 'graphic', recommendedSeconds: 0.35 },
  { id: 'wipe-right', label: 'Wipe →', shortLabel: 'Wipe →', description: 'Revelação linear da esquerda para a direita.', category: 'graphic', recommendedSeconds: 0.35 },
  { id: 'wipe-up', label: 'Wipe ↑', shortLabel: 'Wipe ↑', description: 'Revelação linear de baixo para cima.', category: 'graphic', recommendedSeconds: 0.35 },
  { id: 'wipe-down', label: 'Wipe ↓', shortLabel: 'Wipe ↓', description: 'Revelação linear de cima para baixo.', category: 'graphic', recommendedSeconds: 0.35 },
];

export const transitionOptionFor = (id: VideoClipTransition): TransitionOption =>
  TRANSITION_OPTIONS.find(option => option.id === id) ?? TRANSITION_OPTIONS[0];

export const TRANSITION_PRESETS: ReadonlyArray<{
  id: string;
  label: string;
  description: string;
  transition: VideoClipTransition;
  seconds: number;
  easing: VideoTransitionEasing;
}> = [
  { id: 'subtle', label: 'Sutil', description: 'Mistura discreta para narrativa contínua.', transition: 'crossfade', seconds: 0.3, easing: 'ease-in-out' },
  { id: 'cinematic', label: 'Cinema', description: 'Profundidade óptica com acabamento suave.', transition: 'zoom-blur', seconds: 0.45, easing: 'ease-in-out' },
  { id: 'dynamic', label: 'Dinâmico', description: 'Mudança rápida para conteúdo energético.', transition: 'whip-left', seconds: 0.22, easing: 'ease-out' },
  { id: 'editorial', label: 'Editorial', description: 'Revelação gráfica limpa e controlada.', transition: 'iris', seconds: 0.55, easing: 'ease-in-out' },
  { id: 'shapes', label: 'Shapes', description: 'Passagem editorial com ribbons e formas multicoloridas.', transition: 'shape-diagonal', seconds: 0.75, easing: 'ease-in-out' },
];

export const TRANSITION_EASING_OPTIONS: ReadonlyArray<{ id: VideoTransitionEasing; label: string }> = [
  { id: 'ease-in-out', label: 'Ease in-out (suave)' },
  { id: 'ease-out', label: 'Ease out' },
  { id: 'ease-in', label: 'Ease in' },
  { id: 'linear', label: 'Linear' },
];

export const KEN_BURNS_OPTIONS: ReadonlyArray<{ id: VideoKenBurnsDirection; label: string }> = [
  { id: 'none', label: 'Sem efeito' },
  { id: 'zoom-in', label: 'Zoom in' },
  { id: 'zoom-out', label: 'Zoom out' },
  { id: 'pan-left', label: 'Pan ←' },
  { id: 'pan-right', label: 'Pan →' },
  { id: 'pan-up', label: 'Pan ↑' },
  { id: 'pan-down', label: 'Pan ↓' },
];

export const LETTERING_TEMPLATE_PATCH: Record<VideoLetteringStyle, Partial<SceneVideoLettering>> = {
  cinematic: { position: 'bottom', align: 'left', fontWeight: 700, letterSpacing: 0.015, backgroundOpacity: 0, borderRadius: 0 },
  box: { position: 'bottom', align: 'left', fontWeight: 650, letterSpacing: 0, backgroundOpacity: 0.72, borderRadius: 14 },
  clean: { position: 'bottom', align: 'center', fontWeight: 650, letterSpacing: 0, backgroundOpacity: 0, borderRadius: 0 },
  title: { position: 'center', align: 'center', fontWeight: 800, letterSpacing: 0.08, backgroundOpacity: 0, borderRadius: 0 },
  'lower-third': { position: 'bottom', align: 'left', fontWeight: 700, letterSpacing: 0.01, backgroundOpacity: 0.76, borderRadius: 6 },
  glass: { position: 'bottom', align: 'center', fontWeight: 600, letterSpacing: 0.005, backgroundOpacity: 0.28, borderRadius: 20, color: '#ffffff' },
  neon: { position: 'center', align: 'center', fontWeight: 800, letterSpacing: 0.04, backgroundOpacity: 0, borderRadius: 0, color: '#00f0ff' },
  subtitle: { position: 'bottom', align: 'center', fontWeight: 700, letterSpacing: 0, backgroundOpacity: 0, borderRadius: 0, color: '#ffffff' },
  marker: { position: 'center', align: 'center', fontWeight: 800, letterSpacing: 0.01, backgroundOpacity: 0, borderRadius: 0, color: '#0b0b0b' },
  gradient: { position: 'center', align: 'center', fontWeight: 900, letterSpacing: 0.04, backgroundOpacity: 0, borderRadius: 0, color: '#ffffff' },
  outline: { position: 'center', align: 'center', fontWeight: 900, letterSpacing: 0.06, backgroundOpacity: 0, borderRadius: 0, color: '#ffffff' },
  'cg-box': {
    position: 'center', align: 'right', fontWeight: 800, letterSpacing: 0.02,
    backgroundColor: '#16266b', backgroundOpacity: 1, borderRadius: 0, color: '#ffffff',
    chamferSide: 'left', chamferSize: 26,
    logoPosition: 'bottom-right', logoSizePercent: 16,
    offsetXPercent: 0, offsetYPercent: 0,
  },
};

export const CHAMFER_SIDE_OPTIONS: ReadonlyArray<{ id: VideoCgChamferSide; label: string }> = [
  { id: 'none', label: 'Sem chanfro' },
  { id: 'left', label: 'Esquerda' },
  { id: 'right', label: 'Direita' },
  { id: 'top', label: 'Topo' },
  { id: 'bottom', label: 'Base' },
];

export const LOGO_POSITION_OPTIONS: ReadonlyArray<{ id: VideoLogoPosition; label: string }> = [
  { id: 'top-left', label: 'Topo · esquerda' },
  { id: 'top-center', label: 'Topo · centro' },
  { id: 'top-right', label: 'Topo · direita' },
  { id: 'bottom-left', label: 'Base · esquerda' },
  { id: 'bottom-center', label: 'Base · centro' },
  { id: 'bottom-right', label: 'Base · direita' },
];

export type TabId = 'lettering' | 'motion' | 'audio' | 'preview';

export const STORAGE_KEY = 'vs.defaults.v1';
