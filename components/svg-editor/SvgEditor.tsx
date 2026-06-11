import React, { useCallback, useEffect, useMemo, useState } from 'react';
import SvgCanvas from './SvgCanvas';
import SvgPropertiesPanel from './SvgPropertiesPanel';
import SvgTemplateLibrary from './SvgTemplateLibrary';
import SvgToolbar from './SvgToolbar';
import AnimatedTemplatePreview from './AnimatedTemplatePreview';
import { buildPreviewContents } from './templateBinding';
import type { SlotAnimation } from './slotAnimation';
import type { SlotType, SvgEditorDocument, SvgTool } from './types';
import {
  createBlankSvg,
  duplicateSvgElement,
  getSlotMeta,
  getSvgElementProperties,
  listSlots,
  listSvgLayers,
  markSlot,
  removeSvgElement,
  reorderSvgElement,
  resizeSvgElement,
  sanitizeSvg,
  unmarkSlot,
  updateSvgElement,
  updateSvgText,
} from './svgDocument';

interface HistoryState {
  past: string[];
  future: string[];
}

const initialDocument = (): SvgEditorDocument => ({
  name: 'ilustracao',
  markup: createBlankSvg(),
});

const SvgEditor: React.FC = () => {
  const [documentState, setDocumentState] = useState<SvgEditorDocument>(initialDocument);
  const [history, setHistory] = useState<HistoryState>({ past: [], future: [] });
  const [tool, setTool] = useState<SvgTool>('select');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pointerPosition, setPointerPosition] = useState<{ x: number; y: number } | null>(null);
  const [currentTemplateId, setCurrentTemplateId] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const properties = useMemo(
    () => (selectedId ? getSvgElementProperties(documentState.markup, selectedId) : null),
    [documentState.markup, selectedId],
  );
  const layers = useMemo(() => listSvgLayers(documentState.markup), [documentState.markup]);
  const slots = useMemo(() => listSlots(documentState.markup), [documentState.markup]);
  const previewContents = useMemo(() => buildPreviewContents(slots), [slots]);
  const selectedSlot = useMemo(
    () => (selectedId ? getSlotMeta(documentState.markup, selectedId) : null),
    [documentState.markup, selectedId],
  );

  const commit = useCallback(
    (before: string, after: string, _label: string, nextSelectedId?: string) => {
      if (before === after) return;
      setHistory((current) => ({
        past: [...current.past, before].slice(-50),
        future: [],
      }));
      setDocumentState((current) => ({ ...current, markup: after }));
      if (nextSelectedId !== undefined) setSelectedId(nextSelectedId);
    },
    [],
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
  }, [documentState.markup]);

  const redo = useCallback(() => {
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
  }, [documentState.markup]);

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

  const importFile = useCallback(
    async (file: File) => {
      try {
        const markup = sanitizeSvg(await file.text());
        commit(documentState.markup, markup, 'Importar SVG');
        setDocumentState({ name: file.name.replace(/\.svg$/i, '') || 'ilustracao', markup });
        setSelectedId(null);
        setMessage(`"${file.name}" importado com segurança.`);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Não foi possível importar o SVG.');
      }
    },
    [commit, documentState.markup],
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
  }, [commit, documentState.markup]);

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
      if (event.key === 'Delete' || event.key === 'Backspace') removeSelected();
      if (event.key.toLowerCase() === 'v') setTool('select');
      if (event.key.toLowerCase() === 'r') setTool('rect');
      if (event.key.toLowerCase() === 'e') setTool('ellipse');
      if (event.key.toLowerCase() === 'l') setTool('line');
      if (event.key.toLowerCase() === 'p') setTool('freehand');
      if (event.key.toLowerCase() === 't') setTool('text');
      if (event.key.toLowerCase() === 's') setTool('star');
      if (event.key === 'Escape') setTool('select');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [redo, removeSelected, undo]);

  return (
    <section
      className="svg-editor-shell anim-fade"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        const file = event.dataTransfer.files[0];
        if (file?.name.toLowerCase().endsWith('.svg')) void importFile(file);
      }}
    >
      <SvgToolbar
        tool={tool}
        canUndo={history.past.length > 0}
        canRedo={history.future.length > 0}
        hasSelection={!!selectedId}
        onToolChange={setTool}
        onUpload={(file) => void importFile(file)}
        onUndo={undo}
        onRedo={redo}
        onDuplicate={duplicateSelected}
        onDelete={removeSelected}
        onFront={() => reorderSelected('front')}
        onBack={() => reorderSelected('back')}
        onExport={exportSvg}
        onNew={resetDocument}
      />
      {message && (
        <button className="svg-editor-message" type="button" onClick={() => setMessage(null)}>
          {message}
        </button>
      )}
      <div className="svg-editor-body">
        <SvgPropertiesPanel
          properties={properties}
          layers={layers}
          selectedId={selectedId}
          documentName={documentState.name}
          slot={selectedSlot}
          slots={slots}
          previewMode={previewMode}
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
                setMessage(`Modelo "${template.name}" carregado.`);
              }}
            />
          }
          onDocumentNameChange={(name) => setDocumentState((current) => ({ ...current, name }))}
          onSelect={(id) => {
            setTool('select');
            setSelectedId(id);
          }}
          onDeleteLayer={(id) => {
            applyChange(removeSvgElement(documentState.markup, id), 'Excluir elemento');
            if (selectedId === id) setSelectedId(null);
          }}
          onUpload={(file) => void importFile(file)}
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
            onSelect={setSelectedId}
            onPointerPosition={setPointerPosition}
            onPreview={(markup, id) => {
              setDocumentState((current) => ({ ...current, markup }));
              if (id) setSelectedId(id);
            }}
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
      </footer>
    </section>
  );
};

export default SvgEditor;
