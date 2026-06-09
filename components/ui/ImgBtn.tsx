import React from 'react';

interface ImgBtnProps {
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  children: React.ReactNode;
  /** Cor de fundo no hover (quando habilitado). */
  color?: string;
}

/** Botão de ícone sobreposto a uma imagem (overlay com blur). */
const ImgBtn: React.FC<ImgBtnProps> = ({ onClick, disabled, title, children, color }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={title}
    style={{
      padding: 7,
      borderRadius: 8,
      background: 'rgba(0,0,0,0.55)',
      backdropFilter: 'blur(6px)',
      border: '1px solid rgba(255,255,255,0.08)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#fff',
      opacity: disabled ? 0.4 : 1,
      transition: 'background .12s ease',
      flexShrink: 0,
    }}
    onMouseEnter={(e) => {
      if (!disabled && color) e.currentTarget.style.background = color;
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.background = 'rgba(0,0,0,0.55)';
    }}
  >
    {children}
  </button>
);

export default ImgBtn;
