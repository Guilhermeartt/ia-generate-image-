export type SvgTool =
  | 'select'
  | 'rect'
  | 'ellipse'
  | 'line'
  | 'freehand'
  | 'text'
  | 'star'
  | 'triangle';

export interface SvgEditorDocument {
  name: string;
  markup: string;
}

export interface SvgElementProperties {
  id: string;
  tagName: string;
  fill: string;
  stroke: string;
  strokeWidth: number;
  strokeDasharray: string;
  opacity: number;
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  letterSpacing: string;
  textAnchor: string;
  textLength: number | null;
  lengthAdjust: string;
  structuredText: boolean;
  transform: string;
  rotation: number;
  x: number | null;
  y: number | null;
  width: number | null;
  height: number | null;
}

export interface SvgLayer {
  id: string;
  tagName: string;
  label: string;
  depth: number;
  parentId: string | null;
  visible: boolean;
  locked: boolean;
}

export interface SvgCamera {
  x: number;
  y: number;
  zoom: number;
}

/** Parada de cor de um degradê. */
export interface GradientStop {
  /** Posição 0..1 ao longo do degradê. */
  offset: number;
  /** Cor #rrggbb. */
  color: string;
  /** Opacidade 0..1. */
  opacity: number;
}

/** Especificação de um degradê (linear ou radial) aplicado ao preenchimento. */
export interface GradientSpec {
  type: 'linear' | 'radial';
  stops: GradientStop[];
  /** Ângulo em graus (só linear): 0 = →, 90 = ↓. */
  angle: number;
}

/** Papel funcional de um espaço parametrizável dentro de um modelo de cena. */
export type SlotType = 'image' | 'text' | 'icon';

/** Metadados gravados no atributo `data-slot` de um elemento do SVG. */
export interface TemplateSlotMeta {
  type: SlotType;
  name: string;
  /** Animação de entrada/saída do slot. Ausente = sem animação (sempre visível). */
  animation?: import('./slotAnimation').SlotAnimation;
}

/** Slot resolvido: metadados + geometria derivada do elemento marcado. */
export interface TemplateSlot extends TemplateSlotMeta {
  id: string;
  bounds: { x: number; y: number; width: number; height: number };
}
