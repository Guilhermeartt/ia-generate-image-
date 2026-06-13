import React, { useMemo } from 'react';
import { renderTemplate, type RenderTemplateOptions, type SlotContent } from './templateRender';

interface TemplateRendererProps {
  /** Markup do modelo (SVG sanitizado com slots marcados). */
  markup: string;
  /** Conteúdo resolvido por slot. */
  contents: SlotContent[];
  options?: RenderTemplateOptions;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Renderiza um modelo de cena composto: o SVG do modelo com os slots já
 * preenchidos (imagem dentro do slot, texto/ícone por cima ou por baixo,
 * conforme a ordem do desenho). Em caso de markup inválido, cai para o markup
 * original.
 */
const TemplateRenderer: React.FC<TemplateRendererProps> = ({
  markup,
  contents,
  options,
  className,
  style,
}) => {
  const composed = useMemo(() => {
    try {
      return renderTemplate(markup, contents, options);
    } catch {
      return markup;
    }
  }, [markup, contents, options]);

  return (
    <div className={className} style={style} dangerouslySetInnerHTML={{ __html: composed }} />
  );
};

export default TemplateRenderer;
