import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { ImageRegion, PolygonPoint, RegionActionResult, SceneReference } from '../types';
import { XIcon } from './icons';
import SceneReferencesPanel from './SceneReferencesPanel';

interface ImageRegionSelectorModalProps {
  isOpen: boolean;
  imageUrl: string;
  onClose: () => void;
  onConfirm: (result: RegionActionResult) => void;
  initialMode?: DrawMode;
  references?: SceneReference[];
  onReferencesChange?: (updater: (current: SceneReference[] | undefined) => SceneReference[] | undefined) => void;
}

type DrawMode = 'analyze' | 'edit' | 'remove';
type SelectionMode = 'manual' | 'smart';

interface SmartMask {
  width: number;
  height: number;
  data: Uint8Array;
  bbox: ImageRegion;
  pixelCount: number;
  previewUrl: string;
  source: 'sam2' | 'local';
  score?: number | null;
}

interface DetectedObject {
  label: string;
  score: number;
  bbox: { x: number; y: number; width: number; height: number }; // normalized [0,1]
}

// Minimum Euclidean distance between consecutive points (avoids too many close points)
const MIN_POINT_DIST = 4;

function dist(a: PolygonPoint, b: PolygonPoint) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function polygonBoundingBox(pts: PolygonPoint[]): ImageRegion {
  const xs = pts.map(p => p.x);
  const ys = pts.map(p => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

function regionToPolygon(region: ImageRegion): PolygonPoint[] {
  return [
    { x: region.x, y: region.y },
    { x: region.x + region.width, y: region.y },
    { x: region.x + region.width, y: region.y + region.height },
    { x: region.x, y: region.y + region.height },
  ];
}

function colorDistance(aR: number, aG: number, aB: number, bR: number, bG: number, bB: number) {
  const dr = aR - bR;
  const dg = aG - bG;
  const db = aB - bB;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

async function buildSmartMask(
  imageUrl: string,
  seed: PolygonPoint,
  displayW: number,
  displayH: number,
  tolerance: number,
): Promise<SmartMask> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!imageUrl.startsWith('data:')) img.crossOrigin = 'anonymous';
    img.onload = () => {
      const width = Math.max(1, Math.round(displayW));
      const height = Math.max(1, Math.round(displayH));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, width, height);
      const imageData = ctx.getImageData(0, 0, width, height);
      const pixels = imageData.data;
      const startX = Math.max(0, Math.min(width - 1, Math.round(seed.x)));
      const startY = Math.max(0, Math.min(height - 1, Math.round(seed.y)));
      const startIdx = (startY * width + startX) * 4;
      const sr = pixels[startIdx];
      const sg = pixels[startIdx + 1];
      const sb = pixels[startIdx + 2];
      const selected = new Uint8Array(width * height);
      const visited = new Uint8Array(width * height);
      const stack = [startY * width + startX];
      const maxPixels = Math.floor(width * height * 0.55);
      let minX = startX;
      let maxX = startX;
      let minY = startY;
      let maxY = startY;
      let count = 0;

      while (stack.length > 0) {
        const idx = stack.pop()!;
        if (visited[idx]) continue;
        visited[idx] = 1;
        const px = idx % width;
        const py = Math.floor(idx / width);
        const p = idx * 4;
        if (pixels[p + 3] < 8) continue;
        if (colorDistance(pixels[p], pixels[p + 1], pixels[p + 2], sr, sg, sb) > tolerance) continue;

        selected[idx] = 1;
        count += 1;
        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (py < minY) minY = py;
        if (py > maxY) maxY = py;
        if (count > maxPixels) break;

        if (px > 0) stack.push(idx - 1);
        if (px < width - 1) stack.push(idx + 1);
        if (py > 0) stack.push(idx - width);
        if (py < height - 1) stack.push(idx + width);
      }

      const overlay = document.createElement('canvas');
      overlay.width = width;
      overlay.height = height;
      const overlayCtx = overlay.getContext('2d')!;
      const overlayData = overlayCtx.createImageData(width, height);
      for (let i = 0; i < selected.length; i += 1) {
        if (!selected[i]) continue;
        const p = i * 4;
        overlayData.data[p] = 34;
        overlayData.data[p + 1] = 211;
        overlayData.data[p + 2] = 238;
        overlayData.data[p + 3] = 92;
      }
      overlayCtx.putImageData(overlayData, 0, 0);

      resolve({
        width,
        height,
        data: selected,
        bbox: { x: minX, y: minY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) },
        pixelCount: count,
        previewUrl: overlay.toDataURL('image/png'),
        source: 'local',
      });
    };
    img.onerror = () => reject(new Error('Falha ao carregar imagem para seleção inteligente.'));
    img.src = imageUrl;
  });
}

