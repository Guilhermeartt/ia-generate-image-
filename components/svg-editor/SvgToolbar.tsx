import React, { useRef } from 'react';
import type { SvgTool } from './types';

interface SvgToolbarProps {
  tool: SvgTool;
  canUndo: boolean;
  canRedo: boolean;
  hasSelection: boolean;
  onToolChange: (tool: SvgTool) => void;
  onUpload: (file: File) => void;
  onUndo: () => void;
  onRedo: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onFront: () => void;
  onBack: () => void;
  onExport: () => void;
  onNew: () => void;
}

const GROUPS: Array<Array<{ id: SvgTool; label: string; icon: string }>> = [
  [{ id: 'select', label: 'Selecionar (V)', icon: '↖' }],
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

      <div className="svg-editor-toolbar-spacer" />
      <button className="btn btn-ghost" type="button" onClick={onNew}>
        Novo
      </button>
      <button className="btn btn-ghost" type="button" onClick={() => inputRef.current?.click()}>
        Importar
      </button>
      <input
        ref={inputRef}
        className="hidden"
        type="file"
        accept=".svg,image/svg+xml"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onUpload(file);
          event.currentTarget.value = '';
        }}
      />
      <button className="btn btn-primary" type="button" onClick={onExport}>
        Exportar
      </button>
    </div>
  );
};

export default SvgToolbar;
