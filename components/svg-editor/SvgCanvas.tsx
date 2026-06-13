import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { SvgCamera, SvgTool } from './types';
import { appendSvgElement, updateSvgElement } from './svgDocument';
import { nearestInsertion, parsePolyline, serializePolyline, type PathPoint } from './svgPath';

interface SvgCanvasProps {
  markup: string;
  tool: SvgTool;
  selectedId: string | null;
  viewBox: { width: number; height: number } | null;
  camera: SvgCamera;
  onCameraChange: (camera: SvgCamera) => void;
  snapToGrid: boolean;
  showSafeArea: boolean;
  onSelect: (id: string | null) => void;
  onPointerPosition: (point: { x: number; y: number } | null) => void;
  onCommit: (before: string, after: string, label: string, selectedId?: string) => void;
}

interface Point {
  x: number;
  y: number;
}

interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Gesture {
  kind:
    | 'move'
    | 'resize'
    | 'rotate'
    | 'rect'
    | 'ellipse'
    | 'line'
    | 'freehand'
    | 'star'
    | 'triangle'
    | 'node';
  before: string;
  start: Point;
  id: string;
  points: Point[];
  corner?: number;
  bounds?: Bounds;
  originalMatrix?: DOMMatrix;
  parentInverse?: DOMMatrix;
  elementInverse?: DOMMatrix;
  center?: Point;
  centerScreen?: Point;
  startAngle?: number;
  /** Índice do nó (âncora) sendo arrastado, para kind === 'node'. */
  nodeIndex?: number;
  /** Pontos do path no início do arrasto de nó, em coords locais. */
  pathPoints?: PathPoint[];
  pathClosed?: boolean;
}

/** Caneta em andamento (desenho clique-a-clique). */
interface PenState {
  id: string;
  points: PathPoint[];
}

const EDITABLE_SELECTOR =
  'g[id],path[id],rect[id],circle[id],ellipse[id],line[id],polyline[id],polygon[id],text[id],image[id]';

const starPath = (center: Point, radius: number): string =>
  Array.from({ length: 10 }, (_, index) => {
    const currentRadius = index % 2 === 0 ? radius : radius * 0.45;
    const angle = (index * Math.PI) / 5 - Math.PI / 2;
    return `${index === 0 ? 'M' : 'L'} ${(center.x + currentRadius * Math.cos(angle)).toFixed(2)} ${(center.y + currentRadius * Math.sin(angle)).toFixed(2)}`;
  }).join(' ') + ' Z';

const trianglePath = (start: Point, point: Point): string => {
  const minX = Math.min(start.x, point.x);
  const minY = Math.min(start.y, point.y);
  const width = Math.max(2, Math.abs(point.x - start.x));
  const height = Math.max(2, Math.abs(point.y - start.y));
  return `M ${minX + width / 2} ${minY} L ${minX + width} ${minY + height} L ${minX} ${minY + height} Z`;
};

/**
 * Aplica uma geometria padrão a uma forma recém-criada quando o usuário só
 * clicou (ou arrastou de menos). O tamanho é proporcional ao quadro e o centro
 * é "grudado" dentro da área visível, então um clique em qualquer lugar — até
 * nas zonas mortas fora do quadro — gera uma forma visível e dentro dele.
 */
