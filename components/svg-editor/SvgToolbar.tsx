import React, { useRef } from 'react';
import type { SvgTool } from './types';

interface SvgToolbarProps {
  tool: SvgTool;
  canUndo: boolean;
  canRedo: boolean;
  hasSelection: boolean;
  isImporting: boolean;
  onToolChange: (tool: SvgTool) => void;
  onUpload: (files: File[]) => void;
  onUndo: () => void;
  onRedo: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onFront: () => void;
  onBack: () => void;
  onExport: () => void;
  onNew: () => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  snapToGrid: boolean;
  onToggleSnap: () => void;
  showSafeArea: boolean;
  onToggleSafeArea: () => void;
}

const GROUPS: Array<Array<{ id: SvgTool; label: string; icon: string }>> = [
  [{ id: 'select', label: 'Selecionar (V)', icon: '↖' }],
  [
    { id: 'pen', label: 'Caneta (B)', icon: '✒' },
    { id: 'nodes', label: 'Editar pontos (N)', icon: '◇' },
  ],
  [
    { id: 'rect', label: 'Retângulo (R)', icon: '□' },
    { id: 'ellipse', label: 'Elipse (E)', icon: '○' },
    { id: 'line', label: 'Linha (L)', icon: '╱' },
    { id: 'freehand', label: 'Desenho livre (P)', icon: '〰' },
    { id: 'text', label: 'Texto (T)', icon: 'T' },
  ],
  [
    { id: 'star', label: 'Estrela (S)', icon: '☆' },
    { id: 'triangle', label: 'Triângulo', icon: '△' },
  ],
];

const ActionButton = ({
  title,
  icon,
  disabled,
  onClick,
}: {
  title: string;
  icon: string;
  disabled?: boolean;
  onClick: () => void;
}) => (
  <button
    className="svg-editor-icon-button"
    type="button"
    title={title}
    aria-label={title}
    disabled={disabled}
    onClick={onClick}
  >
    {icon}
  </button>
);

const SvgToolbar: React.FC<SvgToolbarProps> = ({
  tool,
  canUndo,
  canRedo,
  hasSelection,
  isImporting,
  onToolChange,
  onUpload,
  onUndo,
  onRedo,
  onDuplicate,
  onDelete,
  onFront,
  onBack,
  onExport,
  onNew,
  zoom,
  onZoomIn,
  onZoomOut,
  onFit,
  snapToGrid,
  onToggleSnap,
  showSafeArea,
  onToggleSafeArea,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="svg-editor-toolbar">
      {GROUPS.map((group, groupIndex) => (
        <React.Fragment key={groupIndex}>
          {groupIndex > 0 && <span className="svg-editor-toolbar-separator" />}
          {group.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`svg-editor-icon-button${tool === item.id ? ' active' : ''}`}
              onClick={() => onToolChange(item.id)}
              title={item.label}
              aria-label={item.label}
              aria-pressed={tool === item.id}
            >
              {item.icon}
            </button>
          ))}
        </React.Fragment>
      ))}

      <span className="svg-editor-toolbar-separator" />
      <ActionButton title="Desfazer" icon="↶" disabled={!canUndo} onClick={onUndo} />
      <ActionButton title="Refazer" icon="↷" disabled={!canRedo} onClick={onRedo} />
      <ActionButton title="Duplicar" icon="⧉" disabled={!hasSelection} onClick={onDuplicate} />
      <ActionButton title="Excluir" icon="⌫" disabled={!hasSelection} onClick={onDelete} />

      <span className="svg-editor-toolbar-separator" />
      <ActionButton
        title="Trazer para frente"
        icon="⇧"
        disabled={!hasSelection}
        onClick={onFront}
      />
      <ActionButton
        title="Enviar para o fundo"
        icon="⇩"
        disabled={!hasSelection}
        onClick={onBack}
      />

      <span className="svg-editor-toolbar-separator" />
      <ActionButton title="Diminuir zoom" icon="−" onClick={onZoomOut} />
      <button
        className="svg-editor-zoom-button"
        type="button"
        title="Ajustar modelo à tela"
        onClick={onFit}
      >
        {Math.round(zoom * 100)}%
      </button>
      <ActionButton title="Aumentar zoom" icon="+" onClick={onZoomIn} />
      <button
        className={`svg-editor-snap-button${snapToGrid ? ' active' : ''}`}
        type="button"
        aria-pressed={snapToGrid}
        title="Alinhar movimentos à grade de 10 unidades"
        onClick={onToggleSnap}
      >
        Grade 10
      </button>
      <button
        className={`svg-editor-snap-button${showSafeArea ? ' active' : ''}`}
        type="button"
        aria-pressed={showSafeArea}
        title="Mostrar ou ocultar a margem segura de 5%"
        onClick={onToggleSafeArea}
      >
        Área segura
      </button>

      <div className="svg-editor-toolbar-spacer" />
      <button className="btn btn-ghost" type="button" onClick={onNew}>
        Novo
      </button>
      <button
        className="btn btn-ghost"
        type="button"
        disabled={isImporting}
        onClick={() => inputRef.current?.click()}
      >
        {isImporting ? 'Importando…' : 'Importar'}
      </button>
      <input
        ref={inputRef}
        className="hidden"
        type="file"
        accept=".svg,image/svg+xml,image/png,image/jpeg,image/webp,.ttf,.otf,.woff,.woff2"
        multiple
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          if (files.length > 0) onUpload(files);
          event.currentTarget.value = '';
        }}
      />
      <button className="btn btn-primary" type="button" disabled={isImporting} onClick={onExport}>
        Exportar
      </button>
    </div>
  );
};

export default SvgToolbar;
