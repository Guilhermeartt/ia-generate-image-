import React from 'react';

/** Spinner circular animado (animação `spin` definida em styles/main.css). */
const Spinner: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <div
    style={{
      width: size,
      height: size,
      flexShrink: 0,
      border: '2px solid var(--surface-3)',
      borderTopColor: 'var(--indigo)',
      borderRadius: '50%',
      animation: 'spin .8s linear infinite',
    }}
  />
);

export default Spinner;
