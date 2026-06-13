import React, { useMemo, useRef, useState } from 'react';
import SlotAnimationEditor from './SlotAnimationEditor';
import GradientEditor from './GradientEditor';
import { SVG_ASPECT_PRESETS, aspectLabelFor, isGradientFill } from './svgDocument';
import type { SlotAnimation } from './slotAnimation';
import type {
  GradientSpec,
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
  isImporting: boolean;
  onTogglePreview: () => void;
  onDocumentNameChange: (name: string) => void;
  onSelect: (id: string) => void;
  onDeleteLayer: (id: string) => void;
  onToggleLayerVisibility: (id: string, visible: boolean) => void;
  onToggleLayerLocked: (id: string, locked: boolean) => void;
  /** Ids de grupos colapsados (filhos ocultos na lista de camadas). */
  collapsedGroups: ReadonlySet<string>;
  onToggleCollapse: (id: string) => void;
  /** Move a camada `draggedId` para junto de `targetId` (`before` = atrás). */
  onReorderLayer: (draggedId: string, targetId: string, before: boolean) => void;
  onUpload: (files: File[]) => void;
  onChange: (attributes: Record<string, string | number | null>, label: string) => void;
  onTextChange: (text: string) => void;
  onBoundsChange: (bounds: { x: number; y: number; width: number; height: number }) => void;
  onMarkSlot: (type: SlotType) => void;
  onUnmarkSlot: () => void;
  onRenameSlot: (name: string) => void;
  onAnimationChange: (animation: SlotAnimation | undefined) => void;
  /** Degradê do preenchimento do elemento selecionado, ou null se for cor sólida. */
  gradient: GradientSpec | null;
  onGradientChange: (spec: GradientSpec) => void;
}

