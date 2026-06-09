import React from 'react';
import { viewDef, type AppView } from '@/config/views';
import type { CurrentUser } from '@/services/saasService';
import { SparklesIcon, ReloadIcon, SettingsIcon } from '@/components/icons';

interface TopbarProps {
  isDone: boolean;
  activeView: AppView;
  batchProgress: { current: number; total: number } | null;
  currentUser: CurrentUser | null;
  showRightPanel: boolean;
  isReloadingChars: boolean;
  isGeneratingAllChars: boolean;
  isGeneratingAllScenes: boolean;
  onOpenAccount: () => void;
  onOpenAuth: () => void;
  onOpenSettings: () => void;
  onReloadCharacters: () => void;
  onGenerateAllCharacters: () => void;
  onGenerateAllScenes: () => void;
  onToggleRightPanel: () => void;
}

/** Topbar com breadcrumb, ações da view ativa e atalhos de conta (extraída de App.tsx). */
const Topbar: React.FC<TopbarProps> = ({
  isDone,
  activeView,
  batchProgress,
  currentUser,
  showRightPanel,
  isReloadingChars,
  isGeneratingAllChars,
  isGeneratingAllScenes,
  onOpenAccount,
  onOpenAuth,
  onOpenSettings,
  onReloadCharacters,
  onGenerateAllCharacters,
  onGenerateAllScenes,
  onToggleRightPanel,
}) => (
  <header className="topbar">
    {/* Breadcrumb */}
    <div style={{flex:1,display:'flex',alignItems:'center',gap:6,minWidth:0}}>
      {isDone ? (
        <>
          <span style={{fontSize:11,color:'var(--text-4)',whiteSpace:'nowrap'}}>Estúdio Visual</span>
          <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{color:'var(--text-4)',flexShrink:0}}><polyline points="9 18 15 12 9 6"/></svg>
          <span style={{fontSize:12,fontWeight:600,color:'var(--text-1)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',minWidth:0}}>
            {viewDef(activeView).breadcrumb}
          </span>
          {/* Inline batch progress indicator (minimal — full bar is floating below) */}
          {batchProgress && (
            <>
              <div className="topbar-sep" style={{marginLeft:4}} />
              <div style={{display:'flex',alignItems:'center',gap:5,minWidth:0}}>
                <div style={{width:8,height:8,border:'2px solid var(--indigo-b)',borderTopColor:'var(--indigo)',borderRadius:'50%',animation:'spin .8s linear infinite',flexShrink:0}} />
                <span style={{fontFamily:'var(--mono)',fontSize:10,color:'#818CF8',flexShrink:0,whiteSpace:'nowrap'}}>{batchProgress.current}/{batchProgress.total}</span>
              </div>
            </>
          )}
        </>
      ) : (
        <span style={{fontSize:12,fontWeight:600,color:'var(--text-2)'}}>Início</span>
      )}
    </div>

    <div style={{display:'flex',alignItems:'center',gap:6,flexShrink:0}}>
      <button
        className="btn btn-ghost"
        style={{fontSize:12,padding:'5px 10px'}}
        onClick={() => (currentUser ? onOpenAccount() : onOpenAuth())}
        title={currentUser ? 'Abrir conta, plano e uso' : 'Entrar na conta'}
      >
        {currentUser ? `${currentUser.plan?.name || currentUser.planId} · ${currentUser.creditBalance}` : 'Entrar'}
      </button>
      <button
        className="btn btn-ghost"
        style={{fontSize:12,padding:'5px 10px'}}
        onClick={onOpenSettings}
        title="Configurar API, prompts e preferências"
      >
        <SettingsIcon width={13} height={13} />
        Ajustes
      </button>
    </div>

    {/* Primary actions */}
    {isDone && activeView === 'characters' && (
      <div style={{display:'flex',gap:6,flexShrink:0}}>
        <button onClick={onReloadCharacters} disabled={isReloadingChars || isGeneratingAllChars} className="btn btn-ghost" style={{fontSize:12}}>
          {isReloadingChars ? <div style={{width:12,height:12,border:'2px solid var(--border-md)',borderTopColor:'var(--text-2)',borderRadius:'50%',animation:'spin .8s linear infinite'}} /> : <ReloadIcon width={13} height={13} />}
          {isReloadingChars ? 'Recarregando…' : 'Recarregar'}
        </button>
        <button onClick={onGenerateAllCharacters} disabled={isGeneratingAllChars || isReloadingChars} className="btn btn-primary" style={{fontSize:12}}>
          {isGeneratingAllChars ? <div style={{width:12,height:12,border:'2px solid rgba(255,255,255,.25)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin .8s linear infinite'}} /> : <SparklesIcon width={13} height={13} />}
          {isGeneratingAllChars ? 'Gerando…' : 'Gerar Todos'}
        </button>
      </div>
    )}
    {isDone && activeView === 'scenes' && (
      <button onClick={onGenerateAllScenes} disabled={isGeneratingAllScenes} className="btn btn-primary" style={{fontSize:12,flexShrink:0}}>
        {isGeneratingAllScenes ? <div style={{width:12,height:12,border:'2px solid rgba(255,255,255,.25)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin .8s linear infinite'}} /> : <SparklesIcon width={13} height={13} />}
        {isGeneratingAllScenes ? 'Gerando…' : 'Gerar Todas'}
      </button>
    )}

    {/* Panel toggle (only when project loaded) */}
    {isDone && (
      <>
        <div className="topbar-sep" />
        <button
          className={`icon-btn${showRightPanel ? ' active' : ''}`}
          onClick={onToggleRightPanel}
          title={showRightPanel ? 'Ocultar painel' : 'Mostrar painel de propriedades'}
        >
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="15" y1="3" x2="15" y2="21"/>
          </svg>
        </button>
      </>
    )}
  </header>
);

export default Topbar;
