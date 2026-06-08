import React from 'react';
import type { CurrentUser } from '../services/saasService';
import { CostReportIcon, SettingsIcon, SparklesIcon } from './icons';

interface PricingNoticeProps {
  user: CurrentUser | null;
  onLogin: () => void;
  onAccount: () => void;
  onConfigure: () => void;
}

const PricingNotice: React.FC<PricingNoticeProps> = ({ user, onLogin, onAccount, onConfigure }) => {
  const cards = [
    {
      title: 'Plano gratuito',
      badge: 'Grátis',
      badgeColor: 'badge-green',
      text: 'Comece sem cartão. Analise roteiros curtos e explore o fluxo completo de storyboard.',
      action: user ? 'Ver plano' : 'Criar conta grátis',
      onClick: user ? onAccount : onLogin,
      icon: <SparklesIcon width={15} height={15} />,
      accentColor: '#10B981',
      accentBg: 'rgba(16,185,129,0.10)',
      accentBorder: 'rgba(16,185,129,0.28)',
    },
    {
      title: 'Créditos da plataforma',
      badge: 'SaaS',
      badgeColor: 'badge-indigo',
      text: 'Use a API Gemini gerenciada pela plataforma. Histórico na nuvem, controle de consumo e suporte.',
      action: user ? 'Gerenciar créditos' : 'Entrar',
      onClick: user ? onAccount : onLogin,
      icon: <CostReportIcon width={15} height={15} />,
      accentColor: '#4F8CFF',
      accentBg: 'rgba(79,140,255,0.10)',
      accentBorder: 'rgba(79,140,255,0.28)',
    },
    {
      title: 'BYOK — API própria',
      badge: 'Flexível',
      badgeColor: 'badge-amber',
      text: 'Use sua própria Gemini API Key. Sem limites de plano, sem créditos — você paga diretamente ao Google.',
      action: 'Configurar API Key',
      onClick: onConfigure,
      icon: <SettingsIcon width={15} height={15} />,
      accentColor: '#F59E0B',
      accentBg: 'rgba(245,158,11,0.10)',
      accentBorder: 'rgba(245,158,11,0.28)',
    },
  ];

  return (
    <section className="pricing-notice">
      <div className="section-hd" style={{ marginBottom: 12 }}>
        <div>
          <p className="section-title">Como usar a IA</p>
          <p className="section-sub">Escolha o modo que melhor se adapta ao seu fluxo de trabalho.</p>
        </div>
        {user && <span className="badge badge-green">{user.plan?.name || user.planId}</span>}
      </div>

      <div className="pricing-notice-grid">
        {cards.map((card) => (
          <button key={card.title} className="pricing-notice-card" onClick={card.onClick}>
            <span
              className="pricing-notice-icon"
              style={{
                background: card.accentBg,
                border: `1px solid ${card.accentBorder}`,
                color: card.accentColor,
              }}
            >
              {card.icon}
            </span>
            <span className="pricing-notice-copy">
              <span className={`badge ${card.badgeColor}`}>{card.badge}</span>
              <strong>{card.title}</strong>
              <span>{card.text}</span>
            </span>
            <span className="pricing-notice-action" style={{ color: card.accentColor }}>
              {card.action} →
            </span>
          </button>
        ))}
      </div>
    </section>
  );
};

export default PricingNotice;
