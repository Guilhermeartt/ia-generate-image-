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
