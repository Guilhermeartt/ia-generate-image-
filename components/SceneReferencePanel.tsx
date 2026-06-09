import React, { useState, useRef, useCallback } from 'react';
import type { Scene } from '../types';
import { CropIcon, SparklesIcon } from './icons';
import Spinner from './ui/Spinner';
import { cropImageToRegion } from '../utils/imageHelpers';
import { REF_QUICK_PROMPTS, REF_BLEND_SUGGESTIONS } from './sceneCard.constants';

type RefExtra = { id: string; previewUrl: string; base64Data: string; mimeType: string };

interface SceneReferencePanelProps {
  scene: Scene;
  scenes: Scene[];
  isBusy: boolean;
  onVisualizeWithReference: (
    id: number,
    prompt: string,
    croppedBase64: string | null,
    croppedMimeType: string | null,
    extraReferences?: { base64Data: string; mimeType: string }[],
    blendInstruction?: string,
  ) => void;
  onClose: () => void;
}

const REF_MIN_DIST = 4;
const refPolyBBox = (pts: { x: number; y: number }[]) => {
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
};

/**
 * Painel modal "Gerar com Referência Visual": desenho de região por polígono,
 * crop, seleção de outra cena como referência, drag-drop de imagens de objetos
 * e prompt de geração. Sub-feature autossuficiente extraída do SceneCard — todo
 * o estado de desenho/crop/refs vive aqui; o pai só controla abrir/fechar.
 */
