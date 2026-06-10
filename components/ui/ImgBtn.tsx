import React from 'react';

interface ImgBtnProps {
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  'aria-label'?: string;
  children: React.ReactNode;
  /** Cor de fundo no hover (quando habilitado). */
  color?: string;
}

/** Botão de ícone sobreposto a uma imagem (overlay com blur). */
const ImgBtn: React.FC<ImgBtnProps> = ({
  onClick,
  disabled,
  title,
  children,
  color,
  'aria-label': ariaLabel,
}) => {
  const style: React.CSSProperties = color
    ? ({ ['--sc-img-btn-hover' as string]: color } as React.CSSProperties)
    : {};
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel ?? title}
      className="sc-img-btn"
      style={style}
    >
      {children}
    </button>
  );
};

export default ImgBtn;
