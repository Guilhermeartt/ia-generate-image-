import React from 'react';
import type { CurrentUser } from '../services/saasService';
import type { PlatformProvider } from '../services/geminiService';
import { SettingsIcon } from './icons';

interface CreditAlertProps {
  user: CurrentUser | null;
  hasPlatformKey: boolean;
  platformProvider?: PlatformProvider;
  hasLocalApiKey: boolean;
  onConfigure: () => void;
  onLogin: () => void;
  onAccount: () => void;
}

const providerShortLabel = (p?: PlatformProvider): string => {
  if (p === 'vertex_express' || p === 'vertex') return 'Vertex AI';
  if (p === 'api_key') return 'Google AI Studio';
  return 'API da plataforma';
};

const CreditAlert: React.FC<CreditAlertProps> = ({
  user,
  hasPlatformKey,
  platformProvider,
  hasLocalApiKey,
  onConfigure,
  onLogin,
  onAccount,
}) => {
  const isByok = Boolean(hasLocalApiKey || user?.aiBillingMode === 'user_key');
  const hasCredits = Boolean(user && user.creditBalance > 0);
  const platformLabel = providerShortLabel(platformProvider);

  const state = (() => {
    if (isByok) {
      return {
        tone: 'green',
        title: 'API própria ativa',
        text: 'Custos cobrados diretamente pela sua conta Google.',
        primary: 'Ajustar',
        secondary: user ? 'Conta' : 'Entrar',
      };
    }
    if (hasCredits) {
      return {
        tone: 'green',
        title: `${user?.creditBalance.toLocaleString('pt-BR')} créditos`,
        text: `Plano ${user?.plan?.name || user?.planId} · ${platformLabel} ativa.`,
        primary: 'Ver uso',
        secondary: 'Ajustar IA',
      };
    }
    if (user && hasPlatformKey) {
      return {
        tone: 'amber',
        title: 'Créditos esgotados',
        text: 'Configure sua API Key Gemini ou faça upgrade para continuar.',
        primary: 'Ver planos',
        secondary: 'Usar API Key',
      };
    }
    return {
      tone: 'amber',
      title: 'Configure a IA para começar',
      text: hasPlatformKey
        ? 'Entre para usar créditos ou configure sua Gemini API Key.'
        : 'Adicione uma Gemini API Key para analisar roteiros e gerar imagens.',
      primary: user ? 'Configurar IA' : 'Entrar',
      secondary: 'API Key',
    };
  })();

  const color = state.tone === 'green' ? '#34D399' : '#F59E0B';

  return (
    <div className={`credit-alert credit-alert-${state.tone}`}>
      <div className="credit-alert-icon">
        <SettingsIcon width={13} height={13} />
      </div>
      <div className="credit-alert-copy">
        <strong style={{ color }}>{state.title}</strong>
        <span>{state.text}</span>
      </div>
      <div className="credit-alert-actions">
        <button
          className="btn btn-ghost"
          style={{ fontSize: 12, color, borderColor: `${color}33` }}
          onClick={() => {
            if (state.primary === 'Entrar') onLogin();
            else if (state.primary === 'Ver uso' || state.primary === 'Ver planos') onAccount();
            else onConfigure();
          }}
        >
          {state.primary}
        </button>
        <button
          className="btn btn-ghost"
          style={{ fontSize: 12 }}
          onClick={() => {
            if (state.secondary === 'Conta') onAccount();
            else if (state.secondary === 'Entrar') onLogin();
            else onConfigure();
          }}
        >
          {state.secondary}
        </button>
      </div>
    </div>
  );
};

export default CreditAlert;
