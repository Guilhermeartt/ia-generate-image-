import React from 'react';
import type { CurrentUser } from '../services/saasService';
import FileUpload from './FileUpload';
import { FolderOpenIcon, SparklesIcon, UploadIcon } from './icons';

interface ProjectStartCardProps {
  hasApiKey: boolean;
  currentUser: CurrentUser | null;
  onPasteScript: () => void;
  onConfigureAi: () => void;
  onLogin: () => void;
  onAccount: () => void;
  onFileSelect: (file: File) => void;
  projectUploadInputId: string;
}

const ProjectStartCard: React.FC<ProjectStartCardProps> = ({
  hasApiKey,
  currentUser,
  onPasteScript,
  onConfigureAi,
  onLogin,
  onAccount,
  onFileSelect,
  projectUploadInputId,
}) => (
  <section className="start-panel elevated">
    <div className="start-panel-header">
      <div>
        <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.01em' }}>Criar storyboard</p>
        <p style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 3 }}>
          Roteiro livre, CSV, arquivo Word ou projeto exportado.
        </p>
      </div>
      <button
        className={`badge ${hasApiKey ? 'badge-green' : 'badge-amber'}`}
        onClick={onConfigureAi}
        style={{ cursor: 'pointer' }}
        title={hasApiKey ? 'IA configurada — clique para ajustar' : 'Configure a IA para gerar imagens'}
      >
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: hasApiKey ? '#34D399' : '#F59E0B',
          display: 'inline-block', flexShrink: 0,
          animation: hasApiKey ? 'pulse-dot 2s ease-in-out infinite' : 'none',
        }} />
        {hasApiKey ? 'IA pronta' : 'Configurar IA'}
      </button>
    </div>

    <div className="start-panel-body">
      {/* Primary action — full width feature */}
      <button
        className="quick-action primary"
        onClick={onPasteScript}
        style={{ width: '100%', minHeight: 76 }}
      >
        <span className="quick-action-icon"><SparklesIcon width={16} height={16} /></span>
        <span style={{ flex: 1 }}>
          <strong>Roteiro livre</strong>
          <span>Cole texto corrido, briefing ou cenas numeradas. A IA estrutura tudo.</span>
        </span>
        <svg
          width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ color: 'var(--indigo)', flexShrink: 0, opacity: 0.7 }}
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>

      {/* Secondary actions — 2 columns */}
      <div className="quick-action-grid">
        <div className="upload-section" style={{ padding: '10px 12px', margin: 0 }}>
          <div style={{ marginBottom: 8 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
              <UploadIcon width={13} height={13} style={{ color: 'var(--cyan)', flexShrink: 0 }} />
              CSV ou Word
            </p>
            <p style={{ fontSize: 11, color: 'var(--text-4)', lineHeight: 1.4 }}>
              Planilha estruturada ou roteiro em .docx.
            </p>
          </div>
          <FileUpload onFileSelect={onFileSelect} compact />
        </div>

        <label
          className="quick-action"
          htmlFor={projectUploadInputId}
          style={{ minHeight: 0, padding: '12px 13px' }}
        >
          <span className="quick-action-icon" style={{ alignSelf: 'flex-start', marginTop: 2 }}>
            <FolderOpenIcon width={16} height={16} />
          </span>
          <span>
            <strong>Projeto salvo</strong>
            <span>Retome um .zip exportado anteriormente.</span>
          </span>
        </label>
      </div>

      {/* Account status */}
      <div className="status-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
          <div
            style={{
              width: 28, height: 28, borderRadius: 8,
              background: currentUser ? 'rgba(79,140,255,0.12)' : 'rgba(255,255,255,0.06)',
              border: '1px solid var(--border)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, color: currentUser ? 'var(--indigo)' : 'var(--text-4)',
            }}
          >
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </div>
          <div style={{ minWidth: 0 }}>
            <p className="status-card-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {currentUser ? currentUser.name : 'Visitante'}
            </p>
            <p className="status-card-sub">
              {currentUser
                ? `${currentUser.plan?.name || currentUser.planId} · ${currentUser.aiBillingMode === 'user_key' ? 'API própria' : `${currentUser.creditBalance} créditos`}`
                : 'Entre para salvar histórico e usar créditos da plataforma.'}
            </p>
          </div>
        </div>
        <button
          className="btn btn-ghost"
          style={{ fontSize: 12, flexShrink: 0 }}
          onClick={() => currentUser ? onAccount() : onLogin()}
        >
          {currentUser ? 'Conta' : 'Entrar'}
        </button>
      </div>
    </div>
  </section>
);

export default ProjectStartCard;
