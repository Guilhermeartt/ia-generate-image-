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
  x: number | null;
  y: number | null;
  width: number | null;
  height: number | null;
}

export interface SvgLayer {
  id: string;
  tagName: string;
  label: string;
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
