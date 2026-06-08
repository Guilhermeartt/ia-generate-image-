import React from 'react';
import { SparklesIcon } from './icons';

interface ScriptPreviewShowcaseProps {
  onTryNow?: () => void;
}

const SAMPLE_INPUT = `CENA 1 — INT. APARTAMENTO — NOITE
Maria, 34 anos, observa a chuva pela janela.
A sala tem luz baixa e uma mala aberta no chão.
Paulo entra em silêncio segurando uma carta antiga.

CENA 2 — EXT. RUA — NOITE
Maria caminha rápido sob letreiros refletidos
no asfalto molhado. Paulo aparece atrás dela,
tentando explicar o conteúdo da carta.

CENA 3 — INT. ESTAÇÃO DE TREM — MADRUGADA
Os dois param diante da plataforma vazia.
Maria decide partir, mas entrega a Paulo uma
fotografia rasgada antes de embarcar.`;

const SAMPLE_OUTPUT = [
  {
    id: '1',
    loc: 'INT. APARTAMENTO — NOITE',
    context: 'Maria observa a chuva pela janela; mala aberta no chão. Paulo entra com carta antiga.',
    style: 'Drama · luz baixa',
  },
  {
    id: '2',
    loc: 'EXT. RUA — NOITE',
    context: 'Maria caminha rápido sob letreiros refletidos. Paulo a alcança tentando se explicar.',
    style: 'Drama · noir urbano',
  },
  {
    id: '3',
    loc: 'INT. ESTAÇÃO — MADRUGADA',
    context: 'Plataforma vazia. Maria entrega a Paulo uma fotografia rasgada antes de partir.',
    style: 'Drama · melancólico',
  },
];

const ScriptPreviewShowcase: React.FC<ScriptPreviewShowcaseProps> = ({ onTryNow }) => {
  return (
    <section className="script-preview-section" style={{ marginTop: 20 }}>
      <div className="section-hd" style={{ marginBottom: 12 }}>
        <div>
          <p className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <SparklesIcon width={15} height={15} style={{ color: 'var(--indigo)' }} />
            Como a IA estrutura o roteiro
          </p>
          <p className="section-sub">
            Veja o que esperar antes de colar seu texto — qualquer formato vira uma tabela pronta para virar storyboard.
          </p>
        </div>
        {onTryNow && (
          <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={onTryNow}>
            Testar agora →
          </button>
        )}
      </div>

      <div className="script-preview-grid">
        {/* ── BEFORE ── */}
        <div className="script-preview-card">
          <div className="script-preview-card-hd">
            <span className="script-preview-tag tag-before">Antes</span>
            <span className="script-preview-card-title">Texto que você cola</span>
          </div>
          <pre className="script-preview-raw">{SAMPLE_INPUT}</pre>
          <div className="script-preview-card-ft">
            <span className="script-preview-meta">Roteiro livre, briefing ou texto corrido</span>
          </div>
        </div>

        {/* ── ARROW ── */}
        <div className="script-preview-arrow" aria-hidden="true">
          <div className="script-preview-arrow-pill">
            <SparklesIcon width={12} height={12} />
            <span>IA estrutura</span>
          </div>
          <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </div>

        {/* ── AFTER ── */}
        <div className="script-preview-card">
          <div className="script-preview-card-hd">
            <span className="script-preview-tag tag-after">Depois</span>
            <span className="script-preview-card-title">Cenas estruturadas</span>
          </div>
          <div className="script-preview-table" role="table" aria-label="Pré-visualização das cenas estruturadas">
            <div className="script-preview-row script-preview-row-head" role="row">
              <span style={{ width: 28 }}>#</span>
              <span style={{ flex: '0 0 130px' }}>Local</span>
              <span style={{ flex: 1 }}>Contexto</span>
              <span style={{ flex: '0 0 110px' }}>Estilo</span>
            </div>
            {SAMPLE_OUTPUT.map((row) => (
              <div key={row.id} className="script-preview-row" role="row">
                <span style={{ width: 28, color: 'var(--indigo)', fontWeight: 600 }}>{row.id}</span>
                <span style={{ flex: '0 0 130px', fontWeight: 500, color: 'var(--text-2)' }}>{row.loc}</span>
                <span style={{ flex: 1, color: 'var(--text-3)' }}>{row.context}</span>
                <span style={{ flex: '0 0 110px', color: 'var(--text-3)' }}>{row.style}</span>
              </div>
            ))}
          </div>
          <div className="script-preview-card-ft">
            <span className="script-preview-meta">
              <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Pronto para revisar e gerar imagens
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ScriptPreviewShowcase;
