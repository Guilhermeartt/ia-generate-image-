import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { SvgCamera, SvgTool } from './types';
import { appendSvgElement } from './svgDocument';

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
    | 'triangle';
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
  const spacePressedRef = useRef(false);
  const panRef = useRef<{ start: Point; camera: SvgCamera } | null>(null);
  const [viewport, setViewport] = useState({ width: 1, height: 1 });
  const [selectionRect, setSelectionRect] = useState<DOMRect | null>(null);
  const [isPanning, setIsPanning] = useState(false);

  const dimensions = viewBox ?? { width: 1280, height: 720 };
  const fitScale = Math.max(
    0.01,
    Math.min((viewport.width - 96) / dimensions.width, (viewport.height - 96) / dimensions.height),
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

  useLayoutEffect(refreshSelection, [markup, camera, viewport, refreshSelection]);

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

    const editable = target.closest<SVGGraphicsElement>(EDITABLE_SELECTOR);
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

    if (gesture.kind === 'move' && gesture.originalMatrix && gesture.parentInverse) {
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
    const after = serializeCanvas();
    if (!after || after === gesture.before) return;
    const label =
      gesture.kind === 'move'
        ? 'Mover elemento'
        : gesture.kind === 'resize'
          ? 'Redimensionar elemento'
          : gesture.kind === 'rotate'
            ? 'Rotacionar elemento'
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
        <div
          ref={hostRef}
          className="svg-editor-document"
          dangerouslySetInnerHTML={{ __html: markup }}
        />
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
          <span className="svg-editor-rotate-handle" data-rotate="true" />
          {[0, 1, 2, 3].map((corner) => (
            <span key={corner} data-resize={corner} className={`handle-${corner}`} />
          ))}
        </div>
      )}
    </div>
  );
};

export default SvgCanvas;
