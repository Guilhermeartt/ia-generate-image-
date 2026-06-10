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

export const TRANSITION_OPTIONS: ReadonlyArray<{ id: VideoClipTransition; label: string }> = [
  { id: 'cut', label: 'Corte seco' },
  { id: 'crossfade', label: 'Crossfade' },
  { id: 'fade-black', label: 'Fade para preto' },
  { id: 'fade-white', label: 'Fade para branco' },
  { id: 'blur', label: 'Blur dissolve' },
  { id: 'zoom', label: 'Zoom punch' },
  { id: 'slide-left', label: 'Slide ←' },
  { id: 'slide-right', label: 'Slide →' },
  { id: 'slide-up', label: 'Slide ↑' },
  { id: 'slide-down', label: 'Slide ↓' },
  { id: 'wipe-left', label: 'Wipe ←' },
  { id: 'wipe-right', label: 'Wipe →' },
  { id: 'wipe-up', label: 'Wipe ↑' },
  { id: 'wipe-down', label: 'Wipe ↓' },
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
