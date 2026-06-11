import React, { useRef } from 'react';
import SlotAnimationEditor from './SlotAnimationEditor';
import { SVG_ASPECT_PRESETS, aspectLabelFor } from './svgDocument';
import type { SlotAnimation } from './slotAnimation';
import type {
  SlotType,
  SvgElementProperties,
  SvgLayer,
  TemplateSlot,
  TemplateSlotMeta,
} from './types';

interface SvgPropertiesPanelProps {
  properties: SvgElementProperties | null;
  layers: SvgLayer[];
  selectedId: string | null;
  documentName: string;
  /** Dimensões do quadro (viewBox) do modelo. */
  viewBox: { width: number; height: number } | null;
  onAspectChange: (width: number, height: number) => void;
  /** Conteúdo extra renderizado no topo do painel (ex.: biblioteca de modelos). */
  libraryNode?: React.ReactNode;
  /** Slot do elemento selecionado, ou null se ele não for um slot. */
  slot: TemplateSlotMeta | null;
  /** Todos os slots do modelo atual. */
  slots: TemplateSlot[];
  /** Se o canvas está mostrando a pré-visualização preenchida do modelo. */
  previewMode: boolean;
  onTogglePreview: () => void;
  onDocumentNameChange: (name: string) => void;
  onSelect: (id: string) => void;
  onDeleteLayer: (id: string) => void;
  onUpload: (file: File) => void;
  onChange: (attributes: Record<string, string | number | null>, label: string) => void;
  onTextChange: (text: string) => void;
  onBoundsChange: (bounds: { x: number; y: number; width: number; height: number }) => void;
  onMarkSlot: (type: SlotType) => void;
  onUnmarkSlot: () => void;
  onRenameSlot: (name: string) => void;
  onAnimationChange: (animation: SlotAnimation | undefined) => void;
}

const SLOT_LABELS: Record<SlotType, string> = {
  image: 'Imagem',
  text: 'Texto',
  icon: 'Ícone',
};

const SWATCHES = [
  '#7f77dd',
  '#534ab7',
  '#1d9e75',
  '#d85a30',
  '#d4537e',
  '#378add',
  '#639922',
  '#ef9f27',
  '#e24b4a',
  '#888780',
  '#ffffff',
  '#000000',
  '#eeedfe',
  '#e1f5ee',
  '#faece7',
  '#e6f1fb',
];

const normalizeColor = (value: string, fallback: string): string =>
  /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;

const Panel = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="svg-editor-panel">
    <h3>{title}</h3>
    {children}
  </section>
);

