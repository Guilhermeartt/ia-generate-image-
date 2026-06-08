import React, { useEffect, useState } from 'react';

interface LoaderProps {
  message: string;
}

const STEPS = [
  {
    id: 'parsing',
    label: 'Lendo arquivo',
    desc: 'Interpretando estrutura',
    icon: (
      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
      </svg>
    ),
    accent: '#4F8CFF',
    accentBg: 'rgba(79,140,255,0.12)',
    accentBorder: 'rgba(79,140,255,0.30)',
  },
  {
    id: 'context',
    label: 'Contexto geral',
    desc: 'Compreendendo a história',
    icon: (
      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 16v-4M12 8h.01"/>
      </svg>
    ),
    accent: '#22D3EE',
    accentBg: 'rgba(34,211,238,0.12)',
    accentBorder: 'rgba(34,211,238,0.30)',
  },
  {
    id: 'characters',
    label: 'Personagens',
    desc: 'Identificando perfis visuais',
    icon: (
      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="7" r="4"/>
        <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
        <circle cx="19" cy="11" r="2"/>
        <path d="M23 21v-1a2 2 0 0 0-2-2h-1"/>
      </svg>
    ),
    accent: '#8B5CF6',
    accentBg: 'rgba(139,92,246,0.12)',
    accentBorder: 'rgba(139,92,246,0.30)',
  },
  {
    id: 'scenes',
    label: 'Cenas',
    desc: 'Gerando prompts visuais',
    icon: (
      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="23 7 16 12 23 17 23 7"/>
        <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
      </svg>
    ),
    accent: '#10B981',
    accentBg: 'rgba(16,185,129,0.12)',
    accentBorder: 'rgba(16,185,129,0.30)',
  },
  {
    id: 'refining',
    label: 'Refinamento',
    desc: 'Avaliando divisões e alternativas',
    icon: (
      <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9"/>
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
      </svg>
    ),
    accent: '#F59E0B',
    accentBg: 'rgba(245,158,11,0.12)',
    accentBorder: 'rgba(245,158,11,0.30)',
  },
];

const CheckIcon: React.FC = () => (
  <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const Loader: React.FC<LoaderProps> = ({ message }) => {
  const [dots, setDots] = useState('');

  // Animated dots for the message
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(d => d.length >= 3 ? '' : d + '.');
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const activeIndex = message.toLowerCase().includes('refinan') ? 4
    : message.toLowerCase().includes('context') ? 1
      : message.toLowerCase().includes('person') ? 2
        : message.toLowerCase().includes('cena') ? 3
          : 0;

  const progressPct = ((activeIndex + 1) / STEPS.length) * 100;
  const activeStep = STEPS[activeIndex];

  return (
    <div className="processing-panel anim-up">
      {/* Animated ring + icon */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {/* Outer glow */}
        <div style={{
          position: 'absolute',
          width: 72, height: 72,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${activeStep.accentBg} 0%, transparent 70%)`,
          animation: 'pulse-dot 2s ease-in-out infinite',
        }} />
        {/* Spinner ring */}
        <div style={{
          width: 52, height: 52,
          borderRadius: '50%',
          border: `2px solid ${activeStep.accentBorder}`,
          borderTopColor: activeStep.accent,
          animation: 'spin .9s linear infinite',
          position: 'relative',
        }} />
        {/* Center icon */}
        <div style={{
          position: 'absolute',
          color: activeStep.accent,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {activeStep.icon}
        </div>
      </div>

      {/* Title + message */}
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.01em' }}>
          Analisando roteiro com IA
        </p>
        <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 5, lineHeight: 1.6, minHeight: 20 }}>
          {message}{dots}
        </p>
      </div>

      {/* Progress bar */}
      <div style={{ width: '100%' }}>
        <div className="progress-bar">
          <div
            className="progress-bar-fill"
            style={{
              width: `${progressPct}%`,
              background: `linear-gradient(90deg, ${activeStep.accent}, ${activeStep.accent}cc)`,
              transition: 'width .5s ease',
            }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
          <span style={{ fontSize: 10, color: 'var(--text-4)', fontFamily: 'var(--mono)' }}>
            {activeIndex + 1} / {STEPS.length}
          </span>
          <span style={{ fontSize: 10, color: activeStep.accent, fontFamily: 'var(--mono)', fontWeight: 700 }}>
            {Math.round(progressPct)}%
          </span>
        </div>
      </div>

      {/* Steps grid */}
      <div className="processing-steps">
        {STEPS.map((step, index) => {
          const isDone   = index < activeIndex;
          const isActive = index === activeIndex;
          const isPending = index > activeIndex;

          return (
            <div
              key={step.id}
              className={`processing-step${isActive ? ' active' : ''}`}
              style={isActive ? {
                borderColor: step.accentBorder,
                background: step.accentBg,
                boxShadow: `0 0 0 1px ${step.accentBorder}`,
              } : isDone ? {
                borderColor: 'rgba(16,185,129,0.25)',
                background: 'rgba(16,185,129,0.06)',
              } : {}}
            >
              {/* Step indicator */}
              <span style={{
                display: 'inline-flex',
                width: 22, height: 22,
                alignItems: 'center', justifyContent: 'center',
                borderRadius: 6,
                background: isDone ? 'rgba(16,185,129,0.15)' : isActive ? step.accentBg : 'rgba(255,255,255,0.04)',
                border: `1px solid ${isDone ? 'rgba(16,185,129,0.30)' : isActive ? step.accentBorder : 'var(--border)'}`,
                color: isDone ? '#34D399' : isActive ? step.accent : 'var(--text-4)',
                marginBottom: 7,
                transition: 'all .3s ease',
              }}>
                {isDone
                  ? <CheckIcon />
                  : isActive
                    ? <div style={{ width: 8, height: 8, borderRadius: '50%', border: `2px solid ${step.accent}`, borderTopColor: 'transparent', animation: 'spin .7s linear infinite' }} />
                    : <span style={{ fontFamily: 'var(--mono)', fontSize: 9, fontWeight: 700 }}>{index + 1}</span>
                }
              </span>

              {/* Label */}
              <strong style={{
                display: 'block', fontSize: 11,
                color: isDone ? '#34D399' : isActive ? 'var(--text-1)' : 'var(--text-4)',
                fontWeight: isActive ? 700 : 500,
              }}>
                {step.label}
              </strong>

              {/* Description (only active) */}
              {isActive && (
                <p style={{
                  marginTop: 3, fontSize: 10, color: step.accent,
                  lineHeight: 1.4, fontWeight: 500,
                }}>
                  {step.desc}
                </p>
              )}
              {isPending && (
                <p style={{ marginTop: 3, fontSize: 10, color: 'var(--text-4)', lineHeight: 1.4 }}>
                  Aguardando…
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Loader;
