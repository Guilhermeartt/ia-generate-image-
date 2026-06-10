import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { SvgTool } from './types';
import {
  appendSvgElement,
  getSvgElementProperties,
  resizeSvgElement,
  translateSvgElement,
  updateSvgElement,
} from './svgDocument';

interface SvgCanvasProps {
  markup: string;
  tool: SvgTool;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onPointerPosition: (point: { x: number; y: number } | null) => void;
  onPreview: (markup: string, selectedId?: string) => void;
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
  kind: 'move' | 'resize' | 'rect' | 'ellipse' | 'line' | 'freehand' | 'star' | 'triangle';
  before: string;
  start: Point;
  id: string;
  points: Point[];
  latest: string;
  corner?: number;
  bounds?: Bounds;
}

const EDITABLE_SELECTOR =
  'g[id],path[id],rect[id],circle[id],ellipse[id],line[id],polyline[id],polygon[id],text[id]';

const starPath = (center: Point, radius: number): string => {
  const inner = radius * 0.45;
  return (
    Array.from({ length: 10 }, (_, index) => {
      const currentRadius = index % 2 === 0 ? radius : inner;
      const angle = (index * Math.PI) / 5 - Math.PI / 2;
      const x = center.x + currentRadius * Math.cos(angle);
      const y = center.y + currentRadius * Math.sin(angle);
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    }).join(' ') + ' Z'
  );
};

const trianglePath = (start: Point, point: Point): string => {
  const minX = Math.min(start.x, point.x);
  const minY = Math.min(start.y, point.y);
  const width = Math.max(2, Math.abs(point.x - start.x));
  const height = Math.max(2, Math.abs(point.y - start.y));
  return `M ${minX + width / 2} ${minY} L ${minX + width} ${minY + height} L ${minX} ${minY + height} Z`;
};

const resizedBounds = (bounds: Bounds, corner: number, dx: number, dy: number): Bounds => {
  if (corner === 0) {
    return {
      x: bounds.x + dx,
      y: bounds.y + dy,
      width: bounds.width - dx,
      height: bounds.height - dy,
    };
  }
  if (corner === 1) {
    return { x: bounds.x, y: bounds.y + dy, width: bounds.width + dx, height: bounds.height - dy };
  }
  if (corner === 2) {
    return { ...bounds, width: bounds.width + dx, height: bounds.height + dy };
  }
  return { x: bounds.x + dx, y: bounds.y, width: bounds.width - dx, height: bounds.height + dy };
};

