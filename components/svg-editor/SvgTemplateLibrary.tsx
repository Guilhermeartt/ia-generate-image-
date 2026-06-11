import React, { useCallback, useEffect, useState } from 'react';
import {
  createTemplate,
  deleteTemplate,
  listTemplates,
  loadTemplate,
  updateTemplate,
  type TemplateRecord,
  type TemplateSummary,
} from '../../services/templateService';
import { parseViewBox } from './svgDocument';

interface SvgTemplateLibraryProps {
  documentName: string;
  markup: string;
  currentTemplateId: string | null;
  onLoad: (template: TemplateRecord) => void;
  onCurrentTemplateChange: (id: string | null) => void;
}

const SvgTemplateLibrary: React.FC<SvgTemplateLibraryProps> = ({
  documentName,
  markup,
  currentTemplateId,
  onLoad,
  onCurrentTemplateChange,
}) => {
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setTemplates(await listTemplates());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao listar modelos.');
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleSave = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const view = parseViewBox(markup);
      const input = {
        name: documentName.trim() || 'modelo',
        markup,
        viewW: view?.width,
        viewH: view?.height,
      };
      const saved = currentTemplateId
        ? await updateTemplate(currentTemplateId, input)
        : await createTemplate(input);
      onCurrentTemplateChange(saved.id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar modelo.');
    } finally {
      setBusy(false);
    }
  }, [currentTemplateId, documentName, markup, onCurrentTemplateChange, refresh]);

  const handleLoad = useCallback(
    async (templateId: string) => {
      setBusy(true);
      setError(null);
      try {
        onLoad(await loadTemplate(templateId));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Falha ao carregar modelo.');
      } finally {
        setBusy(false);
      }
    },
    [onLoad],
  );

  const handleDelete = useCallback(
    async (templateId: string) => {
      setError(null);
      try {
        await deleteTemplate(templateId);
        if (templateId === currentTemplateId) onCurrentTemplateChange(null);
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Falha ao excluir modelo.');
      }
    },
    [currentTemplateId, onCurrentTemplateChange, refresh],
  );

  return (
    <section className="svg-editor-panel">
      <h3>Biblioteca de modelos</h3>
      <button
        type="button"
        className="svg-editor-text-button wide"
        disabled={busy}
        onClick={() => void handleSave()}
      >
        {currentTemplateId ? 'Atualizar modelo' : 'Salvar como modelo'}
      </button>
      {currentTemplateId && (
        <button
          type="button"
          className="svg-editor-text-button wide"
          disabled={busy}
          onClick={() => onCurrentTemplateChange(null)}
          title="Salvar a próxima alteração como um modelo novo"
        >
          + Novo a partir deste
        </button>
      )}
      {error && <span className="svg-editor-muted">{error}</span>}
      <div className="svg-editor-layers">
        {templates.length === 0 && <span className="svg-editor-muted">Nenhum modelo salvo</span>}
        {templates.map((template) => (
          <button
            type="button"
            key={template.id}
            className={template.id === currentTemplateId ? 'selected' : ''}
            disabled={busy}
            onClick={() => void handleLoad(template.id)}
          >
            <span className="svg-editor-layer-icon">▣</span>
            <span>{template.name}</span>
            <small>{template.view_w && template.view_h ? `${template.view_w}×${template.view_h}` : 'svg'}</small>
            <i
              role="button"
              tabIndex={0}
              aria-label={`Excluir ${template.name}`}
              onClick={(event) => {
                event.stopPropagation();
                void handleDelete(template.id);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void handleDelete(template.id);
              }}
            >
              ×
            </i>
          </button>
        ))}
      </div>
    </section>
  );
};

export default SvgTemplateLibrary;