const applyDefaultShape = (
  element: SVGGraphicsElement,
  kind: Gesture['kind'],
  center: Point,
  dims: { width: number; height: number },
): boolean => {
  const W = dims.width;
  const H = dims.height;
  const fit = (value: number, min: number, max: number) =>
    min >= max ? (min + max) / 2 : Math.min(Math.max(value, min), max);

  if (kind === 'rect') {
    const w = W * 0.22;
    const h = H * 0.22;
    const cx = fit(center.x, w / 2, W - w / 2);
    const cy = fit(center.y, h / 2, H - h / 2);
    element.setAttribute('x', String(cx - w / 2));
    element.setAttribute('y', String(cy - h / 2));
    element.setAttribute('width', String(w));
    element.setAttribute('height', String(h));
  } else if (kind === 'ellipse') {
    const rx = W * 0.11;
    const ry = H * 0.11;
    element.setAttribute('cx', String(fit(center.x, rx, W - rx)));
    element.setAttribute('cy', String(fit(center.y, ry, H - ry)));
    element.setAttribute('rx', String(rx));
    element.setAttribute('ry', String(ry));
  } else if (kind === 'line') {
    const half = W * 0.13;
    const cx = fit(center.x, half, W - half);
    const cy = fit(center.y, 0, H);
    element.setAttribute('x1', String(cx - half));
    element.setAttribute('y1', String(cy));
    element.setAttribute('x2', String(cx + half));
    element.setAttribute('y2', String(cy));
  } else if (kind === 'star') {
    const radius = Math.min(W, H) * 0.13;
    element.setAttribute(
      'd',
      starPath({ x: fit(center.x, radius, W - radius), y: fit(center.y, radius, H - radius) }, radius),
    );
  } else if (kind === 'triangle') {
    const halfW = W * 0.11;
    const halfH = H * 0.13;
    const cx = fit(center.x, halfW, W - halfW);
    const cy = fit(center.y, halfH, H - halfH);
    element.setAttribute(
      'd',
      trianglePath({ x: cx - halfW, y: cy - halfH }, { x: cx + halfW, y: cy + halfH }),
    );
  } else {
    // freehand: clique único não desenha nada.
    element.remove();
    return false;
  }
  return true;
};

const matrixString = (matrix: DOMMatrix): string =>
  `matrix(${matrix.a} ${matrix.b} ${matrix.c} ${matrix.d} ${matrix.e} ${matrix.f})`;

const pointThrough = (point: Point, matrix: DOMMatrix): Point => {
  const transformed = new DOMPoint(point.x, point.y).matrixTransform(matrix);
  return { x: transformed.x, y: transformed.y };
};

const vectorThrough = (vector: Point, matrix: DOMMatrix): Point => ({
  x: vector.x * matrix.a + vector.y * matrix.c,
  y: vector.x * matrix.b + vector.y * matrix.d,
});

const TRANSFORM_EPSILON = 1e-4;

/**
 * "Achata" um transform de translate/escala na própria geometria do elemento
 * (x/y/width/height, cx/cy/rx/ry, pontos da linha, font-size do texto) e remove
 * o atributo `transform`. Mantém o transform quando há rotação/cisalhamento (não
 * dá para representar isso na geometria de uma forma alinhada aos eixos) e para
 * formas baseadas em path/grupo/imagem. Mantém canvas e painel em sincronia.
 */
const bakeTransform = (element: SVGGraphicsElement): void => {
  const consolidated = element.transform.baseVal.consolidate();
  if (!consolidated) return;
  const m = consolidated.matrix;
  if (Math.abs(m.b) > TRANSFORM_EPSILON || Math.abs(m.c) > TRANSFORM_EPSILON) return;

  const sx = m.a;
  const sy = m.d;
  const tx = m.e;
  const ty = m.f;
  const num = (name: string) => Number.parseFloat(element.getAttribute(name) || '0') || 0;
  const set = (name: string, value: number) =>
    element.setAttribute(name, String(Math.round(value * 100) / 100));

  switch (element.localName) {
    case 'rect':
      set('x', sx * num('x') + tx);
      set('y', sy * num('y') + ty);
      set('width', Math.abs(sx) * num('width'));
      set('height', Math.abs(sy) * num('height'));
      if (element.hasAttribute('rx')) set('rx', Math.abs(sx) * num('rx'));
      if (element.hasAttribute('ry')) set('ry', Math.abs(sy) * num('ry'));
      break;
    case 'ellipse':
      set('cx', sx * num('cx') + tx);
      set('cy', sy * num('cy') + ty);
      set('rx', Math.abs(sx) * num('rx'));
      set('ry', Math.abs(sy) * num('ry'));
      break;
    case 'circle':
      set('cx', sx * num('cx') + tx);
      set('cy', sy * num('cy') + ty);
      set('r', Math.abs(sx) * num('r'));
      break;
    case 'line':
      set('x1', sx * num('x1') + tx);
      set('y1', sy * num('y1') + ty);
      set('x2', sx * num('x2') + tx);
      set('y2', sy * num('y2') + ty);
      break;
    case 'text':
      set('x', sx * num('x') + tx);
      set('y', sy * num('y') + ty);
      if (Math.abs(sy - 1) > TRANSFORM_EPSILON) {
        set('font-size', (Number.parseFloat(element.getAttribute('font-size') || '16') || 16) * Math.abs(sy));
      }
      break;
    default:
      return; // path / g / image: mantém o transform
  }
  element.removeAttribute('transform');
};

