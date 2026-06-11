import React, { useCallback, useEffect, useRef, useState } from 'react';
import { renderTemplate, type SlotContent, type SlotStyle } from './templateRender';
import { previewDurationSeconds, slotStyleAtTime } from './slotAnimation';
import type { TemplateSlot } from './types';

interface AnimatedTemplatePreviewProps {
  markup: string;
  slots: TemplateSlot[];
  contents: SlotContent[];
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Pré-visualização do modelo com animação de entrada/saída por slot. Roda um
 * relógio em loop (requestAnimationFrame) e recompõe o SVG a cada quadro,
 * aplicando `slotStyleAtTime` em cada slot animado. Slots sem animação ficam
 * estáticos (sempre visíveis).
 */
const AnimatedTemplatePreview: React.FC<AnimatedTemplatePreviewProps> = ({
  markup,
  slots,
  contents,
  className,
  style,
}) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(true);

  const animatedSlots = slots.filter((slot) => slot.animation);
  const total = previewDurationSeconds(animatedSlots.map((slot) => slot.animation!));

  const renderAt = useCallback(
    (t: number) => {
      const styleById: Record<string, SlotStyle> = {};
      for (const slot of slots) {
        if (slot.animation) styleById[slot.id] = slotStyleAtTime(slot.animation, t);
      }
      const composed = renderTemplate(markup, contents, { styleById });
      if (hostRef.current) hostRef.current.innerHTML = composed;
    },
    [markup, contents, slots],
  );

  useEffect(() => {
    if (animatedSlots.length === 0 || !playing) {
      renderAt(total);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const loop = (now: number) => {
      renderAt(((now - start) / 1000) % total);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, total, renderAt, animatedSlots.length]);

  return (
    <div className={className} style={{ ...style, position: 'relative' }}>
      <div ref={hostRef} style={{ width: '100%', height: '100%', display: 'flex' }} />
      {animatedSlots.length > 0 && (
        <button
          type="button"
          className="svg-editor-mini-button"
          onClick={() => setPlaying((value) => !value)}
          style={{ position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)' }}
        >
          {playing ? 'Pausar' : 'Reproduzir'}
        </button>
      )}
    </div>
  );
};

export default AnimatedTemplatePreview;