async function smartMaskFromMaskUrl(maskUrl: string, displayW: number, displayH: number, score?: number | null): Promise<SmartMask> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const width = Math.max(1, Math.round(displayW));
      const height = Math.max(1, Math.round(displayH));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, width, height);
      const maskData = ctx.getImageData(0, 0, width, height).data;
      const selected = new Uint8Array(width * height);
      const overlay = document.createElement('canvas');
      overlay.width = width;
      overlay.height = height;
      const overlayCtx = overlay.getContext('2d')!;
      const overlayData = overlayCtx.createImageData(width, height);
      let minX = width - 1;
      let maxX = 0;
      let minY = height - 1;
      let maxY = 0;
      let count = 0;

      for (let i = 0; i < selected.length; i += 1) {
        const p = i * 4;
        // SAM2 retorna PNG grayscale "L"; o browser renderiza como RGBA com
        // alpha=255 em todo pixel. Olhar só o canal R (= G = B) para o valor
        // da máscara — incluir o alpha no max marcaria a imagem inteira.
        const value = maskData[p];
        if (value < 80) continue;
        selected[i] = 1;
        const x = i % width;
        const y = Math.floor(i / width);
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        count += 1;
        overlayData.data[p] = 34;
        overlayData.data[p + 1] = 211;
        overlayData.data[p + 2] = 238;
        overlayData.data[p + 3] = 112;
      }

      overlayCtx.putImageData(overlayData, 0, 0);
      resolve({
        width,
        height,
        data: selected,
        bbox: count > 0
          ? { x: minX, y: minY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) }
          : { x: 0, y: 0, width: 1, height: 1 },
        pixelCount: count,
        previewUrl: overlay.toDataURL('image/png'),
        source: 'sam2',
        score,
      });
    };
    img.onerror = () => reject(new Error('Falha ao carregar máscara SAM 2.'));
    img.src = maskUrl;
  });
}

async function buildSam2SmartMask(
  imageUrl: string,
  positive: PolygonPoint[],
  negative: PolygonPoint[],
  displayW: number,
  displayH: number,
  box: { x: number; y: number; width: number; height: number } | null = null,
): Promise<SmartMask> {
  if (positive.length === 0 && !box) {
    throw new Error('Envie ao menos um ponto positivo ou uma caixa.');
  }
  const [seed, ...extraPositive] = positive;
  const response = await fetch('/api/sam2/segment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      imageBase64: imageUrl,
      point: seed ? { x: seed.x / displayW, y: seed.y / displayH } : null,
      positivePoints: extraPositive.map(p => ({ x: p.x / displayW, y: p.y / displayH })),
      negativePoints: negative.map(p => ({ x: p.x / displayW, y: p.y / displayH })),
      box,
      multimask: false,
    }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.maskBase64) {
    throw new Error(payload?.error || 'SAM 2 indisponível.');
  }
  return smartMaskFromMaskUrl(payload.maskBase64, displayW, displayH, payload.score);
}

async function detectObjects(imageUrl: string): Promise<DetectedObject[]> {
  const response = await fetch('/api/sam2/detect', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64: imageUrl, threshold: 0.6, maxObjects: 30 }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !Array.isArray(payload?.objects)) {
    throw new Error(payload?.error || 'Falha na detecção.');
  }
  return payload.objects as DetectedObject[];
}

async function buildAnnotatedImageFromSmartMask(
  imageUrl: string,
  mask: SmartMask,
  mimeType: string,
  mode: Exclude<DrawMode, 'analyze'>,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!imageUrl.startsWith('data:')) img.crossOrigin = 'anonymous';
    img.onload = () => {
      const natW = img.naturalWidth;
      const natH = img.naturalHeight;
      const canvas = document.createElement('canvas');
      canvas.width = natW;
      canvas.height = natH;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, natW, natH);

      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = mask.width;
      maskCanvas.height = mask.height;
      const maskCtx = maskCanvas.getContext('2d')!;
      const maskImage = maskCtx.createImageData(mask.width, mask.height);
      const isEdit = mode === 'edit';
      for (let i = 0; i < mask.data.length; i += 1) {
        if (!mask.data[i]) continue;
        const p = i * 4;
        maskImage.data[p] = isEdit ? 34 : 239;
        maskImage.data[p + 1] = isEdit ? 211 : 68;
        maskImage.data[p + 2] = isEdit ? 238 : 68;
        maskImage.data[p + 3] = isEdit ? 120 : 145;
      }
      maskCtx.putImageData(maskImage, 0, 0);
      ctx.drawImage(maskCanvas, 0, 0, natW, natH);
      resolve(canvas.toDataURL(mimeType || 'image/png'));
    };
    img.onerror = () => reject(new Error('Falha ao criar máscara inteligente.'));
    img.src = imageUrl;
  });
}