const SvgPropertiesPanel: React.FC<SvgPropertiesPanelProps> = ({
  properties,
  layers,
  selectedId,
  documentName,
  viewBox,
  onAspectChange,
  libraryNode,
  slot,
  slots,
  previewMode,
  onTogglePreview,
  onDocumentNameChange,
  onSelect,
  onDeleteLayer,
  onUpload,
  onChange,
  onTextChange,
  onBoundsChange,
  onMarkSlot,
  onUnmarkSlot,
  onRenameSlot,
  onAnimationChange,
}) => {
  const uploadRef = useRef<HTMLInputElement>(null);
  const bounds = {
    x: properties?.x ?? 0,
    y: properties?.y ?? 0,
    width: properties?.width ?? 0,
    height: properties?.height ?? 0,
  };
  const supportsBounds =
    !!properties && ['rect', 'ellipse', 'circle', 'line', 'text'].includes(properties.tagName);
  const setBound = (key: keyof typeof bounds, value: number) =>
    onBoundsChange({ ...bounds, [key]: value });

  return (
    <aside className="svg-editor-properties">
      {libraryNode}

      <Panel title="Documento">
        <input
          className="svg-editor-small-input wide"
          value={documentName}
          onChange={(event) => onDocumentNameChange(event.target.value)}
          aria-label="Nome do documento"
        />
        <label className="svg-editor-inline-field">
          <span>Proporção</span>
          <select
            value={viewBox ? aspectLabelFor(viewBox.width, viewBox.height) : '16:9'}
            onChange={(event) => {
              const preset = SVG_ASPECT_PRESETS.find((item) => item.label === event.target.value);
              if (preset) onAspectChange(preset.width, preset.height);
            }}
            aria-label="Proporção do quadro"
          >
            {SVG_ASPECT_PRESETS.map((preset) => (
              <option key={preset.label} value={preset.label}>
                {preset.label}
              </option>
            ))}
            {viewBox && aspectLabelFor(viewBox.width, viewBox.height) === 'Personalizado' && (
              <option value="Personalizado">
                Personalizado ({Math.round(viewBox.width)}×{Math.round(viewBox.height)})
              </option>
            )}
          </select>
        </label>
      </Panel>

      <Panel title="Preenchimento">
        <div className="svg-editor-color-row">
          <input
            type="color"
            value={normalizeColor(properties?.fill || '', '#7f77dd')}
            disabled={!properties}
            aria-label="Preenchimento"
            onChange={(event) => onChange({ fill: event.target.value }, 'Alterar preenchimento')}
          />
          <input
            className="svg-editor-small-input"
            value={properties?.fill || 'none'}
            disabled={!properties}
            aria-label="Cor de preenchimento"
            onChange={(event) => onChange({ fill: event.target.value }, 'Alterar preenchimento')}
          />
          <button
            type="button"
            className="svg-editor-mini-button"
            disabled={!properties}
            onClick={() => onChange({ fill: 'none' }, 'Remover preenchimento')}
            title="Sem preenchimento"
          >
            ∅
          </button>
        </div>
        <div className="svg-editor-swatches">
          {SWATCHES.map((color) => (
            <button
              key={color}
              type="button"
              disabled={!properties}
              style={{ background: color }}
              title={color}
              onClick={() => onChange({ fill: color }, 'Alterar preenchimento')}
            />
          ))}
        </div>
      </Panel>

      <Panel title="Contorno">
        <div className="svg-editor-color-row">
          <input
            type="color"
            value={normalizeColor(properties?.stroke || '', '#534ab7')}
            disabled={!properties}
            aria-label="Contorno"
            onChange={(event) => onChange({ stroke: event.target.value }, 'Alterar contorno')}
          />
          <input
            className="svg-editor-small-input"
            value={properties?.stroke || 'none'}
            disabled={!properties}
            aria-label="Cor do contorno"
            onChange={(event) => onChange({ stroke: event.target.value }, 'Alterar contorno')}
          />
        </div>
        <label className="svg-editor-inline-field">
          <span>Espessura</span>
          <input
            type="number"
            min="0"
            max="100"
            step="0.5"
            value={properties?.strokeWidth ?? 0}
            disabled={!properties}
            onChange={(event) =>
              onChange({ 'stroke-width': Number(event.target.value) }, 'Alterar contorno')
            }
          />
        </label>
        <label className="svg-editor-inline-field">
          <span>Tracejado</span>
          <select
            value={properties?.strokeDasharray ?? ''}
            disabled={!properties}
            onChange={(event) =>
              onChange({ 'stroke-dasharray': event.target.value || null }, 'Alterar tracejado')
            }
          >
            <option value="">Sólido</option>
            <option value="4 4">Pontilhado</option>
            <option value="8 4">Traçado</option>
            <option value="12 4 4 4">Traço-ponto</option>
          </select>
        </label>
      </Panel>

      <Panel title="Transformar">
        <div className="svg-editor-transform-grid">
          {(['x', 'y', 'width', 'height'] as const).map((key) => (
            <label key={key}>
              <span>{{ x: 'X', y: 'Y', width: 'L', height: 'A' }[key]}</span>
              <input
                type="number"
                value={bounds[key]}
                disabled={!supportsBounds || properties?.[key] === null}
                onChange={(event) => setBound(key, Number(event.target.value))}
              />
            </label>
          ))}
        </div>
        <label className="svg-editor-inline-field">
          <span>Opacidade</span>
          <input
            type="number"
            min="0"
            max="100"
            value={Math.round((properties?.opacity ?? 1) * 100)}
            disabled={!properties}
            onChange={(event) =>
              onChange({ opacity: Number(event.target.value) / 100 }, 'Alterar opacidade')
            }
          />
        </label>
        {properties?.tagName === 'text' && (
          <label className="svg-editor-stack-field">
            <span>Texto</span>
            <textarea
              value={properties.text}
              onChange={(event) => onTextChange(event.target.value)}
            />
          </label>
        )}
      </Panel>

      {properties && (
        <Panel title="Slot do modelo">
          <p className="svg-editor-muted">
            Marque este espaço como imagem, texto ou ícone — o modelo preenche na cena.
          </p>
          <div className="svg-editor-button-row">
            {(['image', 'text', 'icon'] as const).map((type) => (
              <button
                key={type}
                type="button"
                className={`svg-editor-text-button${slot?.type === type ? ' active' : ''}`}
                aria-pressed={slot?.type === type}
                onClick={() => onMarkSlot(type)}
              >
                {SLOT_LABELS[type]}
              </button>
            ))}
          </div>
          {slot && (
            <>
              <label className="svg-editor-stack-field">
                <span>Nome do slot</span>
                <input
                  className="svg-editor-small-input wide"
                  value={slot.name}
                  onChange={(event) => onRenameSlot(event.target.value)}
                  aria-label="Nome do slot"
                />
              </label>
              <button type="button" className="svg-editor-text-button wide" onClick={onUnmarkSlot}>
                Remover marcação de slot
              </button>
              <SlotAnimationEditor animation={slot.animation} onChange={onAnimationChange} />
            </>
          )}
        </Panel>
      )}

      <Panel title={`Slots (${slots.length})`}>
        <div className="svg-editor-layers">
          {slots.length === 0 && <span className="svg-editor-muted">Nenhum slot marcado</span>}
          {slots.map((entry) => (
            <button
              type="button"
              key={entry.id}
              className={selectedId === entry.id ? 'selected' : ''}
              onClick={() => onSelect(entry.id)}
            >
              <span className="svg-editor-layer-icon">▣</span>
              <span>{entry.name}</span>
              <small>{SLOT_LABELS[entry.type]}</small>
            </button>
          ))}
        </div>
        <button
          type="button"
          className={`svg-editor-text-button wide${previewMode ? ' active' : ''}`}
          disabled={slots.length === 0}
          aria-pressed={previewMode}
          onClick={onTogglePreview}
        >
          {previewMode ? 'Voltar a editar' : 'Pré-visualizar preenchido'}
        </button>
      </Panel>

      <Panel title={`Camadas (${layers.length})`}>
        <div className="svg-editor-layers">
          {layers.length === 0 && <span className="svg-editor-muted">Nenhum objeto</span>}
          {layers.map((layer) => (
            <button
              type="button"
              key={layer.id}
              className={selectedId === layer.id ? 'selected' : ''}
              onClick={() => onSelect(layer.id)}
            >
              <span className="svg-editor-layer-icon">
                {layer.tagName === 'text' ? 'T' : layer.tagName === 'path' ? '⌁' : '◇'}
              </span>
              <span>{layer.label}</span>
              <small>{layer.tagName}</small>
              <i
                role="button"
                tabIndex={0}
                aria-label={`Excluir ${layer.label}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onDeleteLayer(layer.id);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') onDeleteLayer(layer.id);
                }}
              >
                ×
              </i>
            </button>
          ))}
        </div>
      </Panel>

      <Panel title="Upload SVG">
        <button
          type="button"
          className="svg-editor-upload-zone"
          onClick={() => uploadRef.current?.click()}
        >
          ↑<span>Clique ou arraste um .svg</span>
        </button>
        <input
          ref={uploadRef}
          type="file"
          className="hidden"
          accept=".svg,image/svg+xml"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onUpload(file);
            event.currentTarget.value = '';
          }}
        />
      </Panel>
    </aside>
  );
};

export default SvgPropertiesPanel;
