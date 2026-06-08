import React from 'react';

interface StepItem {
  step: string;
  title: string;
  text: string;
  accent: string;
  accentBg: string;
  accentBorder: string;
  icon: React.ReactNode;
}

const steps: StepItem[] = [
  {
    step: '01',
    title: 'Roteiro',
    text: 'Cole texto livre, importe CSV/DOCX ou retome um projeto exportado.',
    accent: '#4F8CFF',
    accentBg: 'rgba(79,140,255,0.10)',
    accentBorder: 'rgba(79,140,255,0.28)',
    icon: (
      <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
      </svg>
    ),
  },
  {
    step: '02',
    title: 'Análise IA',
    text: 'A IA identifica cenas, subcenas, personagens, ações e contexto visual.',
    accent: '#22D3EE',
    accentBg: 'rgba(34,211,238,0.10)',
    accentBorder: 'rgba(34,211,238,0.28)',
    icon: (
      <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
      </svg>
    ),
  },
  {
    step: '03',
    title: 'Direção visual',
    text: 'Revise prompts, enquadramentos, estilo cinematográfico e continuidade.',
    accent: '#8B5CF6',
    accentBg: 'rgba(139,92,246,0.10)',
    accentBorder: 'rgba(139,92,246,0.28)',
    icon: (
      <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="23 7 16 12 23 17 23 7"/>
        <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
      </svg>
    ),
  },
  {
    step: '04',
    title: 'Produção',
    text: 'Gere imagens com IA, acompanhe custos, organize a galeria e exporte.',
    accent: '#10B981',
    accentBg: 'rgba(16,185,129,0.10)',
    accentBorder: 'rgba(16,185,129,0.28)',
    icon: (
      <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
    ),
  },
];

const FlowStepper: React.FC = () => (
  <section className="flow-section">
    <div className="flow-section-header">
      <div>
        <p className="section-title">Como funciona</p>
        <p className="section-sub">Do roteiro bruto ao storyboard visual pronto para produção.</p>
      </div>
    </div>
    <div className="workflow-grid">
      {steps.map((item) => (
        <div key={item.step} className="workflow-card">
          <span
            className="step"
            style={{
              background: item.accentBg,
              border: `1px solid ${item.accentBorder}`,
              color: item.accent,
            }}
          >
            {item.icon}
            {item.step}
          </span>
          <strong>{item.title}</strong>
          <p>{item.text}</p>
        </div>
      ))}
    </div>
  </section>
);

export default FlowStepper;