/** Draw the polygon with a cyan overlay for the edit action. */
async function buildAnnotatedImageEdit(
  imageUrl: string,
  polygon: PolygonPoint[],
  displayW: number,
  displayH: number,
  mimeType: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!imageUrl.startsWith('data:')) img.crossOrigin = 'anonymous';
    img.onload = () => {
      const natW = img.naturalWidth;
      const natH = img.naturalHeight;
      const scaleX = natW / displayW;
      const scaleY = natH / displayH;
      const canvas = document.createElement('canvas');
      canvas.width = natW;
      canvas.height = natH;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, natW, natH);
      ctx.save();
      ctx.beginPath();
      polygon.forEach((pt, i) => {
        const sx = pt.x * scaleX;
        const sy = pt.y * scaleY;
        i === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy);
      });
      ctx.closePath();
      ctx.fillStyle = 'rgba(34, 211, 238, 0.45)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.95)';
      ctx.lineWidth = Math.max(2, natW / 400);
      ctx.stroke();
      ctx.restore();
      resolve(canvas.toDataURL(mimeType || 'image/png'));
    };
    img.onerror = () => reject(new Error('Falha ao carregar imagem para anotação de edição.'));
    img.src = imageUrl;
  });
}

/** Draw the polygon on a canvas at natural image size, fill it with a semi-transparent
 *  red overlay. Returns the base64 data URL of the annotated image. */
async function buildAnnotatedImage(
  imageUrl: string,
  polygon: PolygonPoint[],
  displayW: number,
  displayH: number,
  mimeType: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!imageUrl.startsWith('data:')) img.crossOrigin = 'anonymous';
    img.onload = () => {
      const natW = img.naturalWidth;
      const natH = img.naturalHeight;
      const scaleX = natW / displayW;
      const scaleY = natH / displayH;

      const canvas = document.createElement('canvas');
      canvas.width = natW;
      canvas.height = natH;
      const ctx = canvas.getContext('2d')!;

      // Draw original image
      ctx.drawImage(img, 0, 0, natW, natH);

      // Draw polygon overlay (red highlight = area to remove)
      ctx.save();
      ctx.beginPath();
      polygon.forEach((pt, i) => {
        const sx = pt.x * scaleX;
        const sy = pt.y * scaleY;
        i === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy);
      });
      ctx.closePath();
      ctx.fillStyle = 'rgba(239, 68, 68, 0.55)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.9)';
      ctx.lineWidth = Math.max(2, natW / 400);
      ctx.stroke();
      ctx.restore();

      resolve(canvas.toDataURL(mimeType || 'image/png'));
    };
    img.onerror = () => reject(new Error('Falha ao carregar imagem para anotação.'));
    img.src = imageUrl;
  });
}