const SOLID_TO_GRADIENT = (color: string): GradientSpec => ({
  type: 'linear',
  angle: 90,
  stops: [
    { offset: 0, color: /^#[0-9a-f]{6}$/i.test(color) ? color : '#7f77dd', opacity: 1 },
    { offset: 1, color: '#ffffff', opacity: 1 },
  ],
});

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

const normalizeColor = (value: string, fallback: string): string => {
  if (/^#[0-9a-f]{6}$/i.test(value)) return value;
  const short = value.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i);
  if (short)
    return `#${short
      .slice(1)
      .map((part) => part + part)
      .join('')}`;
  const rgb = value.match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
  if (rgb) {
    return `#${rgb
      .slice(1, 4)
      .map((part) => Math.min(255, Number(part)).toString(16).padStart(2, '0'))
      .join('')}`;
  }
  return fallback;
};

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
  isImporting,
  onTogglePreview,
  onDocumentNameChange,
  onSelect,
  onDeleteLayer,
  onToggleLayerVisibility,
  onToggleLayerLocked,
  collapsedGroups,
  onToggleCollapse,
  onReorderLayer,
  onUpload,
  onChange,
  onTextChange,
  onBoundsChange,
  onMarkSlot,
  onUnmarkSlot,
  onRenameSlot,
  onAnimationChange,
  gradient,
  onGradientChange,
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
  const isFillGradient = isGradientFill(properties?.fill);
  const solidFromGradient = gradient?.stops?.[0]?.color ?? '#7f77dd';

  // ── Camadas: colapsar grupos + arrastar para reordenar ──
  const [dragLayerId, setDragLayerId] = useState<string | null>(null);
  const [dropHint, setDropHint] = useState<{ id: string; before: boolean } | null>(null);
  const layersById = useMemo(() => new Map(layers.map((layer) => [layer.id, layer])), [layers]);
  const hasChildren = useMemo(() => {
    const parents = new Set<string>();
    for (const layer of layers) if (layer.parentId) parents.add(layer.parentId);
    return parents;
  }, [layers]);
  const visibleLayers = useMemo(
    () =>
      layers.filter((layer) => {
        let parent = layer.parentId;
        while (parent) {
          if (collapsedGroups.has(parent)) return false;
          parent = layersById.get(parent)?.parentId ?? null;
        }
        return true;
      }),
    [layers, layersById, collapsedGroups],
  );

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
        <div className="svg-editor-transform-grid svg-editor-document-size">
          <label>
            <span>L</span>
            <input
              type="number"
              min="1"
              value={viewBox ? Math.round(viewBox.width) : 1280}
              aria-label="Largura do modelo"
              onChange={(event) =>
                onAspectChange(Number(event.target.value), viewBox?.height ?? 720)
              }
            />
          </label>
          <label>
            <span>A</span>
            <input
              type="number"
              min="1"
              value={viewBox ? Math.round(viewBox.height) : 720}
              aria-label="Altura do modelo"
              onChange={(event) =>
                onAspectChange(viewBox?.width ?? 1280, Number(event.target.value))
              }
            />
          </label>
        </div>
        <p className="svg-editor-dimension-note">
          A borda violeta delimita exatamente a área exportada. A linha interna marca a margem
          segura de 5%.
        </p>
      </Panel>

      {!properties && (
        <section className="svg-editor-selection-empty" aria-live="polite">
          <strong>Nenhum objeto selecionado</strong>
          <span>Selecione uma camada ou clique em um elemento para editar suas propriedades.</span>
        </section>
      )}

      {properties && (
        <>
          <Panel title="Preenchimento">
            <div className="svg-editor-button-row">
              <button
                type="button"
                className={`svg-editor-text-button${!isFillGradient ? ' active' : ''}`}
                onClick={() => {
                  if (isFillGradient) onChange({ fill: solidFromGradient }, 'Preenchimento sólido');
                }}
              >
                Sólido
              </button>
              <button
                type="button"
                className={`svg-editor-text-button${isFillGradient ? ' active' : ''}`}
                onClick={() => {
                  if (!isFillGradient) onGradientChange(SOLID_TO_GRADIENT(properties?.fill || ''));
                }}
              >
                Degradê
              </button>
            </div>

            {isFillGradient && gradient ? (
              <GradientEditor spec={gradient} onChange={onGradientChange} />
            ) : (
              <>
                <div className="svg-editor-color-row">
                  <input
                    type="color"
                    value={normalizeColor(properties?.fill || '', '#7f77dd')}
                    disabled={!properties}
                    aria-label="Preenchimento"
                    onChange={(event) =>
                      onChange({ fill: event.target.value }, 'Alterar preenchimento')
                    }
                  />
                  <input
                    className="svg-editor-small-input"
                    value={properties?.fill || 'none'}
                    disabled={!properties}
                    aria-label="Cor de preenchimento"
                    onChange={(event) =>
                      onChange({ fill: event.target.value }, 'Alterar preenchimento')
                    }
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
              </>
            )}
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
              <>
                <label className="svg-editor-stack-field">
                  <span>Texto</span>
                  <textarea
                    value={properties.text}
                    disabled={properties.structuredText}
                    onChange={(event) => onTextChange(event.target.value)}
                  />
                  {properties.structuredText && (
                    <small className="svg-editor-field-note">
                      Texto estruturado com tspan/textPath: conteúdo protegido para preservar o
                      layout.
                    </small>
                  )}
                </label>
                <label className="svg-editor-inline-field">
                  <span>Tamanho da fonte</span>
                  <input
                    type="number"
                    min="1"
                    step="0.5"
                    value={properties.fontSize}
                    onChange={(event) =>
                      onChange({ 'font-size': Number(event.target.value) }, 'Alterar tipografia')
                    }
                  />
                </label>
                <label className="svg-editor-inline-field">
                  <span>Fonte</span>
                  <input
                    value={properties.fontFamily}
                    onChange={(event) =>
                      onChange({ 'font-family': event.target.value }, 'Alterar tipografia')
                    }
                  />
                </label>
                <label className="svg-editor-inline-field">
                  <span>Peso</span>
                  <input
                    value={properties.fontWeight}
                    onChange={(event) =>
                      onChange({ 'font-weight': event.target.value }, 'Alterar tipografia')
                    }
                  />
                </label>
                <label className="svg-editor-inline-field">
                  <span>Espaçamento</span>
                  <input
                    value={properties.letterSpacing}
                    onChange={(event) =>
                      onChange({ 'letter-spacing': event.target.value }, 'Alterar tipografia')
                    }
                  />
                </label>
                <label className="svg-editor-inline-field">
                  <span>Alinhamento</span>
                  <select
                    value={properties.textAnchor}
                    onChange={(event) =>
                      onChange({ 'text-anchor': event.target.value }, 'Alterar tipografia')
                    }
                  >
                    <option value="start">Início</option>
                    <option value="middle">Centro</option>
                    <option value="end">Fim</option>
                  </select>
                </label>
                <label className="svg-editor-inline-field">
                  <span>Largura do texto</span>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    placeholder="Automática"
                    value={properties.textLength ?? ''}
                    onChange={(event) =>
                      onChange(
                        { textLength: event.target.value ? Number(event.target.value) : null },
                        'Alterar largura do texto',
                      )
                    }
                  />
                </label>
                {properties.textLength !== null && (
                  <label className="svg-editor-inline-field">
                    <span>Ajuste da largura</span>
                    <select
                      value={properties.lengthAdjust}
                      onChange={(event) =>
                        onChange({ lengthAdjust: event.target.value }, 'Alterar largura do texto')
                      }
                    >
                      <option value="spacing">Espaçamento</option>
                      <option value="spacingAndGlyphs">Espaçamento e glifos</option>
                    </select>
                  </label>
                )}
              </>
            )}
          </Panel>
        </>
      )}

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
          {visibleLayers.map((layer) => {
            const collapsible = layer.tagName === 'g' && hasChildren.has(layer.id);
            const dropClass =
              dropHint?.id === layer.id ? ` drop-${dropHint.before ? 'after' : 'before'}` : '';
            return (
            <div
              key={layer.id}
              draggable
              onDragStart={(event) => {
                setDragLayerId(layer.id);
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('text/plain', layer.id);
              }}
              onDragOver={(event) => {
                if (!dragLayerId || dragLayerId === layer.id) return;
                event.preventDefault();
                const rect = event.currentTarget.getBoundingClientRect();
                setDropHint({ id: layer.id, before: event.clientY - rect.top > rect.height / 2 });
              }}
              onDrop={(event) => {
                event.preventDefault();
                const dragged = dragLayerId;
                if (dragged && dragged !== layer.id && dropHint) {
                  onReorderLayer(dragged, layer.id, dropHint.before);
                }
                setDragLayerId(null);
                setDropHint(null);
              }}
              onDragEnd={() => {
                setDragLayerId(null);
                setDropHint(null);
              }}
              className={`svg-editor-layer-row${selectedId === layer.id ? ' selected' : ''}${dropClass}`}
              style={{ paddingLeft: 9 + layer.depth * 14 }}
            >
              {collapsible ? (
                <button
                  type="button"
                  className="svg-editor-layer-collapse"
                  aria-label={collapsedGroups.has(layer.id) ? 'Expandir grupo' : 'Colapsar grupo'}
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggleCollapse(layer.id);
                  }}
                >
                  {collapsedGroups.has(layer.id) ? '▸' : '▾'}
                </button>
              ) : (
                <span className="svg-editor-layer-collapse-spacer" />
              )}
              <button
                type="button"
                className="svg-editor-layer-select"
                onClick={() => onSelect(layer.id)}
                aria-label={`Selecionar ${layer.label}`}
              >
                <span className="svg-editor-layer-icon">
                  {layer.tagName === 'text' ? 'T' : layer.tagName === 'path' ? '⌁' : '◇'}
                </span>
                <span>{layer.label}</span>
                <small>{layer.tagName}</small>
              </button>
              <button
                type="button"
                className="svg-editor-layer-action"
                aria-label={layer.visible ? `Ocultar ${layer.label}` : `Mostrar ${layer.label}`}
                title={layer.visible ? 'Ocultar' : 'Mostrar'}
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleLayerVisibility(layer.id, !layer.visible);
                }}
              >
                {layer.visible ? '◉' : '○'}
              </button>
              <button
                type="button"
                className="svg-editor-layer-action"
                aria-label={layer.locked ? `Desbloquear ${layer.label}` : `Bloquear ${layer.label}`}
                title={layer.locked ? 'Desbloquear' : 'Bloquear'}
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleLayerLocked(layer.id, !layer.locked);
                }}
              >
                {layer.locked ? '▣' : '□'}
              </button>
              <button
                type="button"
                className="svg-editor-layer-action"
                aria-label={`Excluir ${layer.label}`}
                onClick={(event) => {
                  event.stopPropagation();
                  onDeleteLayer(layer.id);
                }}
              >
                ×
              </button>
            </div>
            );
          })}
        </div>
      </Panel>

      <Panel title="Upload SVG">
        <button
          type="button"
          className="svg-editor-upload-zone"
          disabled={isImporting}
          onClick={() => uploadRef.current?.click()}
        >
          <strong>{isImporting ? 'Importando…' : 'Selecionar arquivos'}</strong>
          <span>SVG + imagens e fontes vinculadas</span>
          <small>Também é possível arrastar tudo para o canvas</small>
        </button>
        <input
          ref={uploadRef}
          type="file"
          className="hidden"
          accept=".svg,image/svg+xml,image/png,image/jpeg,image/webp,.ttf,.otf,.woff,.woff2"
          multiple
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            if (files.length > 0) onUpload(files);
            event.currentTarget.value = '';
          }}
        />
      </Panel>
    </aside>
  );
};

export default SvgPropertiesPanel;
