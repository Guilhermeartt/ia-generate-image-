import React, { useRef } from 'react';
import { APP_VIEWS, type AppView } from '@/config/views';
import type { CurrentUser } from '@/services/saasService';
import type { PlatformProvider } from '@/services/geminiService';
import type { Theme } from '@/hooks/useTheme';
import {
  SparklesIcon,
  ArchiveIcon,
  SettingsIcon,
  FolderOpenIcon,
  GalleryIcon,
  CostReportIcon,
  SunIcon,
  MoonIcon,
  UploadIcon,
} from '@/components/icons';

interface SidebarProps {
  file: File | null;
  isDone: boolean;
  activeView: AppView;
  characterCount: number;
  sceneCount: number;
  showRightPanel: boolean;
  theme: Theme;
  currentUser: CurrentUser | null;
  platformProvider: PlatformProvider;
  cloudSaveStatus: string;
  isDownloading: boolean;
  onNavigate: (view: AppView) => void;
  onToggleRightPanel: () => void;
  onNewProject: () => void;
  onPasteScript: () => void;
  onFileSelect: (file: File) => void;
  onProjectFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onOpenGallery: () => void;
  onSaveCloud: () => void;
  onExport: () => void;
  onSetTheme: (theme: Theme) => void;
  onOpenSettings: () => void;
  onOpenAccount: () => void;
  onLogin: () => void;
  onLogout: () => void;
}

/**
 * Sidebar de navegação (extraída de App.tsx). A ordem dos filhos diretos do
 * <aside> importa: o CSS mobile (≤780px) referencia div:first-child (brand),
 * nav (oculta em telas estreitas) e div:last-child (conta). Em telas
 * estreitas a navegação entre views fica na MobileBottomNav.
 */
