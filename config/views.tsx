import React from 'react';
import { CostReportIcon } from '@/components/icons';

/** View principal da área de produção (projeto analisado). */
export type AppView = 'characters' | 'scenes' | 'video' | 'costs';

export interface AppViewDef {
  id: AppView;
  /** Slug usado no hash da URL (#/cenas) — habilita voltar/avançar do navegador. */
  slug: string;
  /** Rótulo padrão (sidebar). */
  label: string;
  /** Rótulo do breadcrumb quando difere do padrão. */
  breadcrumb: string;
  /** Rótulo compacto da bottom nav mobile. */
  shortLabel: string;
  icon: React.ReactNode;
}

/**
 * Registry único das views de produção. Sidebar, topbar (breadcrumb) e
 * navegação por hash derivam todos daqui — adicionar uma view nova é
 * acrescentar uma entrada neste array e o respectivo bloco de conteúdo.
 */
export const APP_VIEWS: AppViewDef[] = [
  {
    id: 'characters',
    slug: 'personagens',
    label: 'Personagens',
    breadcrumb: 'Personagens',
    shortLabel: 'Pessoas',
    icon: (
      <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="7" r="4"/>
        <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
        <circle cx="19" cy="11" r="2"/>
        <path d="M23 21v-1a2 2 0 0 0-2-2h-1"/>
      </svg>
    ),
  },
  {
    id: 'scenes',
    slug: 'cenas',
    label: 'Cenas',
    breadcrumb: 'Cenas',
    shortLabel: 'Cenas',
    icon: (
      <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="20" height="20" rx="2.18"/>
        <line x1="7" y1="2" x2="7" y2="22"/>
        <line x1="17" y1="2" x2="17" y2="22"/>
        <line x1="2" y1="12" x2="22" y2="12"/>
      </svg>
    ),
  },
  {
    id: 'video',
    slug: 'video',
    label: 'Vídeo',
    breadcrumb: 'Vídeo do Storyboard',
    shortLabel: 'Vídeo',
    icon: (
      <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="4" width="15" height="16" rx="2"/>
        <path d="m17 9 5-3v12l-5-3z"/>
        <path d="m8 9 4 3-4 3z"/>
      </svg>
    ),
  },
  {
    id: 'costs',
    slug: 'custos',
    label: 'Custos',
    breadcrumb: 'Relatório de Custos',
    shortLabel: 'Uso',
    icon: <CostReportIcon width={15} height={15} />,
  },
];

export const viewDef = (id: AppView): AppViewDef =>
  APP_VIEWS.find((v) => v.id === id) ?? APP_VIEWS[0];

export const hashForView = (id: AppView): string => `#/${viewDef(id).slug}`;

export const viewFromHash = (hash: string): AppView | null => {
  const slug = hash.replace(/^#\/?/, '');
  return APP_VIEWS.find((v) => v.slug === slug)?.id ?? null;
};