const ImageRegionSelectorModal: React.FC<ImageRegionSelectorModalProps> = ({
  isOpen, imageUrl, onClose, onConfirm, initialMode = 'analyze',
  references, onReferencesChange,
}) => {
  const [mode, setMode] = useState<DrawMode>(initialMode);
  const [selectionMode, setSelectionMode] = useState<SelectionMode>('smart');
  const [points, setPoints] = useState<PolygonPoint[]>([]);
  const [smartMask, setSmartMask] = useState<SmartMask | null>(null);
  const [smartTolerance, setSmartTolerance] = useState(34);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isSmartSelecting, setIsSmartSelecting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [editInstruction, setEditInstruction] = useState('');
  // SAM2 refinement: extra positive/negative clicks accumulated after the
  // first smart-select hit, used to widen or shrink the mask via re-query.
  const [smartPositive, setSmartPositive] = useState<PolygonPoint[]>([]);
  const [smartNegative, setSmartNegative] = useState<PolygonPoint[]>([]);
  // Object detection: when the user runs "Detectar objetos", the backend
  // returns a list of candidate bboxes the user can click on to seed SAM2.
  const [detectedObjects, setDetectedObjects] = useState<DetectedObject[] | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const reset = useCallback(() => {
    setPoints([]);
    setSmartMask(null);
    setSmartPositive([]);
    setSmartNegative([]);
    setIsDrawing(false);
    setIsSmartSelecting(false);
    setIsProcessing(false);
  }, []);

  const resetAll = useCallback(() => {
    reset();
    setDetectedObjects(null);
  }, [reset]);

  useEffect(() => {
    if (!isOpen) { reset(); setMode(initialMode); setEditInstruction(''); }
  }, [isOpen, reset, initialMode]);

  // ── Coordinate helpers ────────────────────────────────────────────

  const getDisplayImageBounds = useCallback(() => {
    if (!imageRef.current) return null;
    const imgRect = imageRef.current.getBoundingClientRect();
    const ctnRect = containerRef.current!.getBoundingClientRect();
    return {
      left: imgRect.left - ctnRect.left,
      top: imgRect.top - ctnRect.top,
      width: imgRect.width,
      height: imgRect.height,
    };
  }, []);

  const clampToImage = useCallback((clientX: number, clientY: number): PolygonPoint | null => {
    const bounds = getDisplayImageBounds();
    if (!bounds) return null;
    const ctnRect = containerRef.current!.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - ctnRect.left - bounds.left, bounds.width));
    const y = Math.max(0, Math.min(clientY - ctnRect.top - bounds.top, bounds.height));
    return { x, y };
  }, [getDisplayImageBounds]);

  // ── Mouse events ──────────────────────────────────────────────────

  const handleDetect = useCallback(async () => {
    setIsDetecting(true);
    setDetectedObjects(null);
    reset();
    try {
      const objs = await detectObjects(imageUrl);
      setDetectedObjects(objs);
    } catch (err) {
      console.error('Falha na detecção de objetos:', err);
      setDetectedObjects([]);
    } finally {
      setIsDetecting(false);
    }
  }, [imageUrl, reset]);

  const handlePickObject = useCallback((obj: DetectedObject) => {
    const bounds = getDisplayImageBounds();
    if (!bounds) return;
    setDetectedObjects(null);
    setIsSmartSelecting(true);
    setPoints([]);
    setSmartPositive([]);
    setSmartNegative([]);
    buildSam2SmartMask(imageUrl, [], [], bounds.width, bounds.height, obj.bbox)
      .then(setSmartMask)
      .catch(err => {
        console.error('Falha ao segmentar objeto detectado:', err);
        setSmartMask(null);
      })
      .finally(() => setIsSmartSelecting(false));
  }, [imageUrl, getDisplayImageBounds]);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const pt = clampToImage(e.clientX, e.clientY);
    if (!pt) return;
    if (selectionMode === 'smart') {
      const bounds = getDisplayImageBounds();
      if (!bounds) return;
      const isNegative = e.shiftKey || e.altKey || e.button === 2;

      // First click (no mask yet): seed a fresh SAM2 query with one positive.
      if (!smartMask && smartPositive.length === 0) {
        if (isNegative) return; // negative without a seed is meaningless
        setIsSmartSelecting(true);
        setPoints([]);
        setSmartPositive([pt]);
        setSmartNegative([]);
        buildSam2SmartMask(imageUrl, [pt], [], bounds.width, bounds.height)
          .catch(() => buildSmartMask(imageUrl, pt, bounds.width, bounds.height, smartTolerance))
          .then(setSmartMask)
          .catch(err => {
            console.error('Falha na seleção inteligente:', err);
            setSmartMask(null);
          })
          .finally(() => setIsSmartSelecting(false));
        return;
      }

      // Refinement clicks: accumulate point and re-query SAM2.
      const nextPositive = isNegative ? smartPositive : [...smartPositive, pt];
      const nextNegative = isNegative ? [...smartNegative, pt] : smartNegative;
      setSmartPositive(nextPositive);
      setSmartNegative(nextNegative);
      if (nextPositive.length === 0) return; // shouldn't happen
      setIsSmartSelecting(true);
      buildSam2SmartMask(imageUrl, nextPositive, nextNegative, bounds.width, bounds.height)
        .then(setSmartMask)
        .catch(err => {
          console.error('Falha ao refinar seleção SAM2:', err);
        })
        .finally(() => setIsSmartSelecting(false));
      return;
    }
    setSmartMask(null);
    setPoints([pt]);
    setIsDrawing(true);
  }, [clampToImage, getDisplayImageBounds, imageUrl, selectionMode, smartTolerance, smartMask, smartPositive, smartNegative]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (selectionMode === 'smart') return;
    if (!isDrawing) return;
    const pt = clampToImage(e.clientX, e.clientY);
    if (!pt) return;
    setPoints(prev => {
      if (prev.length === 0) return [pt];
      if (dist(prev[prev.length - 1], pt) < MIN_POINT_DIST) return prev;
      return [...prev, pt];
    });
  }, [isDrawing, clampToImage, selectionMode]);

  const handlePointerUp = useCallback(() => {
    if (selectionMode === 'smart') return;
    setIsDrawing(false);
  }, [selectionMode]);

  // ── Confirm ───────────────────────────────────────────────────────

  const handleConfirm = useCallback(async () => {
    const bounds = getDisplayImageBounds();
    if (!bounds) return;

    if (mode === 'analyze') {
      if (smartMask) {
        onConfirm({ action: 'analyze', region: smartMask.bbox });
        return;
      }
      if (points.length < 3) {
        onConfirm({ action: 'analyze', region: null });
        return;
      }
      const bb = polygonBoundingBox(points);
      onConfirm({ action: 'analyze', region: { x: bb.x, y: bb.y, width: bb.width, height: bb.height } });
    } else if (mode === 'edit') {
      if ((!smartMask && points.length < 3) || !editInstruction.trim()) return;
      setIsProcessing(true);
      try {
        const mime = imageUrl.startsWith('data:image/')
          ? imageUrl.split(';')[0].replace('data:', '')
          : 'image/png';
        const polygon = smartMask ? regionToPolygon(smartMask.bbox) : points;
        const annotated = smartMask
          ? await buildAnnotatedImageFromSmartMask(imageUrl, smartMask, mime, 'edit')
          : await buildAnnotatedImageEdit(imageUrl, points, bounds.width, bounds.height, mime);
        onConfirm({ action: 'edit', annotatedImageBase64: annotated, mimeType: mime, polygon, editInstruction: editInstruction.trim() });
      } catch (e) {
        console.error('Falha ao criar imagem anotada para edição:', e);
        setIsProcessing(false);
      }
    } else {
      if (!smartMask && points.length < 3) return;
      setIsProcessing(true);
      try {
        const mime = imageUrl.startsWith('data:image/')
          ? imageUrl.split(';')[0].replace('data:', '')
          : 'image/png';
        const polygon = smartMask ? regionToPolygon(smartMask.bbox) : points;
        const annotated = smartMask
          ? await buildAnnotatedImageFromSmartMask(imageUrl, smartMask, mime, 'remove')
          : await buildAnnotatedImage(imageUrl, points, bounds.width, bounds.height, mime);
        onConfirm({ action: 'remove', annotatedImageBase64: annotated, mimeType: mime, polygon });
      } catch (e) {
        console.error('Falha ao criar imagem anotada:', e);
        setIsProcessing(false);
      }
    }
  }, [mode, points, smartMask, editInstruction, imageUrl, getDisplayImageBounds, onConfirm]);

  const handleAnalyzeWhole = useCallback(() => {
    onConfirm({ action: 'analyze', region: null });
  }, [onConfirm]);

  if (!isOpen) return null;

  const hasPath = points.length >= 3;
  const hasSelection = hasPath || !!smartMask;
  const svgPoints = points.map(p => `${p.x},${p.y}`).join(' ');

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{ width: 'min(900px, 100%)', maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.01em' }}>
              Selecionar Região
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 2 }}>
              {selectionMode === 'smart'
                ? 'Clique no objeto. Refine com cliques extras (Shift/clique-direito = remover área).'
                : 'Desenhe livremente sobre a imagem.'}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {/* Selection mode toggle */}
            <div style={{
              display: 'flex', borderRadius: 8,
              border: '1px solid var(--border)', overflow: 'hidden',
            }}>
              {(['smart', 'manual'] as SelectionMode[]).map(m => (
                <button
                  key={m}
                  onClick={() => { setSelectionMode(m); reset(); }}
                  style={{
                    padding: '6px 12px', fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer',
                    background: selectionMode === m ? 'rgba(34,211,238,0.14)' : 'transparent',
                    color: selectionMode === m ? '#22D3EE' : 'var(--text-4)',
                    transition: 'background .15s ease, color .15s ease',
                  }}
                >{m === 'smart' ? 'Inteligente' : 'Manual'}</button>
              ))}
            </div>

            {selectionMode === 'smart' && (
              <button
                onClick={handleDetect}
                disabled={isDetecting}
                title="Analisar imagem e detectar objetos"
                style={{
                  padding: '6px 10px', fontSize: 11, fontWeight: 700,
                  border: '1px solid rgba(168,85,247,0.4)', borderRadius: 8,
                  cursor: isDetecting ? 'wait' : 'pointer',
                  background: 'rgba(168,85,247,0.10)', color: '#A855F7',
                }}
              >{isDetecting ? 'Analisando…' : 'Detectar objetos'}</button>
            )}

            {selectionMode === 'smart' && (smartPositive.length > 0 || smartNegative.length > 0 || detectedObjects) && (
              <button
                onClick={resetAll}
                title="Limpar tudo"
                style={{
                  padding: '6px 10px', fontSize: 11, fontWeight: 700, border: '1px solid var(--border)',
                  borderRadius: 8, cursor: 'pointer', background: 'transparent', color: 'var(--text-4)',
                }}
              >Limpar</button>
            )}

            {/* Mode toggle */}
            <div style={{
              display: 'flex', borderRadius: 8,
              border: '1px solid var(--border)', overflow: 'hidden',
            }}>
              {(['analyze', 'edit', 'remove'] as DrawMode[]).map(m => {
                const color = m === 'analyze' ? '#22D3EE' : m === 'edit' ? '#818CF8' : '#F87171';
                const bg = m === 'analyze' ? 'rgba(34,211,238,0.15)' : m === 'edit' ? 'rgba(129,140,248,0.15)' : 'rgba(239,68,68,0.15)';
                const label = m === 'analyze' ? 'Analisar' : m === 'edit' ? 'Editar' : 'Remover';
                return (
                  <button
                    key={m}
                    onClick={() => { setMode(m); reset(); }}
                    style={{
                      padding: '6px 14px', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
                      background: mode === m ? bg : 'transparent',
                      color: mode === m ? color : 'var(--text-4)',
                      transition: 'background .15s ease, color .15s ease',
                    }}
                  >{label}</button>
                );
              })}
            </div>
          </div>

          <button className="icon-btn" onClick={onClose} title="Fechar">
            <XIcon width={14} height={14} />
          </button>
        </div>

        {/* ── Mode description strip ── */}
        <div style={{
          padding: '8px 18px', flexShrink: 0,
          background: mode === 'analyze' ? 'rgba(34,211,238,0.06)' : mode === 'edit' ? 'rgba(129,140,248,0.06)' : 'rgba(239,68,68,0.06)',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          {mode === 'analyze' && (
            <>
              <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#22D3EE" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                Desenhe para <strong style={{ color: '#22D3EE' }}>isolar uma área</strong> e enviar apenas ela para análise de texto.
              </span>
            </>
          )}
          {mode === 'edit' && (
            <>
              <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#818CF8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
              </svg>
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                Desenhe a área a <strong style={{ color: '#818CF8' }}>editar</strong> e descreva o que mudar. O resto da imagem permanece intacto.
              </span>
            </>
          )}
          {mode === 'remove' && (
            <>
              <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#F87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>
              </svg>
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                Desenhe a área que deseja <strong style={{ color: '#F87171' }}>remover</strong>. A IA preencherá o espaço com o fundo natural da cena.
              </span>
            </>
          )}
          {selectionMode === 'smart' && (
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, minWidth: 180 }}>
              <span style={{ fontSize: 10, color: 'var(--text-4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Tolerância
              </span>
              <input
                type="range"
                min={12}
                max={72}
                value={smartTolerance}
                onChange={e => setSmartTolerance(Number(e.target.value))}
                style={{ width: 92, accentColor: '#22D3EE' }}
              />
              <span style={{ fontSize: 11, color: '#22D3EE', fontFamily: 'var(--mono)', width: 22 }}>
                {smartTolerance}
              </span>
            </div>
          )}
        </div>

        {/* ── Canvas area ── */}
        <div style={{ flex: 1, overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'var(--bg)' }}>
          <div
            ref={containerRef}
            style={{ position: 'relative', userSelect: 'none', cursor: 'crosshair', display: 'inline-block', lineHeight: 0 }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onContextMenu={selectionMode === 'smart' ? (e => e.preventDefault()) : undefined}
          >
            <img
              ref={imageRef}
              src={imageUrl}
              alt="Selecione uma região"
              style={{ maxWidth: '100%', maxHeight: '58vh', objectFit: 'contain', display: 'block', pointerEvents: 'none' }}
              draggable={false}
            />

            {smartMask && (
              <>
                <img
                  src={smartMask.previewUrl}
                  alt="Máscara inteligente"
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
                />
                <div style={{
                  position: 'absolute',
                  left: smartMask.bbox.x,
                  top: smartMask.bbox.y,
                  width: smartMask.bbox.width,
                  height: smartMask.bbox.height,
                  border: '1px solid rgba(34,211,238,0.9)',
                  boxShadow: '0 0 0 1px rgba(0,0,0,0.25)',
                  borderRadius: 4,
                  pointerEvents: 'none',
                }} />
              </>
            )}

            {isSmartSelecting && (
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(0,0,0,0.18)', pointerEvents: 'none',
              }}>
                <div style={{
                  padding: '7px 10px', borderRadius: 8,
                  background: 'rgba(15,23,42,0.86)',
                  border: '1px solid rgba(34,211,238,0.35)',
                  color: '#22D3EE', fontSize: 11, fontWeight: 700,
                }}>
                  Selecionando objeto…
                </div>
              </div>
            )}

            {isDetecting && (
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(0,0,0,0.32)', pointerEvents: 'none',
              }}>
                <div style={{
                  padding: '7px 10px', borderRadius: 8,
                  background: 'rgba(15,23,42,0.86)',
                  border: '1px solid rgba(168,85,247,0.35)',
                  color: '#A855F7', fontSize: 11, fontWeight: 700,
                }}>
                  Analisando imagem…
                </div>
              </div>
            )}

            {detectedObjects && detectedObjects.length > 0 && !smartMask && (
              <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                {detectedObjects.map((obj, i) => {
                  const bounds = getDisplayImageBounds();
                  const w = bounds?.width ?? 0;
                  const h = bounds?.height ?? 0;
                  return (
                    <button
                      key={`obj-${i}`}
                      onClick={(e) => { e.stopPropagation(); handlePickObject(obj); }}
                      title={`${obj.label} (${Math.round(obj.score * 100)}%)`}
                      style={{
                        position: 'absolute',
                        left: obj.bbox.x * w,
                        top: obj.bbox.y * h,
                        width: obj.bbox.width * w,
                        height: obj.bbox.height * h,
                        border: '2px solid rgba(168,85,247,0.85)',
                        background: 'rgba(168,85,247,0.10)',
                        borderRadius: 4,
                        cursor: 'pointer',
                        pointerEvents: 'auto',
                        padding: 0,
                        boxShadow: '0 0 0 1px rgba(0,0,0,0.4)',
                        transition: 'background .12s ease',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(168,85,247,0.28)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'rgba(168,85,247,0.10)')}
                    >
                      <span style={{
                        position: 'absolute', top: -22, left: 0,
                        padding: '2px 6px', borderRadius: 4,
                        background: 'rgba(15,23,42,0.92)',
                        border: '1px solid rgba(168,85,247,0.5)',
                        color: '#E9D5FF', fontSize: 10, fontWeight: 700,
                        whiteSpace: 'nowrap',
                      }}>
                        {obj.label} · {Math.round(obj.score * 100)}%
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {detectedObjects && detectedObjects.length === 0 && !isDetecting && (
              <div style={{
                position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)',
                padding: '6px 10px', borderRadius: 8,
                background: 'rgba(15,23,42,0.86)',
                border: '1px solid rgba(168,85,247,0.35)',
                color: '#A855F7', fontSize: 11, fontWeight: 700,
              }}>
                Nenhum objeto detectado — clique no objeto manualmente.
              </div>
            )}

            {/* SVG polygon overlay */}
            {(() => {
              const stroke = mode === 'analyze' ? '#22D3EE' : mode === 'edit' ? '#818CF8' : '#F87171';
              const fill = mode === 'analyze' ? 'rgba(34,211,238,0.20)' : mode === 'edit' ? 'rgba(129,140,248,0.22)' : 'rgba(239,68,68,0.28)';
              return (
                <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none' }}>
                  {hasPath && (
                    <polygon points={svgPoints} fill={fill} stroke={stroke} strokeWidth={2} strokeLinejoin="round" strokeDasharray={isDrawing ? undefined : '6 3'} />
                  )}
                  {isDrawing && points.length > 1 && (
                    <polyline points={svgPoints} fill="none" stroke={stroke} strokeWidth={2} strokeLinejoin="round" />
                  )}
                  {points.length > 0 && (
                    <circle cx={points[0].x} cy={points[0].y} r={5} fill={stroke} opacity={0.9} />
                  )}
                  {smartPositive.map((p, i) => (
                    <g key={`pos-${i}`}>
                      <circle cx={p.x} cy={p.y} r={7} fill="#10B981" stroke="#fff" strokeWidth={2} />
                      <path d={`M${p.x - 3},${p.y} L${p.x},${p.y + 3} L${p.x + 3},${p.y - 3}`} stroke="#fff" strokeWidth={1.8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </g>
                  ))}
                  {smartNegative.map((p, i) => (
                    <g key={`neg-${i}`}>
                      <circle cx={p.x} cy={p.y} r={7} fill="#EF4444" stroke="#fff" strokeWidth={2} />
                      <path d={`M${p.x - 3},${p.y} L${p.x + 3},${p.y}`} stroke="#fff" strokeWidth={1.8} strokeLinecap="round" />
                    </g>
                  ))}
                </svg>
              );
            })()}
          </div>
        </div>

        {/* ── Edit instruction (only in edit mode) ── */}
        {mode === 'edit' && (
          <div style={{
            padding: '10px 18px', borderTop: '1px solid var(--border)',
            background: 'rgba(129,140,248,0.04)', flexShrink: 0,
            maxHeight: '40vh', overflowY: 'auto',
            display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#818CF8', display: 'block', marginBottom: 6 }}>
                O que fazer nessa área?
              </label>
              <textarea
                value={editInstruction}
                onChange={e => setEditInstruction(e.target.value)}
                placeholder="Ex: trocar o cartão por um celular, manter a mão igual"
                rows={2}
                style={{
                  width: '100%', padding: '8px 10px', borderRadius: 7, resize: 'none',
                  background: 'var(--surface)', border: '1px solid rgba(129,140,248,0.35)',
                  color: 'var(--text-1)', fontSize: 13, outline: 'none',
                  fontFamily: 'inherit', lineHeight: 1.5,
                }}
                onFocus={e => (e.currentTarget.style.borderColor = '#818CF8')}
                onBlur={e => (e.currentTarget.style.borderColor = 'rgba(129,140,248,0.35)')}
                autoFocus
              />
            </div>

            {onReferencesChange && (
              <SceneReferencesPanel
                references={references ?? []}
                onChange={onReferencesChange}
                disabled={isProcessing}
              />
            )}
          </div>
        )}

        {/* ── Instruction bar ── */}
        <div style={{ padding: '8px 18px', flexShrink: 0, borderTop: '1px solid var(--border)', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="var(--text-4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span style={{ fontSize: 11, color: 'var(--text-4)' }}>
            {isSmartSelecting
              ? 'Ajustando a seleção ao objeto…'
              : selectionMode === 'smart'
                ? smartMask
                  ? `${smartMask.source === 'sam2' ? 'SAM 2' : 'Local'} · ${smartMask.pixelCount.toLocaleString('pt-BR')} pixels selecionados${smartMask.score ? ` · score ${smartMask.score.toFixed(2)}` : ''}.`
                  : 'Clique no objeto que deseja selecionar. Ajuste a tolerância para ampliar ou reduzir a seleção.'
                : isDrawing
              ? 'Segure e arraste para desenhar…'
              : hasPath
                ? `${points.length} pontos — clique em Limpar para redesenhar.`
                : 'Clique e arraste para desenhar a seleção livremente.'}
          </span>
        </div>

        {/* ── Footer ── */}
        <div style={{
          padding: '12px 18px', borderTop: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexShrink: 0,
        }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {mode === 'analyze' && (
              <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={handleAnalyzeWhole}>
                Imagem inteira
              </button>
            )}
            {hasSelection && (
              <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={reset}>
                Limpar
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost" onClick={onClose} style={{ fontSize: 12 }}>
              Cancelar
            </button>
            <button
              className="btn btn-primary"
              disabled={!hasSelection || isProcessing || isSmartSelecting || (mode === 'edit' && !editInstruction.trim())}
              onClick={handleConfirm}
              style={{
                fontSize: 12,
                background: mode === 'remove' ? 'rgba(239,68,68,0.85)' : mode === 'edit' ? 'rgba(129,140,248,0.85)' : undefined,
                borderColor: mode === 'remove' ? 'rgba(239,68,68,0.5)' : mode === 'edit' ? 'rgba(129,140,248,0.5)' : undefined,
              }}
            >
              {isProcessing ? (
                <>
                  <div style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', animation: 'spin .7s linear infinite' }} />
                  Preparando…
                </>
              ) : mode === 'analyze' ? (
                <>
                  <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                  </svg>
                  Analisar Região
                </>
              ) : mode === 'edit' ? (
                <>
                  <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                  </svg>
                  Editar Região
                </>
              ) : (
                <>
                  <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
                  </svg>
                  Remover Região
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageRegionSelectorModal;
