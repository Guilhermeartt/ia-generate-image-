import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import SvgCanvas from './SvgCanvas';
import SvgPropertiesPanel from './SvgPropertiesPanel';
import SvgTemplateLibrary from './SvgTemplateLibrary';
import SvgToolbar from './SvgToolbar';
import AnimatedTemplatePreview from './AnimatedTemplatePreview';
import { buildPreviewContents } from './templateBinding';
import { prepareSvgImport } from './svgImport';
import type { SlotAnimation } from './slotAnimation';
import type { SlotType, SvgCamera, SvgEditorDocument, SvgTool } from './types';
import {
  createBlankSvg,
  duplicateSvgElement,
  getSlotMeta,
  getSvgElementProperties,
  listSlots,
  listSvgLayers,
  markSlot,
  parseViewBox,
  removeSvgElement,
  reorderSvgElement,
  resizeSvgElement,
  sanitizeSvg,
  setSvgElementLocked,
  setSvgElementVisibility,
  setViewBox,
  translateSvgElement,
  unmarkSlot,
  updateSvgElement,
  updateSvgText,
} from './svgDocument';

interface HistoryState {
  past: string[];
  future: string[];
}

interface EditorMessage {
  text: string;
  tone: 'success' | 'warning' | 'error' | 'info';
}

const DRAFT_KEY = 'svg-editor-draft-v1';

const initialDocument = (): SvgEditorDocument => {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (raw) {
      const draft = JSON.parse(raw) as Partial<SvgEditorDocument>;
      if (typeof draft.name === 'string' && typeof draft.markup === 'string') {
        return { name: draft.name, markup: sanitizeSvg(draft.markup) };
      }
    }
  } catch {
    // Rascunho ausente ou inválido: abre um documento novo.
  }
  return { name: 'ilustracao', markup: createBlankSvg() };
};