const SvgCanvas: React.FC<SvgCanvasProps> = ({
  markup,
  tool,
  selectedId,
  onSelect,
  onPointerPosition,
  onPreview,
  onCommit,
}) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const [selectionRect, setSelectionRect] = useState<DOMRect | null>(null);
  const selectedProperties = selectedId ? getSvgElementProperties(markup, selectedId) : null;
  const canResizeSelection = ['rect', 'ellipse', 'circle'].includes(
    selectedProperties?.tagName || '',
  );

  const toSvgPoint = useCallback((clientX: number, clientY: number): Point | null => {
    const svg = hostRef.current?.querySelector('svg');
    const matrix = svg?.getScreenCTM();
    if (!svg || !matrix) return null;
    const point = new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
    return { x: point.x, y: point.y };
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    const selected = selectedId ? host?.querySelector(`#${CSS.escape(selectedId)}`) : null;
    if (!host || !selected) {
      setSelectionRect(null);
      return;
    }
    const elementRect = selected.getBoundingClientRect();
    const canvasRect = host.parentElement?.getBoundingClientRect() ?? host.getBoundingClientRect();
    setSelectionRect(
      new DOMRect(
        elementRect.left - canvasRect.left,
        elementRect.top - canvasRect.top,
        elementRect.width,
        elementRect.height,
      ),
    );
  }, [markup, selectedId]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const point = toSvgPoint(event.clientX, event.clientY);
    if (!point) return;
    const target = event.target as HTMLElement;
    const resizeCorner = target.dataset.resize;

    if (resizeCorner && selectedId) {
      const properties = getSvgElementProperties(markup, selectedId);
      if (
        properties &&
        properties.x !== null &&
        properties?.y !== null &&
        properties?.width !== null &&
        properties?.height !== null &&
        ['rect', 'ellipse', 'circle'].includes(properties.tagName)
      ) {
        gestureRef.current = {
          kind: 'resize',
          before: markup,
          start: point,
          id: selectedId,
          points: [],
          latest: markup,
          corner: Number(resizeCorner),
          bounds: {
            x: properties.x,
            y: properties.y,
            width: properties.width,
            height: properties.height,
          },
        };
        event.currentTarget.setPointerCapture(event.pointerId);
        return;
      }
    }

    const editable = target.closest(EDITABLE_SELECTOR);
    if (tool === 'select') {
      const id = editable?.id || null;
      onSelect(id);
      if (!id) return;
      gestureRef.current = {
        kind: 'move',
        before: markup,
        start: point,
        id,
        points: [],
        latest: markup,
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
        latest: appended.markup,
      };
      onPreview(appended.markup, appended.id);
    }
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const point = toSvgPoint(event.clientX, event.clientY);
    onPointerPosition(point);
    const gesture = gestureRef.current;
    if (!gesture || !point) return;

    let next: string;
    const dx = point.x - gesture.start.x;
    const dy = point.y - gesture.start.y;
    if (gesture.kind === 'move') {
      next = translateSvgElement(gesture.before, gesture.id, dx, dy);
    } else if (gesture.kind === 'resize' && gesture.bounds && gesture.corner !== undefined) {
      const bounds = resizedBounds(gesture.bounds, gesture.corner, dx, dy);
      if (bounds.width < 1) {
        bounds.x += bounds.width;
        bounds.width = Math.abs(bounds.width);
      }
      if (bounds.height < 1) {
        bounds.y += bounds.height;
        bounds.height = Math.abs(bounds.height);
      }
      next = resizeSvgElement(gesture.before, gesture.id, bounds);
    } else if (gesture.kind === 'rect') {
      next = updateSvgElement(gesture.latest, gesture.id, {
        x: Math.min(gesture.start.x, point.x),
        y: Math.min(gesture.start.y, point.y),
        width: Math.max(1, Math.abs(dx)),
        height: Math.max(1, Math.abs(dy)),
      });
    } else if (gesture.kind === 'ellipse') {
      next = updateSvgElement(gesture.latest, gesture.id, {
        cx: (gesture.start.x + point.x) / 2,
        cy: (gesture.start.y + point.y) / 2,
        rx: Math.max(1, Math.abs(dx) / 2),
        ry: Math.max(1, Math.abs(dy) / 2),
      });
    } else if (gesture.kind === 'line') {
      next = updateSvgElement(gesture.latest, gesture.id, { x2: point.x, y2: point.y });
    } else if (gesture.kind === 'star') {
      next = updateSvgElement(gesture.latest, gesture.id, {
        d: starPath(gesture.start, Math.max(2, Math.hypot(dx, dy))),
      });
    } else if (gesture.kind === 'triangle') {
      next = updateSvgElement(gesture.latest, gesture.id, {
        d: trianglePath(gesture.start, point),
      });
    } else {
      const previous = gesture.points[gesture.points.length - 1];
      if (Math.hypot(point.x - previous.x, point.y - previous.y) < 2) return;
      gesture.points.push(point);
      const path = gesture.points
        .map(
          (item, index) => `${index === 0 ? 'M' : 'L'} ${item.x.toFixed(2)} ${item.y.toFixed(2)}`,
        )
        .join(' ');
      next = updateSvgElement(gesture.latest, gesture.id, { d: path });
    }
    gesture.latest = next;
    onPreview(next, gesture.id);
  };

  const finishGesture = (event: React.PointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (!gesture) return;
    gestureRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (gesture.latest === gesture.before) return;
    const label =
      gesture.kind === 'move'
        ? 'Mover elemento'
        : gesture.kind === 'resize'
          ? 'Redimensionar elemento'
          : 'Criar elemento';
    onCommit(gesture.before, gesture.latest, label, gesture.id);
  };

  return (
    <div
      className={`svg-editor-canvas tool-${tool}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerLeave={() => onPointerPosition(null)}
      onPointerUp={finishGesture}
      onPointerCancel={finishGesture}
    >
      <div
        ref={hostRef}
        className="svg-editor-document"
        // O markup já passou pela allowlist de sanitizeSvg.
        dangerouslySetInnerHTML={{ __html: markup }}
      />
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
          {canResizeSelection &&
            [0, 1, 2, 3].map((corner) => (
              <span key={corner} data-resize={corner} className={`handle-${corner}`} />
            ))}
        </div>
      )}
    </div>
  );
};

export default SvgCanvas;