const SceneReferencePanel: React.FC<SceneReferencePanelProps> = ({
  scene,
  scenes,
  isBusy,
  onVisualizeWithReference,
  onClose,
}) => {
  const [refPoints, setRefPoints] = useState<{ x: number; y: number }[]>([]);
  const [refIsDrawingPoly, setRefIsDrawingPoly] = useState(false);
  const [refPrompt, setRefPrompt] = useState(scene.image_prompt);
  const [refCroppedPreview, setRefCroppedPreview] = useState<string | null>(null);
  const [refIsCropping, setRefIsCropping] = useState(false);
  const [refRefScene, setRefRefScene] = useState<Scene | null>(null);
  const [refExtraRefs, setRefExtraRefs] = useState<RefExtra[]>([]);
  const [isRefExtraDragging, setIsRefExtraDragging] = useState(false);
  const [refBlend, setRefBlend] = useState('');
  const refImgEl = useRef<HTMLImageElement>(null);
  const refFileEl = useRef<HTMLInputElement>(null);
  const refExtraDragDepth = useRef(0);

  const getRefPointerXY = (e: React.PointerEvent<HTMLDivElement>): { x: number; y: number } | null => {
    if (!refImgEl.current) return null;
    const r = refImgEl.current.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(e.clientX - r.left, r.width)),
      y: Math.max(0, Math.min(e.clientY - r.top, r.height)),
    };
  };

  const onRefPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (refRefScene) return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const pt = getRefPointerXY(e);
    if (!pt) return;
    setRefPoints([pt]);
    setRefIsDrawingPoly(true);
    setRefCroppedPreview(null);
  };

  const onRefPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!refIsDrawingPoly) return;
    const pt = getRefPointerXY(e);
    if (!pt) return;
    setRefPoints((prev) => {
      if (prev.length === 0) return [pt];
      const last = prev[prev.length - 1];
      if (Math.sqrt((last.x - pt.x) ** 2 + (last.y - pt.y) ** 2) < REF_MIN_DIST) return prev;
      return [...prev, pt];
    });
  };

  const onRefPointerUp = useCallback(async () => {
    if (!refIsDrawingPoly) return;
    setRefIsDrawingPoly(false);
    if (refPoints.length >= 3 && refImgEl.current) {
      setRefIsCropping(true);
      try {
        const r = refImgEl.current.getBoundingClientRect();
        const bb = refPolyBBox(refPoints);
        const { base64, mimeType } = await cropImageToRegion(scene.imageUrl!, bb, r.width, r.height);
        setRefCroppedPreview(`data:${mimeType};base64,${base64}`);
      } catch {
        setRefCroppedPreview(null);
      } finally {
        setRefIsCropping(false);
      }
    } else {
      setRefCroppedPreview(null);
      if (refPoints.length < 3) setRefPoints([]);
    }
  }, [refIsDrawingPoly, refPoints, scene.imageUrl]);

  const addRefExtraFiles = (fileList: FileList | File[] | null) => {
    const files = Array.from(fileList ?? []) as File[];
    files
      .filter((f: File) => ['image/png', 'image/jpeg', 'image/webp'].includes(f.type))
      .forEach((file: File) => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const dataUrl = ev.target?.result as string;
          const [hdr, b64] = dataUrl.split(',');
          setRefExtraRefs((p) => [
            ...p,
            {
              id: `${Date.now()}${Math.random()}`,
              previewUrl: dataUrl,
              base64Data: b64,
              mimeType: hdr.match(/:(.*?);/)?.[1] || file.type,
            },
          ]);
        };
        reader.readAsDataURL(file);
      });
  };

  const onRefFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    addRefExtraFiles(e.target.files);
    if (e.target) e.target.value = '';
  };

  const onRefExtraDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    refExtraDragDepth.current += 1;
    if (!isBusy) setIsRefExtraDragging(true);
  };

  const onRefExtraDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const onRefExtraDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    refExtraDragDepth.current = Math.max(0, refExtraDragDepth.current - 1);
    if (refExtraDragDepth.current === 0) setIsRefExtraDragging(false);
  };

  const onRefExtraDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    refExtraDragDepth.current = 0;
    setIsRefExtraDragging(false);
    if (isBusy) return;
    addRefExtraFiles(event.dataTransfer.files);
  };

  const onRefGenerate = async () => {
    const extra = refExtraRefs.length > 0 ? refExtraRefs.map((r) => ({ base64Data: r.base64Data, mimeType: r.mimeType })) : undefined;
    const blend = refBlend.trim() || undefined;
    if (refRefScene?.imageUrl && refRefScene.imageMimeType) {
      onVisualizeWithReference(scene.id, refPrompt, refRefScene.imageUrl.split(',')[1], refRefScene.imageMimeType, extra, blend);
      onClose();
      return;
    }
    let cb64: string | null = null;
    let cmime: string | null = null;
    if (refPoints.length >= 3 && refImgEl.current) {
      try {
        const r = refImgEl.current.getBoundingClientRect();
        const bb = refPolyBBox(refPoints);
        const res = await cropImageToRegion(scene.imageUrl!, bb, r.width, r.height);
        cb64 = res.base64;
        cmime = res.mimeType;
      } catch {
        /* sem crop */
      }
    }
    onVisualizeWithReference(scene.id, refPrompt, cb64, cmime, extra, blend);
    onClose();
  };

  const refValidSel = refPoints.length >= 3;
  const refScenes = scenes.filter((s) => s.id !== scene.id && s.imageUrl && s.imageMimeType);

  return (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          }}
          onClick={() => onClose()}
        >
          <div
            className="card"
            style={{ width: 'min(1040px, 96vw)', maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            onClick={e => e.stopPropagation()}
          >

          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 18px', borderBottom: '1px solid var(--border)',
            background: 'var(--surface-2)', flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <CropIcon width={14} height={14} style={{ color: '#22D3EE', flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.01em' }}>Gerar com Referência Visual</p>
                <p style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 2 }}>
                  {refRefScene
                    ? `Cena ${refRefScene.scene_id}-${refRefScene.sub_id} como referência`
                    : refValidSel
                    ? 'Região selecionada ativa'
                    : 'Selecione uma cena, desenhe uma região ou adicione imagens de objetos'}
                </p>
              </div>
            </div>
            <button
              onClick={() => onClose()}
              className="icon-btn"
              title="Fechar"
            >
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          {/* Body */}
          <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>

            {/* LEFT — imagem com desenho de área */}
            <div style={{ flex: 1, position: 'relative', borderRight: '1px solid var(--border)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              {/* Instruction bar */}
              <div style={{
                padding: '6px 14px', borderBottom: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'var(--surface-2)', flexShrink: 0,
              }}>
                <span style={{ fontSize: 11, color: 'var(--text-4)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CropIcon width={11} height={11} />
                  {refRefScene
                    ? 'Seleção de região desativada — cena de referência ativa'
                    : refValidSel
                    ? 'Região desenhada — desenhe novamente para refazer'
                    : 'Clique e arraste livremente sobre a imagem para desenhar a seleção'}
                </span>
                {refValidSel && !refRefScene && (
                  <button
                    onClick={() => { setRefPoints([]); setRefCroppedPreview(null); }}
                    style={{ fontSize: 11, color: 'var(--text-4)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--red)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-4)')}
                  >✕ Limpar</button>
                )}
              </div>

              {/* Drawing zone */}
              <div
                style={{
                  flex: 1, padding: 20,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'var(--bg)',
                  cursor: refRefScene ? 'not-allowed' : 'crosshair',
                  userSelect: 'none', overflow: 'hidden',
                }}
                onPointerDown={onRefPointerDown}
                onPointerMove={onRefPointerMove}
                onPointerUp={onRefPointerUp}
              >
                <div style={{ position: 'relative', display: 'inline-block', lineHeight: 0 }}>
                  <img
                    ref={refImgEl}
                    src={scene.imageUrl}
                    alt="Imagem atual"
                    draggable={false}
                    style={{
                      maxWidth: '100%', maxHeight: '58vh',
                      objectFit: 'contain', display: 'block',
                      borderRadius: 10,
                      opacity: refRefScene ? 0.15 : 1,
                      transition: 'opacity .2s ease',
                      pointerEvents: 'none',
                    }}
                  />

                  {/* Ref scene overlay */}
                  {refRefScene?.imageUrl && (
                    <div style={{
                      position: 'absolute', inset: 0,
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      gap: 8, pointerEvents: 'none',
                    }}>
                      <img
                        src={refRefScene.imageUrl}
                        alt={`Cena ${refRefScene.scene_id}-${refRefScene.sub_id}`}
                        style={{ maxHeight: 240, maxWidth: '92%', borderRadius: 9, border: '2px solid #22D3EE', objectFit: 'contain' }}
                      />
                      <span style={{
                        background: 'rgba(6,182,212,0.92)', color: '#fff',
                        fontSize: 11, fontWeight: 600, padding: '4px 12px', borderRadius: 20,
                      }}>
                        Cena {refRefScene.scene_id}-{refRefScene.sub_id} · {refRefScene.original_location}
                      </span>
                    </div>
                  )}

                  {/* SVG polygon overlay */}
                  {refPoints.length > 0 && !refRefScene && (
                    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none' }}>
                      {refPoints.length >= 3 && (
                        <polygon
                          points={refPoints.map(p => `${p.x},${p.y}`).join(' ')}
                          fill="rgba(34,211,238,0.18)"
                          stroke="#22D3EE"
                          strokeWidth={2}
                          strokeLinejoin="round"
                          strokeDasharray={refIsDrawingPoly ? undefined : '6 3'}
                        />
                      )}
                      {refIsDrawingPoly && refPoints.length > 1 && (
                        <polyline
                          points={refPoints.map(p => `${p.x},${p.y}`).join(' ')}
                          fill="none"
                          stroke="#22D3EE"
                          strokeWidth={2}
                          strokeLinejoin="round"
                        />
                      )}
                      <circle cx={refPoints[0].x} cy={refPoints[0].y} r={5} fill="#22D3EE" opacity={0.9} />
                    </svg>
                  )}
                </div>
              </div>
            </div>

            {/* RIGHT — controles */}
            <div style={{
              width: 300, flexShrink: 0,
              display: 'flex', flexDirection: 'column',
              padding: '14px 16px', gap: 14, overflowY: 'auto',
            }}>

              {/* Scene selector */}
              {refScenes.length > 0 && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <label className="label">Usar outra cena</label>
                    {refRefScene && (
                      <button
                        onClick={() => setRefRefScene(null)}
                        style={{ fontSize: 10, color: 'var(--text-4)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                        onMouseEnter={e => (e.currentTarget.style.color = 'var(--red)')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-4)')}
                      >✕ Limpar</button>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
                    {refScenes.map(s => {
                      const isSel = refRefScene?.id === s.id;
                      return (
                        <button
                          key={s.id}
                          onClick={() => setRefRefScene(prev => prev?.id === s.id ? null : s)}
                          title={`${s.original_location} (Cena ${s.scene_id}-${s.sub_id})`}
                          style={{
                            flexShrink: 0, width: 72, borderRadius: 7, overflow: 'hidden', padding: 0,
                            border: isSel ? '2px solid #22D3EE' : '1px solid var(--border-md)',
                            background: 'var(--surface-2)', cursor: 'pointer',
                          }}
                        >
                          <img src={s.imageUrl!} alt={`C${s.scene_id}-${s.sub_id}`} style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block' }} />
                          <div style={{ padding: '3px 5px', background: isSel ? '#0891B2' : 'var(--surface-3)' }}>
                            <p style={{ fontSize: 9, fontWeight: 700, fontFamily: 'var(--mono)', color: isSel ? '#fff' : 'var(--text-2)' }}>C{s.scene_id}-{s.sub_id}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <p style={{ fontSize: 10, color: refRefScene ? '#22D3EE' : 'var(--text-4)', marginTop: 4 }}>
                    {refRefScene ? `✦ Cena ${refRefScene.scene_id}-${refRefScene.sub_id} selecionada` : 'Ou arraste na imagem para selecionar uma região'}
                  </p>
                  <div style={{ marginTop: 10, borderTop: '1px solid var(--border)' }} />
                </div>
              )}

              {/* Cropped region preview */}
              {!refRefScene && (refCroppedPreview || refIsCropping) && (
                <div>
                  <label className="label">Região selecionada</label>
                  <div style={{
                    borderRadius: 7, overflow: 'hidden',
                    border: '1px solid rgba(34,211,238,0.35)',
                    background: 'var(--surface-2)',
                    minHeight: 56, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {refIsCropping
                      ? <Spinner size={14} />
                      : <img src={refCroppedPreview!} alt="Região" style={{ maxWidth: '100%', maxHeight: 110, objectFit: 'contain', display: 'block' }} />
                    }
                  </div>
                  <p style={{ fontSize: 10, color: '#22D3EE', marginTop: 3 }}>✦ Esta região será enviada como referência visual</p>
                </div>
              )}

              {/* Extra refs (objetos) */}
              <div
                onDragEnter={onRefExtraDragEnter}
                onDragOver={onRefExtraDragOver}
                onDragLeave={onRefExtraDragLeave}
                onDrop={onRefExtraDrop}
                style={{
                  borderRadius: 8,
                  padding: isRefExtraDragging ? 6 : 0,
                  margin: isRefExtraDragging ? -6 : 0,
                  background: isRefExtraDragging ? 'rgba(245,158,11,0.08)' : 'transparent',
                  outline: isRefExtraDragging ? '1px solid rgba(245,158,11,0.38)' : '1px solid transparent',
                  transition: 'background .15s, outline-color .15s, padding .15s, margin .15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <label className="label" style={{ color: 'var(--amber)', marginBottom: 0 }}>Referências de objetos</label>
                  <button
                    onClick={() => refFileEl.current?.click()}
                    style={{ fontSize: 10, color: 'var(--amber)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >+ Adicionar</button>
                </div>
                <input ref={refFileEl} type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={onRefFileChange} style={{ display: 'none' }} />

                {refExtraRefs.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                    {refExtraRefs.map((ref, i) => (
                      <div key={ref.id} className="group" style={{ position: 'relative', flexShrink: 0 }}>
                        <img src={ref.previewUrl} alt={`Ref ${i + 1}`} style={{ width: 56, height: 42, objectFit: 'cover', borderRadius: 6, border: '2px solid rgba(245,158,11,0.5)', display: 'block' }} />
                        <span style={{
                          position: 'absolute', top: -5, left: -5, width: 16, height: 16,
                          borderRadius: '50%', background: 'var(--amber)', color: '#fff',
                          fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700,
                        }}>{i + 1}</span>
                        <button
                          onClick={() => setRefExtraRefs(p => p.filter(r => r.id !== ref.id))}
                          className="group-hover:opacity-100"
                          style={{
                            position: 'absolute', inset: 0, borderRadius: 6, background: 'rgba(0,0,0,0.55)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            opacity: 0, border: 'none', cursor: 'pointer', color: '#fff', fontSize: 14,
                            transition: 'opacity .12s ease',
                          }}
                        >✕</button>
                      </div>
                    ))}
                    <button
                      onClick={() => refFileEl.current?.click()}
                      style={{
                        width: 56, height: 42, borderRadius: 6, cursor: 'pointer',
                        border: `2px dashed ${isRefExtraDragging ? 'rgba(245,158,11,0.7)' : 'rgba(245,158,11,0.3)'}`,
                        background: isRefExtraDragging ? 'rgba(245,158,11,0.08)' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'rgba(245,158,11,0.5)', fontSize: 18,
                      }}
                    >+</button>
                  </div>
                ) : (
                  <div
                    onClick={() => refFileEl.current?.click()}
                    style={{
                      border: `2px dashed ${isRefExtraDragging ? 'rgba(245,158,11,0.72)' : 'rgba(245,158,11,0.2)'}`, borderRadius: 7,
                      padding: '8px 10px', textAlign: 'center', cursor: 'pointer', marginBottom: 8,
                      background: isRefExtraDragging ? 'rgba(245,158,11,0.08)' : 'transparent',
                      transition: 'background .15s, border-color .15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(245,158,11,0.45)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = isRefExtraDragging ? 'rgba(245,158,11,0.72)' : 'rgba(245,158,11,0.2)')}
                  >
                    <p style={{ fontSize: 11, color: 'var(--text-4)', lineHeight: 1.5 }}>
                      {isRefExtraDragging ? (
                        <span style={{ color: 'var(--amber)' }}>Solte as imagens aqui para mesclar.</span>
                      ) : (
                        <>
                          <span style={{ color: 'var(--amber)' }}>Adicione imagens</span> de objetos ou estilos para mesclar
                        </>
                      )}
                    </p>
                  </div>
                )}

                {refExtraRefs.length > 0 && (
                  <div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                      {REF_BLEND_SUGGESTIONS.map(s => (
                        <button
                          key={s}
                          onClick={() => setRefBlend(s)}
                          style={{
                            fontSize: 10, padding: '2px 7px', borderRadius: 20, cursor: 'pointer',
                            border: refBlend === s ? '1px solid var(--amber)' : '1px solid var(--border-md)',
                            background: refBlend === s ? 'rgba(245,158,11,0.1)' : 'transparent',
                            color: refBlend === s ? 'var(--amber)' : 'var(--text-3)',
                          }}
                        >{s}</button>
                      ))}
                    </div>
                    <textarea
                      value={refBlend}
                      onChange={e => setRefBlend(e.target.value)}
                      className="field"
                      rows={2}
                      placeholder="Como mesclar? Ex: use a cadeira como elemento central, mantendo a iluminação..."
                      style={{ fontSize: 11, resize: 'none', width: '100%' }}
                      disabled={isBusy}
                    />
                  </div>
                )}
              </div>

              {/* Quick prompts */}
              <div>
                <label className="label">Sugestões rápidas</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {REF_QUICK_PROMPTS.map(s => (
                    <button
                      key={s}
                      onClick={() => setRefPrompt(s)}
                      style={{
                        fontSize: 10, padding: '2px 7px', borderRadius: 20, cursor: 'pointer',
                        border: refPrompt === s ? '1px solid #22D3EE' : '1px solid var(--border-md)',
                        background: refPrompt === s ? 'rgba(34,211,238,0.1)' : 'transparent',
                        color: refPrompt === s ? '#22D3EE' : 'var(--text-3)',
                      }}
                    >{s}</button>
                  ))}
                </div>
              </div>

              {/* Prompt textarea */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <label className="label">Prompt de geração</label>
                <textarea
                  value={refPrompt}
                  onChange={e => setRefPrompt(e.target.value)}
                  className="field"
                  rows={4}
                  style={{ resize: 'none', fontSize: 12, flex: 1 }}
                  disabled={isBusy}
                />
              </div>

              {/* Generate button */}
              <button
                onClick={onRefGenerate}
                disabled={isBusy || !refPrompt.trim()}
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center' }}
              >
                {isBusy ? <Spinner size={13} /> : <SparklesIcon width={13} height={13} />}
                {isBusy ? 'Gerando…'
                  : refRefScene
                    ? `Gerar com Cena ${refRefScene.scene_id}-${refRefScene.sub_id}`
                    : refExtraRefs.length > 0
                    ? `Gerar com ${refExtraRefs.length} ref.`
                    : refValidSel
                    ? 'Gerar com Região Selecionada'
                    : 'Gerar'}
              </button>
            </div>
          </div>
          </div>
        </div>
  );
};

export default SceneReferencePanel;
