import React, { useRef } from 'react';

interface RangeFieldProps {
  id: string;
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  /** Preview update — dispara em cada change durante drag/teclado. */
  onChange: (value: number) => void;
  /** Commit — dispara no pointerUp (drag) OU no próprio change quando é teclado. */
  onCommit?: (value: number) => void;
  format?: (value: number) => string;
  ariaDescribedBy?: string;
}

export const RangeField: React.FC<RangeFieldProps> = ({
  id,
  label,
  min,
  max,
  step,
  value,
  onChange,
  onCommit,
  format,
  ariaDescribedBy,
}) => {
  const draggingRef = useRef(false);
  const formatted = format ? format(value) : value.toString();

  return (
    <div className="vs-range-field">
      <div className="vs-range-field-head">
        <label htmlFor={id} className="panel-field-label">{label}</label>
        <output htmlFor={id} className="vs-range-field-output">{formatted}</output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => {
          const next = Number(event.target.value);
          onChange(next);
          if (!draggingRef.current && onCommit) onCommit(next);
        }}
        onPointerDown={() => {
          draggingRef.current = true;
        }}
        onPointerUp={(event) => {
          draggingRef.current = false;
          if (onCommit) onCommit(Number((event.target as HTMLInputElement).value));
        }}
        onPointerCancel={() => {
          draggingRef.current = false;
        }}
        onBlur={() => {
          if (!draggingRef.current && onCommit) onCommit(value);
        }}
        aria-valuetext={formatted}
        aria-describedby={ariaDescribedBy}
      />
    </div>
  );
};

interface ColorOpacityFieldProps {
  id: string;
  label: string;
  color: string;
  opacity?: number;
  onColorChange: (color: string) => void;
  onColorCommit?: (color: string) => void;
  onOpacityChange?: (opacity: number) => void;
  onOpacityCommit?: (opacity: number) => void;
  swatches?: string[];
}

export const ColorOpacityField: React.FC<ColorOpacityFieldProps> = ({
  id,
  label,
  color,
  opacity,
  onColorChange,
  onColorCommit,
  onOpacityChange,
  onOpacityCommit,
  swatches,
}) => {
  const opacityDragging = useRef(false);
  return (
    <div className="vs-color-field">
      <label htmlFor={id} className="panel-field-label">{label}</label>
      <div className="vs-color-field-row">
        <input
          id={id}
          type="color"
          value={color}
          onChange={(event) => onColorChange(event.target.value)}
          onBlur={(event) => onColorCommit?.(event.target.value)}
          aria-label={`${label} — cor`}
        />
        {onOpacityChange && (
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={opacity ?? 1}
            onChange={(event) => {
              const next = Number(event.target.value);
              onOpacityChange(next);
              if (!opacityDragging.current && onOpacityCommit) onOpacityCommit(next);
            }}
            onPointerDown={() => { opacityDragging.current = true; }}
            onPointerUp={(event) => {
              opacityDragging.current = false;
              onOpacityCommit?.(Number((event.target as HTMLInputElement).value));
            }}
            onPointerCancel={() => { opacityDragging.current = false; }}
            aria-label={`${label} — opacidade`}
            aria-valuetext={`${Math.round((opacity ?? 1) * 100)}%`}
          />
        )}
        {onOpacityChange && (
          <span className="vs-color-field-opacity">{Math.round((opacity ?? 1) * 100)}%</span>
        )}
      </div>
      {swatches && swatches.length > 0 && (
        <div className="vs-color-swatches" role="listbox" aria-label={`${label} — paleta recente`}>
          {swatches.map((swatch) => (
            <button
              key={swatch}
              type="button"
              className={`vs-color-swatch${swatch === color ? ' is-selected' : ''}`}
              style={{ background: swatch }}
              onClick={() => {
                onColorChange(swatch);
                onColorCommit?.(swatch);
              }}
              aria-label={`Aplicar cor ${swatch}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

interface TabsProps<T extends string> {
  value: T;
  onChange: (id: T) => void;
  tabs: ReadonlyArray<{ id: T; label: string; badge?: boolean }>;
  idPrefix?: string;
}

export const Tabs = <T extends string>({ value, onChange, tabs, idPrefix = 'vs-tab' }: TabsProps<T>) => (
  <div className="vs-tabs" role="tablist" aria-label="Seções de edição">
    {tabs.map((tab) => (
      <button
        key={tab.id}
        type="button"
        role="tab"
        id={`${idPrefix}-${tab.id}`}
        aria-controls={`${idPrefix}-panel-${tab.id}`}
        aria-selected={tab.id === value}
        tabIndex={tab.id === value ? 0 : -1}
        className={`vs-tab${tab.id === value ? ' is-active' : ''}${tab.badge ? ' has-badge' : ''}`}
        onClick={() => onChange(tab.id)}
      >
        {tab.label}
        {tab.badge && <span className="vs-tab-badge" aria-label="modificado" />}
      </button>
    ))}
  </div>
);