const SvgEditor: React.FC = () => {
  const [documentState, setDocumentState] = useState<SvgEditorDocument>(initialDocument);
  const [history, setHistory] = useState<HistoryState>({ past: [], future: [] });
  const [tool, setTool] = useState<SvgTool>('select');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState<EditorMessage | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [showSafeArea, setShowSafeArea] = useState(true);
  const [draftSaved, setDraftSaved] = useState(true);
  const importInputRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);
  const [pointerPosition, setPointerPosition] = useState<{ x: number; y: number } | null>(null);
  const [currentTemplateId, setCurrentTemplateId] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [camera, setCamera] = useState<SvgCamera>({ x: 0, y: 0, zoom: 1 });
  const [snapToGrid, setSnapToGrid] = useState(true);
  const lastCommitRef = useRef<{ key: string; time: number } | null>(null);
  const properties = useMemo(
    () => (selectedId ? getSvgElementProperties(documentState.markup, selectedId) : null),
    [documentState.markup, selectedId],
  );
  const layers = useMemo(() => listSvgLayers(documentState.markup), [documentState.markup]);
  const slots = useMemo(() => listSlots(documentState.markup), [documentState.markup]);
  const viewBox = useMemo(() => parseViewBox(documentState.markup), [documentState.markup]);
  const previewContents = useMemo(() => buildPreviewContents(slots), [slots]);
  const selectedSlot = useMemo(
    () => (selectedId ? getSlotMeta(documentState.markup, selectedId) : null),
    [documentState.markup, selectedId],
  );

  const commit = useCallback(
    (before: string, after: string, label: string, nextSelectedId?: string) => {
      if (before === after) return;
      const now = Date.now();
      const key = `${label}:${nextSelectedId ?? selectedId ?? ''}`;
      const coalesce = lastCommitRef.current?.key === key && now - lastCommitRef.current.time < 700;
      setDraftSaved(false);
      setHistory((current) => ({
        past: coalesce ? current.past : [...current.past, before].slice(-100),
        future: [],
      }));
      setDocumentState((current) => ({ ...current, markup: after }));
      if (nextSelectedId !== undefined) setSelectedId(nextSelectedId);
      lastCommitRef.current = { key, time: now };
    },
    [selectedId],
  );

  const applyChange = useCallback(
    (after: string, label: string, nextSelectedId?: string) => {
      commit(documentState.markup, after, label, nextSelectedId);
    },
    [commit, documentState.markup],
  );

  const markSelectedSlot = useCallback(
    (type: SlotType) => {
      if (!selectedId) return;
      applyChange(
        markSlot(documentState.markup, selectedId, { type, name: selectedSlot?.name ?? '' }),
        'Marcar slot',
        selectedId,
      );
    },
    [applyChange, documentState.markup, selectedId, selectedSlot],
  );

  const unmarkSelectedSlot = useCallback(() => {
    if (!selectedId) return;
    applyChange(unmarkSlot(documentState.markup, selectedId), 'Remover slot', selectedId);
  }, [applyChange, documentState.markup, selectedId]);

  const changeAspect = useCallback(
    (width: number, height: number) => {
      applyChange(setViewBox(documentState.markup, width, height), 'Proporção do quadro');
    },
    [applyChange, documentState.markup],
  );

  const renameSelectedSlot = useCallback(
    (name: string) => {
      if (!selectedId || !selectedSlot) return;
      applyChange(
        markSlot(documentState.markup, selectedId, { type: selectedSlot.type, name }),
        'Renomear slot',
        selectedId,
      );
    },
    [applyChange, documentState.markup, selectedId, selectedSlot],
  );

  const setSelectedSlotAnimation = useCallback(
    (animation: SlotAnimation | undefined) => {
      if (!selectedId || !selectedSlot) return;
      applyChange(
        markSlot(documentState.markup, selectedId, {
          type: selectedSlot.type,
          name: selectedSlot.name,
          animation,
        }),
        'Animação do slot',
        selectedId,
      );
    },
    [applyChange, documentState.markup, selectedId, selectedSlot],
  );

  const undo = useCallback(() => {
    lastCommitRef.current = null;
    if (history.past.length === 0) return;
    setDraftSaved(false);
    setHistory((current) => {
      const previous = current.past[current.past.length - 1];
      if (!previous) return current;
      setDocumentState((document) => ({ ...document, markup: previous }));
      setSelectedId(null);
      return {
        past: current.past.slice(0, -1),
        future: [documentState.markup, ...current.future].slice(0, 50),
      };
    });
  }, [documentState.markup, history.past.length]);

  const redo = useCallback(() => {
    lastCommitRef.current = null;
    if (history.future.length === 0) return;
    setDraftSaved(false);
    setHistory((current) => {
      const next = current.future[0];
      if (!next) return current;
      setDocumentState((document) => ({ ...document, markup: next }));
      setSelectedId(null);
      return {
        past: [...current.past, documentState.markup].slice(-50),
        future: current.future.slice(1),
      };
    });
  }, [documentState.markup, history.future.length]);

  const removeSelected = useCallback(() => {
    if (!selectedId) return;
    applyChange(removeSvgElement(documentState.markup, selectedId), 'Excluir elemento');
    setSelectedId(null);
  }, [applyChange, documentState.markup, selectedId]);

  const duplicateSelected = useCallback(() => {
    if (!selectedId) return;
    const result = duplicateSvgElement(documentState.markup, selectedId);
    if (result.id) applyChange(result.markup, 'Duplicar elemento', result.id);
  }, [applyChange, documentState.markup, selectedId]);

  const reorderSelected = useCallback(
    (direction: 'front' | 'back') => {
      if (!selectedId) return;
      applyChange(
        reorderSvgElement(documentState.markup, selectedId, direction),
        direction === 'front' ? 'Trazer para frente' : 'Enviar para o fundo',
        selectedId,
      );
    },
    [applyChange, documentState.markup, selectedId],
  );

  const importFiles = useCallback(
    async (files: File[]) => {
      if (isImporting) return;
      setIsImporting(true);
      setMessage({ text: 'Preparando arquivos e incorporando vínculos…', tone: 'info' });
      try {
        const file = files.find(
          (candidate) =>
            candidate.type === 'image/svg+xml' || candidate.name.toLowerCase().endsWith('.svg'),
        );
        if (!file) throw new Error('Selecione um arquivo SVG.');
        const prepared = await prepareSvgImport(
          await file.text(),
          files.filter((candidate) => candidate !== file),
        );
        const markup = sanitizeSvg(prepared.markup);
        commit(documentState.markup, markup, 'Importar SVG');
        setDocumentState({ name: file.name.replace(/\.svg$/i, '') || 'ilustracao', markup });
        setSelectedId(null);
        const embedded = [
          prepared.embeddedImages > 0 ? `${prepared.embeddedImages} imagem(ns) incorporada(s)` : '',
          prepared.embeddedFonts > 0 ? `${prepared.embeddedFonts} fonte(s) incorporada(s)` : '',
        ]
          .filter(Boolean)
          .join(' e ');
        const missing =
          prepared.unresolvedImages.length > 0
            ? ` Vínculos não encontrados: ${prepared.unresolvedImages
                .map((href) => href.replaceAll('\\', '/').split('/').pop())
                .join(', ')}. Selecione esses arquivos junto com o SVG.`
            : '';
        setMessage({
          text: `"${file.name}" importado com segurança.${embedded ? ` ${embedded}.` : ''}${missing}`,
          tone: prepared.unresolvedImages.length > 0 ? 'warning' : 'success',
        });
      } catch (error) {
        setMessage({
          text: error instanceof Error ? error.message : 'Não foi possível importar o SVG.',
          tone: 'error',
        });
      } finally {
        setIsImporting(false);
      }
    },
    [commit, documentState.markup, isImporting],
  );

  const exportSvg = useCallback(() => {
    const blob = new Blob([documentState.markup], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = window.document.createElement('a');
    link.href = url;
    link.download = `${documentState.name.trim() || 'ilustracao'}.svg`;
    link.click();
    URL.revokeObjectURL(url);
  }, [documentState]);

  const resetDocument = useCallback(() => {
    const markup = createBlankSvg();
    commit(documentState.markup, markup, 'Novo documento');
    setDocumentState({ name: 'ilustracao', markup });
    setSelectedId(null);
    setCamera({ x: 0, y: 0, zoom: 1 });
  }, [commit, documentState.markup]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      try {
        window.localStorage.setItem(DRAFT_KEY, JSON.stringify(documentState));
        setDraftSaved(true);
      } catch {
        // Persistência local indisponível; o editor continua funcional.
      }
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [documentState]);

  useEffect(() => {
    if (!message || !['success', 'info'].includes(message.tone)) return;
    const timeout = window.setTimeout(() => setMessage(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [message]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, textarea, select, [contenteditable="true"]')) return;
      const command = event.metaKey || event.ctrlKey;
      if (command && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (command && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        duplicateSelected();
        return;
      }
      if (command && event.key.toLowerCase() === 'o') {
        event.preventDefault();
        importInputRef.current?.click();
        return;
      }
      if (command && event.key.toLowerCase() === 's') {
        event.preventDefault();
        exportSvg();
        return;
      }
      if (command && event.key === '0') {
        event.preventDefault();
        setCamera({ x: 0, y: 0, zoom: 1 });
        return;
      }
      if (selectedId && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
        event.preventDefault();
        const amount = event.shiftKey ? 10 : 1;
        const dx = event.key === 'ArrowLeft' ? -amount : event.key === 'ArrowRight' ? amount : 0;
        const dy = event.key === 'ArrowUp' ? -amount : event.key === 'ArrowDown' ? amount : 0;
        applyChange(
          translateSvgElement(documentState.markup, selectedId, dx, dy),
          'Mover elemento pelo teclado',
          selectedId,
        );
        return;
      }
      if (event.key === 'Delete' || event.key === 'Backspace') removeSelected();
      if (event.key.toLowerCase() === 'v') setTool('select');
      if (event.key.toLowerCase() === 'r') setTool('rect');
      if (event.key.toLowerCase() === 'e') setTool('ellipse');
      if (event.key.toLowerCase() === 'l') setTool('line');
      if (event.key.toLowerCase() === 'p') setTool('freehand');
      if (event.key.toLowerCase() === 't') setTool('text');
      if (event.key.toLowerCase() === 's') setTool('star');
      if (event.key === 'Escape') {
        setTool('select');
        setSelectedId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    applyChange,
    documentState.markup,
    duplicateSelected,
    exportSvg,
    redo,
    removeSelected,
    selectedId,
    undo,
  ]);

  return (
    <section
      className="svg-editor-shell anim-fade"
      onDragEnter={(event) => {
        event.preventDefault();
        dragDepthRef.current += 1;
        if (event.dataTransfer.types.includes('Files')) setIsDraggingFiles(true);
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
        if (dragDepthRef.current === 0) setIsDraggingFiles(false);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        dragDepthRef.current = 0;
        setIsDraggingFiles(false);
        const files = Array.from(event.dataTransfer.files);
        if (files.some((file) => file.name.toLowerCase().endsWith('.svg'))) {
          void importFiles(files);
        } else {
          setMessage({
            text: 'Inclua um arquivo SVG junto com os assets vinculados.',
            tone: 'error',
          });
        }
      }}
    >
      <input
        ref={importInputRef}
        className="hidden"
        type="file"
        accept=".svg,image/svg+xml,image/png,image/jpeg,image/webp,.ttf,.otf,.woff,.woff2"
        multiple
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          if (files.length > 0) void importFiles(files);
          event.currentTarget.value = '';
        }}
      />
      <SvgToolbar
        tool={tool}
        canUndo={history.past.length > 0}
        canRedo={history.future.length > 0}
        hasSelection={!!selectedId}
        isImporting={isImporting}
        onToolChange={setTool}
        onUpload={(files) => void importFiles(files)}
        onUndo={undo}
        onRedo={redo}
        onDuplicate={duplicateSelected}
        onDelete={removeSelected}
        onFront={() => reorderSelected('front')}
        onBack={() => reorderSelected('back')}
        onExport={exportSvg}
        onNew={resetDocument}
        zoom={camera.zoom}
        onZoomIn={() => setCamera((value) => ({ ...value, zoom: Math.min(8, value.zoom * 1.2) }))}
        onZoomOut={() =>
          setCamera((value) => ({ ...value, zoom: Math.max(0.1, value.zoom / 1.2) }))
        }
        onFit={() => setCamera({ x: 0, y: 0, zoom: 1 })}
        snapToGrid={snapToGrid}
        onToggleSnap={() => setSnapToGrid((value) => !value)}
        showSafeArea={showSafeArea}
        onToggleSafeArea={() => setShowSafeArea((value) => !value)}
      />
      {message && (
        <div
          className={`svg-editor-message ${message.tone}`}
          role={message.tone === 'error' ? 'alert' : 'status'}
          aria-live="polite"
        >
          <span>{message.text}</span>
          <button type="button" onClick={() => setMessage(null)} aria-label="Fechar mensagem">
            ×
          </button>
        </div>
      )}
      {isDraggingFiles && (
        <div className="svg-editor-drop-overlay" role="status">
          <strong>Solte para importar</strong>
          <span>Inclua o SVG, imagens e fontes vinculadas</span>
        </div>
      )}
      <div className="svg-editor-body">
        <SvgPropertiesPanel
          properties={properties}
          layers={layers}
          selectedId={selectedId}
          documentName={documentState.name}
          viewBox={viewBox}
          onAspectChange={changeAspect}
          slot={selectedSlot}
          slots={slots}
          previewMode={previewMode}
          isImporting={isImporting}
          onTogglePreview={() => setPreviewMode((value) => !value)}
          onMarkSlot={markSelectedSlot}
          onUnmarkSlot={unmarkSelectedSlot}
          onRenameSlot={renameSelectedSlot}
          onAnimationChange={setSelectedSlotAnimation}
          libraryNode={
            <SvgTemplateLibrary
              documentName={documentState.name}
              markup={documentState.markup}
              currentTemplateId={currentTemplateId}
              onCurrentTemplateChange={setCurrentTemplateId}
              onLoad={(template) => {
                commit(documentState.markup, template.markup, 'Carregar modelo');
                setDocumentState({ name: template.name, markup: template.markup });
                setSelectedId(null);
                setCurrentTemplateId(template.id);
                setMessage({ text: `Modelo "${template.name}" carregado.`, tone: 'success' });
              }}
            />
          }
          onDocumentNameChange={(name) => {
            setDraftSaved(false);
            setDocumentState((current) => ({ ...current, name }));
          }}
          onSelect={(id) => {
            setTool('select');
            setSelectedId(id);
          }}
          onDeleteLayer={(id) => {
            applyChange(removeSvgElement(documentState.markup, id), 'Excluir elemento');
            if (selectedId === id) setSelectedId(null);
          }}
          onToggleLayerVisibility={(id, visible) => {
            applyChange(
              setSvgElementVisibility(documentState.markup, id, visible),
              'Alterar visibilidade',
              selectedId ?? undefined,
            );
          }}
          onToggleLayerLocked={(id, locked) => {
            applyChange(
              setSvgElementLocked(documentState.markup, id, locked),
              'Alterar bloqueio',
              selectedId ?? undefined,
            );
            if (locked && selectedId === id) setSelectedId(null);
          }}
          onUpload={(files) => void importFiles(files)}
          onChange={(attributes, label) => {
            if (!selectedId) return;
            applyChange(
              updateSvgElement(documentState.markup, selectedId, attributes),
              label,
              selectedId,
            );
          }}
          onTextChange={(text) => {
            if (!selectedId) return;
            applyChange(
              updateSvgText(documentState.markup, selectedId, text),
              'Editar texto',
              selectedId,
            );
          }}
          onBoundsChange={(bounds) => {
            if (!selectedId) return;
            applyChange(
              resizeSvgElement(documentState.markup, selectedId, bounds),
              'Alterar geometria',
              selectedId,
            );
          }}
        />
        {previewMode ? (
          <div
            className="svg-editor-canvas svg-template-preview"
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#ffffff',
              overflow: 'hidden',
            }}
          >
            <AnimatedTemplatePreview
              markup={documentState.markup}
              slots={slots}
              contents={previewContents}
              style={{ width: '100%', height: '100%', display: 'flex' }}
            />
          </div>
        ) : (
          <SvgCanvas
            markup={documentState.markup}
            tool={tool}
            selectedId={selectedId}
            viewBox={viewBox}
            camera={camera}
            onCameraChange={setCamera}
            snapToGrid={snapToGrid}
            showSafeArea={showSafeArea}
            onSelect={setSelectedId}
            onPointerPosition={setPointerPosition}
            onCommit={commit}
          />
        )}
      </div>
      <footer className="svg-editor-statusbar">
        <span>
          Ferramenta: <strong>{tool}</strong>
        </span>
        <span>
          Posição:{' '}
          <strong>
            {pointerPosition
              ? `${Math.round(pointerPosition.x)}, ${Math.round(pointerPosition.y)}`
              : '—'}
          </strong>
        </span>
        <span>
          <strong>{layers.length}</strong> objeto{layers.length === 1 ? '' : 's'}
        </span>
        <span className="svg-editor-status-save">
          <i className={draftSaved ? 'saved' : ''} />
          {draftSaved ? 'Rascunho salvo' : 'Salvando…'}
        </span>
        <span className="svg-editor-status-hint">Espaço: mover canvas · Ctrl/Cmd+S: exportar</span>
      </footer>
    </section>
  );
};

export default SvgEditor;