// O documento (SVG vivo) é renderizado num componente memoizado pela string do
// markup. Durante um gesto, o SvgCanvas re-renderiza várias vezes (posição do
// ponteiro, retângulo de seleção), mas o markup NÃO muda — então o React.memo
// pula este div e não reconcilia o innerHTML. Sem isso, o re-render apagava a
// mutação imperativa do gesto (transform), fazendo a forma "piscar" na posição
// anterior e o move não ser aplicado no commit.
const SvgDocument = React.memo(
  React.forwardRef<HTMLDivElement, { markup: string }>(function SvgDocument({ markup }, ref) {
    return (
      <div ref={ref} className="svg-editor-document" dangerouslySetInnerHTML={{ __html: markup }} />
    );
  }),
);

const SvgCanvas: React.FC<SvgCanvasProps> = ({
  markup,
  tool,
  selectedId,
  viewBox,
  camera,
  onCameraChange,
  snapToGrid,
  showSafeArea,
  onSelect,
  onPointerPosition,
  onCommit,
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const penRef = useRef<PenState | null>(null);
  const spacePressedRef = useRef(false);
  const panRef = useRef<{ start: Point; camera: SvgCamera } | null>(null);
  const [viewport, setViewport] = useState({ width: 1, height: 1 });
  const [selectionRect, setSelectionRect] = useState<DOMRect | null>(null);
  const [nodeHandles, setNodeHandles] = useState<Point[]>([]);
  const [isPanning, setIsPanning] = useState(false);

  const dimensions = viewBox ?? { width: 1280, height: 720 };
  const fitScale = Math.max(
    0.01,
    Math.min((viewport.width - 40) / dimensions.width, (viewport.height - 40) / dimensions.height),
  );
  const renderedScale = fitScale * camera.zoom;

  const getSvg = useCallback(
    () => hostRef.current?.querySelector<SVGSVGElement>('svg') ?? null,
    [],
  );

  const toSvgPoint = useCallback(
    (clientX: number, clientY: number): Point | null => {
      const matrix = getSvg()?.getScreenCTM();
      if (!matrix) return null;
      return pointThrough({ x: clientX, y: clientY }, matrix.inverse());
    },
    [getSvg],
  );

  const refreshSelection = useCallback(() => {
    const canvas = canvasRef.current;
    const selected = selectedId
      ? hostRef.current?.querySelector<SVGGraphicsElement>(`#${CSS.escape(selectedId)}`)
      : null;
    if (!canvas || !selected || selected.getAttribute('display') === 'none') {
      setSelectionRect(null);
      return;
    }
    const elementRect = selected.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    setSelectionRect(
      new DOMRect(
        elementRect.left - canvasRect.left,
        elementRect.top - canvasRect.top,
        elementRect.width,
        elementRect.height,
      ),
    );
  }, [selectedId]);

  // Path poligonal selecionado (M/L/Z) quando a ferramenta de nós está ativa.
  const getEditablePath = useCallback((): SVGGraphicsElement | null => {
    if (tool !== 'nodes' || !selectedId) return null;
    const element = hostRef.current?.querySelector<SVGGraphicsElement>(`#${CSS.escape(selectedId)}`);
    if (!element || element.localName !== 'path') return null;
    return parsePolyline(element.getAttribute('d') || '') ? element : null;
  }, [tool, selectedId]);

  const refreshNodes = useCallback(() => {
    const canvas = canvasRef.current;
    const path = getEditablePath();
    const ctm = path?.getScreenCTM();
    if (!canvas || !path || !ctm) {
      setNodeHandles([]);
      return;
    }
    const parsed = parsePolyline(path.getAttribute('d') || '');
    if (!parsed) {
      setNodeHandles([]);
      return;
    }
    const canvasRect = canvas.getBoundingClientRect();
    setNodeHandles(
      parsed.points.map((point) => {
        const screen = pointThrough(point, ctm);
        return { x: screen.x - canvasRect.left, y: screen.y - canvasRect.top };
      }),
    );
  }, [getEditablePath]);

  useLayoutEffect(refreshSelection, [markup, camera, viewport, refreshSelection]);
  useLayoutEffect(refreshNodes, [markup, camera, viewport, refreshNodes]);

  // Sair da caneta encerra o desenho em andamento.
  useEffect(() => {
    if (tool !== 'pen') penRef.current = null;
  }, [tool]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(([entry]) => {
      setViewport({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(canvas);
    void document.fonts?.ready.then(refreshSelection);
    return () => observer.disconnect();
  }, [refreshSelection]);

  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      if (
        event.code === 'Space' &&
        !(event.target as HTMLElement | null)?.matches('input,textarea')
      ) {
        spacePressedRef.current = true;
        event.preventDefault();
      }
    };
    const keyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') spacePressedRef.current = false;
    };
    window.addEventListener('keydown', keyDown);
    window.addEventListener('keyup', keyUp);
    return () => {
      window.removeEventListener('keydown', keyDown);
      window.removeEventListener('keyup', keyUp);
    };
  }, []);

  const serializeCanvas = (): string | null => {
    const svg = getSvg();
    return svg ? new XMLSerializer().serializeToString(svg) : null;
  };

  const snapPoint = (point: Point): Point =>
    snapToGrid ? { x: Math.round(point.x / 10) * 10, y: Math.round(point.y / 10) * 10 } : point;

  // Caneta: adiciona uma âncora; fecha o path ao clicar perto do primeiro ponto.
  // Usa o DOM vivo como fonte de verdade (robusto a cliques rápidos, antes do
  // re-render do React atualizar a prop `markup`).
  const addPenPoint = (point: Point) => {
    const svg = getSvg();
    if (!svg) return;
    const before = serializeCanvas() ?? markup;
    const pen = penRef.current;
    if (!pen) {
      const appended = appendSvgElement(before, 'path', {
        d: `M ${point.x} ${point.y}`,
        fill: 'none',
        stroke: '#534ab7',
        'stroke-width': 2,
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
      });
      const created = new DOMParser()
        .parseFromString(appended.markup, 'image/svg+xml')
        .getElementById(appended.id);
      if (created) svg.appendChild(document.importNode(created, true));
      onCommit(before, appended.markup, 'Caneta', appended.id);
      penRef.current = { id: appended.id, points: [point] };
      return;
    }
    const live = svg.querySelector<SVGGraphicsElement>(`#${CSS.escape(pen.id)}`);
    if (!live) {
      penRef.current = null;
      return;
    }
    const first = pen.points[0];
    const closing =
      pen.points.length >= 2 &&
      Math.hypot(point.x - first.x, point.y - first.y) <
        Math.min(dimensions.width, dimensions.height) * 0.018;
    const points = closing ? pen.points : [...pen.points, point];
    live.setAttribute('d', serializePolyline(points, closing));
    const after = serializeCanvas();
    if (after) onCommit(before, after, 'Caneta', pen.id);
    penRef.current = closing ? null : { id: pen.id, points };
  };

  const handleDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (tool === 'nodes' && target.dataset.node !== undefined) {
      const path = getEditablePath();
      const parsed = path && parsePolyline(path.getAttribute('d') || '');
      if (path && parsed && parsed.points.length > 2) {
        const next = parsed.points.filter((_, index) => index !== Number(target.dataset.node));
        onCommit(
          markup,
          updateSvgElement(markup, path.id, { d: serializePolyline(next, parsed.closed) }),
          'Remover nó',
          path.id,
        );
      }
      return;
    }
    if (tool === 'pen') penRef.current = null;
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button === 1 || spacePressedRef.current) {
      panRef.current = {
        start: { x: event.clientX, y: event.clientY },
        camera,
      };
      setIsPanning(true);
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    if (event.button !== 0) return;
    const rawPoint = toSvgPoint(event.clientX, event.clientY);
    if (!rawPoint) return;
    const point = snapPoint(rawPoint);
    const target = event.target as HTMLElement;
    const resizeCorner = target.dataset.resize;
    const rotateHandle = target.dataset.rotate;
    const selected = selectedId
      ? hostRef.current?.querySelector<SVGGraphicsElement>(`#${CSS.escape(selectedId)}`)
      : null;

    if ((resizeCorner || rotateHandle) && selected) {
      const bounds = selected.getBBox();
      const matrix = selected.transform.baseVal.consolidate()?.matrix;
      const originalMatrix = matrix
        ? new DOMMatrix([matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f])
        : new DOMMatrix();
      const elementScreen = selected.getScreenCTM();
      if (!elementScreen) return;
      const centerLocal = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
      const centerScreen = pointThrough(centerLocal, elementScreen);
      gestureRef.current = {
        kind: rotateHandle ? 'rotate' : 'resize',
        before: markup,
        start: { x: event.clientX, y: event.clientY },
        id: selectedId!,
        points: [],
        corner: resizeCorner ? Number(resizeCorner) : undefined,
        bounds,
        originalMatrix,
        elementInverse: elementScreen.inverse(),
        center: centerLocal,
        centerScreen,
        startAngle: Math.atan2(event.clientY - centerScreen.y, event.clientX - centerScreen.x),
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }

    // ── Nó (âncora) de um path: Alt+clique remove, clique-e-arrasta move ──
    if (tool === 'nodes' && target.dataset.node !== undefined) {
      const path = getEditablePath();
      const parsed = path && parsePolyline(path.getAttribute('d') || '');
      if (!path || !parsed) return;
      const nodeIndex = Number(target.dataset.node);
      if ((event.altKey || event.metaKey) && parsed.points.length > 2) {
        const next = parsed.points.filter((_, index) => index !== nodeIndex);
        onCommit(
          markup,
          updateSvgElement(markup, path.id, { d: serializePolyline(next, parsed.closed) }),
          'Remover nó',
          path.id,
        );
        return;
      }
      const ctm = path.getScreenCTM();
      if (ctm) {
        gestureRef.current = {
          kind: 'node',
          before: markup,
          start: { x: event.clientX, y: event.clientY },
          id: path.id,
          points: [],
          nodeIndex,
          pathPoints: parsed.points,
          pathClosed: parsed.closed,
          elementInverse: ctm.inverse(),
        };
        event.currentTarget.setPointerCapture(event.pointerId);
      }
      return;
    }

    // ── Caneta: clique adiciona âncora ──
    if (tool === 'pen') {
      addPenPoint(point);
      return;
    }

    const editable = target.closest<SVGGraphicsElement>(EDITABLE_SELECTOR);

    // ── Edição de nós: 1º clique seleciona o path; clicar no corpo dele adiciona um nó ──
    if (tool === 'nodes') {
      const path =
        editable && editable.localName === 'path' && parsePolyline(editable.getAttribute('d') || '')
          ? editable
          : null;
      if (!path) {
        onSelect(editable?.id ?? null);
        return;
      }
      if (path.id !== selectedId) {
        onSelect(path.id);
        return;
      }
      const parsed = parsePolyline(path.getAttribute('d') || '');
      const insertion = parsed && nearestInsertion(parsed.points, parsed.closed, point);
      if (parsed && insertion) {
        const next = [...parsed.points];
        next.splice(insertion.index, 0, insertion.point);
        onCommit(
          markup,
          updateSvgElement(markup, path.id, { d: serializePolyline(next, parsed.closed) }),
          'Adicionar nó',
          path.id,
        );
      }
      return;
    }

    if (tool === 'select') {
      const locked = editable?.closest('[data-editor-locked="true"]');
      const id = locked ? null : editable?.id || null;
      onSelect(id);
      if (!id || !editable) return;
      const parentMatrix =
        editable.parentElement instanceof SVGGraphicsElement
          ? editable.parentElement.getScreenCTM()
          : getSvg()?.getScreenCTM();
      const matrix = editable.transform.baseVal.consolidate()?.matrix;
      gestureRef.current = {
        kind: 'move',
        before: markup,
        start: { x: event.clientX, y: event.clientY },
        id,
        points: [],
        originalMatrix: matrix
          ? new DOMMatrix([matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f])
          : new DOMMatrix(),
        parentInverse: parentMatrix?.inverse(),
      };
    } else if (tool === 'text') {
      const appended = appendSvgElement(
        markup,
        'text',
        {
          x: point.x,
          y: point.y,
          fill: '#1f2937',
          stroke: 'none',
          'font-size': 32,
          'font-family': 'sans-serif',
        },
        'Texto',
      );
      onCommit(markup, appended.markup, 'Criar texto', appended.id);
      return;
    } else {
      const kind = tool;
      const appended =
        kind === 'rect'
          ? appendSvgElement(markup, 'rect', {
              x: point.x,
              y: point.y,
              width: 1,
              height: 1,
              rx: 6,
              fill: '#eeedfe',
              stroke: '#7f77dd',
              'stroke-width': 2,
            })
          : kind === 'ellipse'
            ? appendSvgElement(markup, 'ellipse', {
                cx: point.x,
                cy: point.y,
                rx: 1,
                ry: 1,
                fill: '#e1f5ee',
                stroke: '#1d9e75',
                'stroke-width': 2,
              })
            : kind === 'line'
              ? appendSvgElement(markup, 'line', {
                  x1: point.x,
                  y1: point.y,
                  x2: point.x,
                  y2: point.y,
                  fill: 'none',
                  stroke: '#534ab7',
                  'stroke-width': 3,
                })
              : appendSvgElement(markup, 'path', {
                  d: `M ${point.x} ${point.y}`,
                  fill: kind === 'freehand' ? 'none' : '#faeeda',
                  stroke: kind === 'triangle' ? '#d85a30' : '#ef9f27',
                  'stroke-width': kind === 'freehand' ? 4 : 2,
                  'stroke-linecap': 'round',
                  'stroke-linejoin': 'round',
                });
      gestureRef.current = {
        kind,
        before: markup,
        start: point,
        id: appended.id,
        points: [point],
      };
      const parsed = new DOMParser().parseFromString(appended.markup, 'image/svg+xml');
      const created = parsed.getElementById(appended.id);
      const svg = getSvg();
      if (created && svg) svg.appendChild(document.importNode(created, true));
    }
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (panRef.current) {
      onCameraChange({
        ...panRef.current.camera,
        x: panRef.current.camera.x + event.clientX - panRef.current.start.x,
        y: panRef.current.camera.y + event.clientY - panRef.current.start.y,
      });
      return;
    }
    const rawPoint = toSvgPoint(event.clientX, event.clientY);
    onPointerPosition(rawPoint);
    const point = rawPoint ? snapPoint(rawPoint) : null;
    const gesture = gestureRef.current;
    if (!gesture || !point) return;
    const element = hostRef.current?.querySelector<SVGGraphicsElement>(
      `#${CSS.escape(gesture.id)}`,
    );
    if (!element) return;

    if (
      gesture.kind === 'node' &&
      gesture.pathPoints &&
      gesture.nodeIndex !== undefined &&
      gesture.elementInverse
    ) {
      const local = pointThrough({ x: event.clientX, y: event.clientY }, gesture.elementInverse);
      const moved = snapToGrid
        ? { x: Math.round(local.x / 10) * 10, y: Math.round(local.y / 10) * 10 }
        : local;
      const next = gesture.pathPoints.map((entry, index) =>
        index === gesture.nodeIndex ? moved : entry,
      );
      element.setAttribute('d', serializePolyline(next, Boolean(gesture.pathClosed)));
      refreshNodes();
    } else if (gesture.kind === 'move' && gesture.originalMatrix && gesture.parentInverse) {
      const localDelta = vectorThrough(
        { x: event.clientX - gesture.start.x, y: event.clientY - gesture.start.y },
        gesture.parentInverse,
      );
      if (snapToGrid) {
        localDelta.x = Math.round(localDelta.x / 10) * 10;
        localDelta.y = Math.round(localDelta.y / 10) * 10;
      }
      const matrix = new DOMMatrix()
        .translate(localDelta.x, localDelta.y)
        .multiply(gesture.originalMatrix);
      element.setAttribute('transform', matrixString(matrix));
    } else if (
      gesture.kind === 'resize' &&
      gesture.bounds &&
      gesture.originalMatrix &&
      gesture.elementInverse &&
      gesture.corner !== undefined
    ) {
      const local = pointThrough({ x: event.clientX, y: event.clientY }, gesture.elementInverse);
      const b = gesture.bounds;
      const anchors = [
        { x: b.x + b.width, y: b.y + b.height },
        { x: b.x, y: b.y + b.height },
        { x: b.x, y: b.y },
        { x: b.x + b.width, y: b.y },
      ];
      const anchor = anchors[gesture.corner];
      const startCorner = [
        { x: b.x, y: b.y },
        { x: b.x + b.width, y: b.y },
        { x: b.x + b.width, y: b.y + b.height },
        { x: b.x, y: b.y + b.height },
      ][gesture.corner];
      const sx = Math.max(0.01, Math.abs((local.x - anchor.x) / (startCorner.x - anchor.x || 1)));
      const sy = Math.max(0.01, Math.abs((local.y - anchor.y) / (startCorner.y - anchor.y || 1)));
      const localScale = new DOMMatrix()
        .translate(anchor.x, anchor.y)
        .scale(sx, sy)
        .translate(-anchor.x, -anchor.y);
      element.setAttribute('transform', matrixString(gesture.originalMatrix.multiply(localScale)));
    } else if (
      gesture.kind === 'rotate' &&
      gesture.center &&
      gesture.centerScreen &&
      gesture.originalMatrix &&
      gesture.startAngle !== undefined
    ) {
      const angle = Math.atan2(
        event.clientY - gesture.centerScreen.y,
        event.clientX - gesture.centerScreen.x,
      );
      const degrees = ((angle - gesture.startAngle) * 180) / Math.PI;
      const rotation = new DOMMatrix()
        .translate(gesture.center.x, gesture.center.y)
        .rotate(degrees)
        .translate(-gesture.center.x, -gesture.center.y);
      element.setAttribute('transform', matrixString(gesture.originalMatrix.multiply(rotation)));
    } else {
      const dx = point.x - gesture.start.x;
      const dy = point.y - gesture.start.y;
      if (gesture.kind === 'rect') {
        element.setAttribute('x', String(Math.min(gesture.start.x, point.x)));
        element.setAttribute('y', String(Math.min(gesture.start.y, point.y)));
        element.setAttribute('width', String(Math.max(1, Math.abs(dx))));
        element.setAttribute('height', String(Math.max(1, Math.abs(dy))));
      } else if (gesture.kind === 'ellipse') {
        element.setAttribute('cx', String((gesture.start.x + point.x) / 2));
        element.setAttribute('cy', String((gesture.start.y + point.y) / 2));
        element.setAttribute('rx', String(Math.max(1, Math.abs(dx) / 2)));
        element.setAttribute('ry', String(Math.max(1, Math.abs(dy) / 2)));
      } else if (gesture.kind === 'line') {
        element.setAttribute('x2', String(point.x));
        element.setAttribute('y2', String(point.y));
      } else if (gesture.kind === 'star') {
        element.setAttribute('d', starPath(gesture.start, Math.max(2, Math.hypot(dx, dy))));
      } else if (gesture.kind === 'triangle') {
        element.setAttribute('d', trianglePath(gesture.start, point));
      } else if (gesture.kind === 'freehand') {
        const previous = gesture.points[gesture.points.length - 1];
        if (Math.hypot(point.x - previous.x, point.y - previous.y) < 2) return;
        gesture.points.push(point);
        element.setAttribute(
          'd',
          gesture.points
            .map(
              (item, index) =>
                `${index === 0 ? 'M' : 'L'} ${item.x.toFixed(2)} ${item.y.toFixed(2)}`,
            )
            .join(' '),
        );
      }
    }
    refreshSelection();
  };

  const finishGesture = (event: React.PointerEvent<HTMLDivElement>) => {
    if (panRef.current) {
      panRef.current = null;
      setIsPanning(false);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      return;
    }
    const gesture = gestureRef.current;
    if (!gesture) return;
    gestureRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    // Clique (ou arrasto mínimo) numa ferramenta de forma: em vez de uma forma
    // de 1px invisível, cria uma forma de tamanho padrão dentro do quadro.
    const CREATION_KINDS = new Set(['rect', 'ellipse', 'line', 'freehand', 'star', 'triangle']);
    if (CREATION_KINDS.has(gesture.kind)) {
      const end = toSvgPoint(event.clientX, event.clientY);
      const dragDistance = end
        ? Math.hypot(end.x - gesture.start.x, end.y - gesture.start.y)
        : 0;
      if (dragDistance < Math.min(dimensions.width, dimensions.height) * 0.015) {
        const element = hostRef.current?.querySelector<SVGGraphicsElement>(
          `#${CSS.escape(gesture.id)}`,
        );
        if (element) applyDefaultShape(element, gesture.kind, gesture.start, dimensions);
      }
    }

    // Mover/redimensionar: achata o transform de translate/escala na geometria
    // para o painel (X/Y/L/A) refletir a posição/tamanho reais e edições não
    // pularem. Rotação permanece como transform.
    if (gesture.kind === 'move' || gesture.kind === 'resize') {
      const element = hostRef.current?.querySelector<SVGGraphicsElement>(
        `#${CSS.escape(gesture.id)}`,
      );
      if (element) bakeTransform(element);
    }

    const after = serializeCanvas();
    if (!after || after === gesture.before) return;
    const label =
      gesture.kind === 'move'
        ? 'Mover elemento'
        : gesture.kind === 'resize'
          ? 'Redimensionar elemento'
          : gesture.kind === 'rotate'
            ? 'Rotacionar elemento'
            : gesture.kind === 'node'
              ? 'Mover nó'
              : 'Criar elemento';
    onCommit(gesture.before, after, label, gesture.id);
  };

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (event.ctrlKey || event.metaKey) {
      const factor = Math.exp(-event.deltaY * 0.002);
      onCameraChange({ ...camera, zoom: Math.min(8, Math.max(0.1, camera.zoom * factor)) });
    } else {
      onCameraChange({ ...camera, x: camera.x - event.deltaX, y: camera.y - event.deltaY });
    }
  };

  return (
    <div
      ref={canvasRef}
      className={`svg-editor-canvas tool-${tool}${isPanning ? ' is-panning' : ''}`}
      aria-label="Área de edição do modelo SVG"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerLeave={() => onPointerPosition(null)}
      onPointerUp={finishGesture}
      onPointerCancel={finishGesture}
      onDoubleClick={handleDoubleClick}
      onWheel={handleWheel}
    >
      <div className="svg-editor-model-size">
        Modelo {Math.round(dimensions.width)} × {Math.round(dimensions.height)}
      </div>
      <div
        className="svg-editor-stage"
        style={{
          width: dimensions.width,
          height: dimensions.height,
          transform: `translate(-50%, -50%) translate(${camera.x}px, ${camera.y}px) scale(${renderedScale})`,
        }}
      >
        <SvgDocument ref={hostRef} markup={markup} />
        {showSafeArea && (
          <div className="svg-editor-safe-area">
            <span>Margem segura 5%</span>
          </div>
        )}
      </div>
      {selectionRect && (
        <div
          className="svg-editor-selection"
          style={{
            left: selectionRect.x,
            top: selectionRect.y,
            width: selectionRect.width,
            height: selectionRect.height,
          }}
        >
          {tool !== 'nodes' && (
            <>
              <span className="svg-editor-rotate-handle" data-rotate="true" />
              {[0, 1, 2, 3].map((corner) => (
                <span key={corner} data-resize={corner} className={`handle-${corner}`} />
              ))}
            </>
          )}
        </div>
      )}
      {tool === 'nodes' &&
        nodeHandles.map((node, index) => (
          <span
            key={index}
            data-node={index}
            className="svg-editor-node-handle"
            style={{ left: node.x, top: node.y }}
          />
        ))}
    </div>
  );
};

export default SvgCanvas;