const Sidebar: React.FC<SidebarProps> = ({
  file,
  isDone,
  activeView,
  characterCount,
  sceneCount,
  showRightPanel,
  theme,
  currentUser,
  platformProvider,
  cloudSaveStatus,
  isDownloading,
  onNavigate,
  onToggleRightPanel,
  onNewProject,
  onPasteScript,
  onFileSelect,
  onProjectFileChange,
  onOpenGallery,
  onSaveCloud,
  onExport,
  onSetTheme,
  onOpenSettings,
  onOpenAccount,
  onLogin,
  onLogout,
}) => {
  const csvInputRef = useRef<HTMLInputElement>(null);
  const viewCounts: Record<AppView, number | null> = {
    characters: characterCount,
    scenes: sceneCount,
    video: null,
    costs: null,
  };
  const providerLabel =
    currentUser?.aiBillingMode === 'user_key'
      ? 'API própria'
      : platformProvider === 'vertex_express' || platformProvider === 'vertex'
        ? 'Vertex AI'
        : platformProvider === 'api_key'
          ? 'Google AI Studio'
          : 'API da plataforma';

  return (
    <aside className="sidebar">

      {/* ── Brand ── */}
      <div style={{padding:'14px 14px 12px',borderBottom:'1px solid var(--border)',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <div style={{width:28,height:28,borderRadius:7,background:'var(--indigo)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
            <SparklesIcon width={14} height={14} />
          </div>
          <div style={{minWidth:0}}>
            <p style={{fontSize:13,fontWeight:700,color:'var(--text-1)',lineHeight:1.2,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>Estúdio Visual</p>
            <p style={{fontSize:10,color:'var(--text-4)',lineHeight:1.2}}>Powered by Gemini</p>
          </div>
        </div>

        {file && isDone && (
          <div style={{marginTop:10,padding:'4px 8px',borderRadius:6,background:'var(--surface-2)',border:'1px solid var(--border)',display:'flex',alignItems:'center',gap:6}}>
            <div className="dot-live" style={{flexShrink:0}} />
            <span style={{fontSize:11,color:'var(--text-2)',fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flex:1}}>{file.name}</span>
          </div>
        )}
      </div>

      {/* ── Primary nav ── */}
      <nav style={{flex:1,padding:'8px 0',overflowY:'auto'}}>

        <span className="sidebar-label">Criar</span>
        <button className="sidebar-item" onClick={onNewProject}>
          <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14"/></svg>
          Novo projeto
        </button>
        <button className="sidebar-item" onClick={onPasteScript}>
          <SparklesIcon width={15} height={15} />
          Colar roteiro
        </button>
        <button className="sidebar-item" onClick={() => csvInputRef.current?.click()}>
          <UploadIcon width={15} height={15} />
          Importar CSV/DOCX
        </button>
        <input
          ref={csvInputRef}
          type="file"
          className="hidden"
          accept=".csv,.docx,text/csv,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={(e) => {
            const selected = e.target.files?.[0];
            if (selected) onFileSelect(selected);
            e.currentTarget.value = '';
          }}
        />

        {isDone && (
          <>
            <span className="sidebar-label" style={{marginTop:8}}>Produção</span>
            {APP_VIEWS.map((item) => (
              <button key={item.id} onClick={() => onNavigate(item.id)} className={`sidebar-item${activeView === item.id ? ' active' : ''}`}>
                {item.icon}
                <span style={{flex:1}}>{item.label}</span>
                {viewCounts[item.id] !== null && <span className="sidebar-badge">{viewCounts[item.id]}</span>}
              </button>
            ))}
            <button className={`sidebar-item${showRightPanel ? ' active' : ''}`} onClick={onToggleRightPanel}>
              <SettingsIcon width={15} height={15} />
              Propriedades
            </button>
          </>
        )}

        <span className="sidebar-label" style={{marginTop:8}}>Biblioteca</span>
        <label htmlFor="sidebar-project-upload" className="sidebar-item" style={{cursor:'pointer'}}>
          <FolderOpenIcon width={15} height={15} />
          Abrir .zip
        </label>
        <input type="file" id="sidebar-project-upload" className="hidden" accept=".zip,application/zip" onChange={onProjectFileChange} />
        {isDone && (
          <>
            <button className="sidebar-item" onClick={onOpenGallery}>
              <GalleryIcon width={15} height={15} />
              Galeria
            </button>
            <button className="sidebar-item" onClick={onSaveCloud}>
              <ArchiveIcon width={15} height={15} />
              {cloudSaveStatus || (currentUser ? 'Salvar na nuvem' : 'Entrar para salvar')}
            </button>
            <button className="sidebar-item" onClick={onExport} disabled={isDownloading}>
              <ArchiveIcon width={15} height={15} />
              {isDownloading ? 'Exportando…' : 'Exportar'}
            </button>
          </>
        )}
      </nav>

      {/* ── Bottom utilities ── */}
      <div style={{padding:'10px 10px 14px',borderTop:'1px solid var(--border)',flexShrink:0}}>
        <span className="sidebar-label" style={{padding:'0 4px 6px'}}>Conta</span>
        {/* Theme toggle */}
        <div style={{display:'flex',gap:2,padding:3,background:'var(--surface-2)',border:'1px solid var(--border)',borderRadius:8,marginBottom:6}}>
          {([
            { value: 'dark'  as const, Icon: MoonIcon, label: 'Escuro' },
            { value: 'light' as const, Icon: SunIcon,  label: 'Claro'  },
          ]).map(({ value, Icon, label }) => (
            <button key={value} onClick={() => onSetTheme(value)} title={label} style={{
              flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:4,
              padding:'5px 6px', borderRadius:6, fontSize:11, fontWeight:500,
              border: theme === value ? '1px solid var(--border-md)' : '1px solid transparent',
              background: theme === value ? 'var(--surface)' : 'transparent',
              color: theme === value ? 'var(--text-1)' : 'var(--text-3)',
              cursor:'pointer', transition:'all .12s ease',
              boxShadow: theme === value ? '0 1px 3px rgba(0,0,0,0.2)' : 'none',
            }}>
              <Icon width={11} height={11} />
              {label}
            </button>
          ))}
        </div>
        <button className="sidebar-item" onClick={onOpenSettings}>
          <SettingsIcon width={15} height={15} />
          Configurações
        </button>
        {currentUser && (
          <button className="sidebar-item" onClick={onOpenAccount}>
            <CostReportIcon width={15} height={15} />
            Plano e uso
          </button>
        )}
        <button className="sidebar-item" onClick={() => (currentUser ? onLogout() : onLogin())}>
          <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          {currentUser ? 'Sair' : 'Entrar'}
        </button>
        {currentUser && (
          <button
            onClick={onOpenAccount}
            style={{
              width: '100%', textAlign: 'left', cursor: 'pointer',
              marginTop: 8, padding: 8, borderRadius: 8,
              background: 'var(--surface-2)', border: '1px solid var(--border)',
              fontSize: 11, color: 'var(--text-3)', lineHeight: 1.5,
            }}
          >
            <p style={{ color: 'var(--text-1)', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentUser.name}</p>
            <p>{currentUser.planId} · {currentUser.creditBalance} créditos</p>
            <p>{providerLabel}</p>
          </button>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
