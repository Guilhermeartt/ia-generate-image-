import React, { useState, useEffect } from 'react';
import type { AppSettings } from '../types';
import { XIcon } from './icons';
import { DEFAULT_PROMPTS } from '../config/prompts';
import { API_KEY_STORAGE_KEY, getGeminiServerStatus, type PlatformProvider } from '../services/geminiService';
import {
  deleteServerGeminiApiKey,
  saveServerGeminiApiKey,
  updateBillingMode,
  type CurrentUser,
} from '../services/saasService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSettings: AppSettings;
  onSave: (settings: AppSettings) => void;
  currentUser?: CurrentUser | null;
  onUserUpdate?: (user: CurrentUser) => void;
  platformProvider?: PlatformProvider;
}

const providerLongLabel = (p?: PlatformProvider): string => {
  if (p === 'vertex_express') return 'Vertex AI (API key)';
  if (p === 'vertex')         return 'Vertex AI (Service Account)';
  if (p === 'api_key')        return 'Google AI Studio';
  return 'Servidor';
};

interface FieldProps {
  id: string;
  label: string;
  description: React.ReactNode;
  name: string;
  value: string;
  rows?: number;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
}

const Field: React.FC<FieldProps> = ({ id, label, description, name, value, rows = 5, onChange }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    <label htmlFor={id} className="label">{label}</label>
    <p style={{ fontSize: 11, color: 'var(--text-4)', lineHeight: 1.6 }}>{description}</p>
    <textarea
      id={id}
      name={name}
      value={value}
      onChange={onChange}
      rows={rows}
      className="field"
      style={{ resize: 'vertical', fontSize: 12 }}
    />
  </div>
);

const Tag: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <code style={{
    fontFamily: 'var(--mono)', fontSize: 11,
    padding: '1px 6px', borderRadius: 4,
    background: 'var(--indigo-s)', color: '#818CF8',
    border: '1px solid var(--indigo-b)',
  }}>
    {children}
  </code>
);

const PromptGroup: React.FC<{
  title: string;
  description: string;
  badge: string;
  children: React.ReactNode;
}> = ({ title, description, badge, children }) => (
  <section className="card-sm" style={{ overflow: 'hidden' }}>
    <div style={{
      padding: '12px 14px',
      borderBottom: '1px solid var(--border)',
      background: 'var(--surface)',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
    }}>
      <div>
        <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-1)' }}>{title}</p>
        <p style={{ fontSize: 11, color: 'var(--text-4)', lineHeight: 1.55, marginTop: 3 }}>{description}</p>
      </div>
      <span className="badge badge-blue" style={{ flexShrink: 0 }}>{badge}</span>
    </div>
    <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
      {children}
    </div>
  </section>
);

/* ─── Eye icon ──────────────────────────────────────────────── */
const EyeIcon: React.FC<{ open: boolean }> = ({ open }) => open ? (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
  </svg>
) : (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);

/* ─── API Key section (self-contained) ──────────────────────── */
const ApiKeySection: React.FC<{
  currentUser?: CurrentUser | null;
  onUserUpdate?: (user: CurrentUser) => void;
  platformProvider?: PlatformProvider;
}> = ({ currentUser, onUserUpdate, platformProvider: platformProviderProp }) => {
  const [key, setKey]           = useState('');
  const [show, setShow]         = useState(false);
  const [saved, setSaved]       = useState(false);
  const [cleared, setCleared]   = useState(false);
  const [hasPlatformKey, setHasPlatformKey] = useState(false);
  const [platformProvider, setPlatformProvider] = useState<PlatformProvider>(platformProviderProp ?? null);
  const [serverSaved, setServerSaved] = useState(false);

  // Load existing key on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(API_KEY_STORAGE_KEY);
      if (stored) setKey(stored);
    } catch {}
    getGeminiServerStatus()
      .then(status => {
        setHasPlatformKey(status.hasPlatformKey);
        setPlatformProvider(status.platformProvider ?? null);
      })
      .catch(() => {
        setHasPlatformKey(false);
        setPlatformProvider(null);
      });
  }, []);

  // If parent updates the prop later (e.g. status resolves first there), reflect it.
  useEffect(() => {
    if (platformProviderProp !== undefined) setPlatformProvider(platformProviderProp);
  }, [platformProviderProp]);

  const platformLabel = providerLongLabel(platformProvider);

  const hasKey   = key.trim().length > 0;
  const isValid  = key.trim().startsWith('AIza') && key.trim().length > 20;

  const handleSave = () => {
    try {
      localStorage.setItem(API_KEY_STORAGE_KEY, key.trim());
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {}
  };

  const handleSaveOnServer = async () => {
    try {
      const user = await saveServerGeminiApiKey(key.trim());
      onUserUpdate?.(user);
      setServerSaved(true);
      setTimeout(() => setServerSaved(false), 2500);
    } catch {}
  };

  const handleClear = async () => {
    try {
      localStorage.removeItem(API_KEY_STORAGE_KEY);
      if (currentUser?.hasGeminiApiKey) {
        const user = await deleteServerGeminiApiKey();
        onUserUpdate?.(user);
      }
      setKey('');
      setCleared(true);
      setTimeout(() => setCleared(false), 2500);
    } catch {}
  };

  return (
    <div style={{
      borderRadius: 10,
      border: '1px solid var(--border)',
      overflow: 'hidden',
      background: 'var(--surface-2)',
    }}>
      {/* Section header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 10,
        background: 'var(--surface)',
      }}>
        <div style={{
          width: 30, height: 30, borderRadius: 8,
          background: 'var(--indigo-s)', border: '1px solid var(--indigo-b)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#818CF8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>Gemini API Key</p>
          <p style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 1 }}>
            Necessária para gerar imagens e analisar roteiros
          </p>
        </div>
        {/* Status badge */}
        {hasPlatformKey && !hasKey ? (
          <span className="badge badge-green" title={`Provider: ${platformLabel}`}>Via {platformLabel}</span>
        ) : isValid ? (
          <span className="badge badge-green">Configurada</span>
        ) : hasKey ? (
          <span className="badge badge-amber">Verificar</span>
        ) : (
          <span className="badge badge-red">Não configurada</span>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Env var notice */}
        {hasPlatformKey && !hasKey && (
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 12px',
            borderRadius: 7, background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)',
          }}>
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <p style={{ fontSize: 11, color: '#34D399', lineHeight: 1.6 }}>
              Suas chamadas estão sendo feitas via <strong>{platformLabel}</strong> usando as credenciais do servidor.
              {platformProvider === 'vertex_express' && ' (Vertex AI em modo Express com API key — billing direto na conta GCP da plataforma.)'}
              {platformProvider === 'vertex' && ' (Vertex AI com Service Account — billing direto na conta GCP da plataforma.)'}
              {' '}Você pode usar uma key própria abaixo para fazer as chamadas pela sua conta Google AI Studio.
            </p>
          </div>
        )}

        {/* Input */}
        <div>
          <label className="label" style={{ marginBottom: 6 }}>Chave de API</label>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <input
              type={show ? 'text' : 'password'}
              value={key}
              onChange={e => setKey(e.target.value)}
              className="field"
              placeholder="AIzaSy…"
              style={{
                fontFamily: show ? 'inherit' : 'var(--mono)',
                fontSize: 13,
                paddingRight: 44,
                letterSpacing: show ? 'normal' : '0.08em',
                borderColor: hasKey && !isValid ? 'rgba(245,158,11,0.5)' : undefined,
              }}
              spellCheck={false}
              autoComplete="off"
            />
            <button
              type="button"
              onClick={() => setShow(v => !v)}
              title={show ? 'Ocultar' : 'Mostrar'}
              style={{
                position: 'absolute', right: 10,
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-4)', display: 'flex', alignItems: 'center',
                padding: 4, borderRadius: 4,
              }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-2)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-4)')}
            >
              <EyeIcon open={show} />
            </button>
          </div>

          {/* Inline validation hint */}
          {hasKey && !isValid && (
            <p style={{ fontSize: 11, color: 'var(--amber)', marginTop: 5 }}>
              ⚠ Chaves Gemini geralmente começam com <code style={{ fontFamily: 'var(--mono)', fontSize: 10 }}>AIza</code> e têm mais de 20 caracteres.
            </p>
          )}
          {hasKey && isValid && (
            <p style={{ fontSize: 11, color: 'var(--green)', marginTop: 5 }}>
              ✓ Formato válido.
            </p>
          )}
        </div>

        {/* Helper link */}
        <p style={{ fontSize: 11, color: 'var(--text-4)', lineHeight: 1.6 }}>
          Obtenha uma chave gratuita em{' '}
          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#818CF8', textDecoration: 'none', fontWeight: 500 }}
            onMouseEnter={e => ((e.target as HTMLElement).style.textDecoration = 'underline')}
            onMouseLeave={e => ((e.target as HTMLElement).style.textDecoration = 'none')}
          >
            Google AI Studio
          </a>
          . A chave é salva no seu navegador (localStorage) e enviada somente ao servidor da aplicação para executar as chamadas ao Gemini.
        </p>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={handleSave}
            disabled={!hasKey}
            className="btn btn-primary"
            style={{ fontSize: 12 }}
          >
            {saved ? (
              <>
                <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                Salva!
              </>
            ) : (
              <>
                <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                Salvar Key
              </>
            )}
          </button>

          {localStorage.getItem(API_KEY_STORAGE_KEY) && (
            <button
              onClick={handleClear}
              className="btn btn-danger"
              style={{ fontSize: 12 }}
            >
              {cleared ? 'Removida!' : 'Remover'}
            </button>
          )}

          <p style={{ fontSize: 11, color: 'var(--text-4)', marginLeft: 'auto' }}>
            {currentUser ? 'Conta conectada' : 'Salvo localmente'}
          </p>
        </div>

        {currentUser && (
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 8,
            paddingTop: 10, borderTop: '1px solid var(--border)',
          }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleSaveOnServer}
                disabled={!isValid}
                className="btn btn-primary"
                style={{ fontSize: 12 }}
              >
                {serverSaved ? 'Salva no servidor!' : 'Salvar criptografada'}
              </button>
              <select
                value={currentUser.aiBillingMode}
                onChange={async e => {
                  const user = await updateBillingMode(e.target.value as 'platform' | 'user_key');
                  onUserUpdate?.(user);
                }}
                className="field"
                style={{ fontSize: 12 }}
              >
                <option value="platform">Usar API da plataforma</option>
                <option value="user_key">Usar minha API key</option>
              </select>
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-4)', lineHeight: 1.5 }}>
              No modo SaaS, a key salva no servidor fica criptografada e permite registrar uso, projetos, créditos e histórico por conta.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

/* ─── Main modal ─────────────────────────────────────────────── */
const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, initialSettings, onSave, currentUser, onUserUpdate, platformProvider }) => {
  const [current, setCurrent] = useState<AppSettings>(initialSettings);
  const [activeTab, setActiveTab] = useState<'ai' | 'prompts' | 'workflow'>('ai');

  useEffect(() => {
    setCurrent(initialSettings);
  }, [initialSettings, isOpen]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setCurrent(prev => ({ ...prev, [name]: value }));
  };

  const handleRestoreDefaults = () => {
    if (window.confirm('Restaurar todos os prompts para os valores padrão?')) {
      setCurrent(DEFAULT_PROMPTS);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
        animation: 'fadeIn .2s ease both',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 860, maxHeight: '92vh',
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 14, display: 'flex', flexDirection: 'column',
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px 0', flexShrink: 0,
        }}>
          <div>
            <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)' }}>Configurações</p>
            <p style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 2 }}>Conexão de IA, prompts e organização do fluxo</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            style={{
              width: 30, height: 30, borderRadius: '50%',
              background: 'var(--surface-2)', border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'var(--text-3)',
            }}
          >
            <XIcon width={14} height={14} />
          </button>
        </div>

        {/* Tab bar */}
        <div style={{ padding: '12px 20px 0', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div className="tab-bar" style={{ borderRadius: 8 }}>
            {([
              { id: 'ai'       as const, label: 'Conexão IA' },
              { id: 'prompts'  as const, label: 'Prompts' },
              { id: 'workflow' as const, label: 'Fluxo e navegação' },
            ]).map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`tab-item${activeTab === tab.id ? ' active' : ''}`}
                style={{ fontSize: 12, padding: '5px 14px' }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>

          {activeTab === 'ai' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(260px, 0.8fr)', gap: 14 }}>
              <ApiKeySection currentUser={currentUser} onUserUpdate={onUserUpdate} platformProvider={platformProvider} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div className="card-sm" style={{ padding: 14 }}>
                  <p className="label">Modo recomendado</p>
                  <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>SaaS com créditos + BYOK</p>
                  <p style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.6, marginTop: 6 }}>
                    Usuários podem consumir créditos da plataforma ou salvar a própria API Key criptografada para planos mais baratos e limites maiores.
                  </p>
                </div>
                <div className="card-sm" style={{ padding: 14 }}>
                  <p className="label">Conta atual</p>
                  <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>{currentUser ? currentUser.email : 'Visitante'}</p>
                  <p style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.6, marginTop: 6 }}>
                    {currentUser
                      ? `${currentUser.plan?.name || currentUser.planId} · ${currentUser.creditBalance} créditos · ${currentUser.aiBillingMode === 'user_key' ? 'API própria' : providerLongLabel(platformProvider)}`
                      : `Entre para salvar projetos, controlar uso e usar ${providerLongLabel(platformProvider) === 'Servidor' ? 'a API da plataforma' : providerLongLabel(platformProvider)}.`}
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'prompts' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 280px) minmax(0, 1fr)', gap: 14, alignItems: 'start' }}>
              <div className="card-sm" style={{ padding: 14, position: 'sticky', top: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-1)' }}>Mapa dos prompts</p>
                <p style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.65, marginTop: 8 }}>
                  Os prompts seguem a jornada do produto: primeiro estruturam o roteiro, depois extraem contexto e personagens, então criam prompts visuais para cenas e retratos.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 12 }}>
                  {[
                    ['1', 'Roteiro livre → cenas'],
                    ['2', 'Contexto visual geral'],
                    ['3', 'Personagens do roteiro'],
                    ['4', 'Cenas → prompts visuais'],
                    ['5', 'Retratos dos personagens'],
                  ].map(([step, label]) => (
                    <div key={step} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        width: 20, height: 20, borderRadius: 5,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'var(--indigo-s)', border: '1px solid var(--indigo-b)',
                        color: '#818CF8', fontSize: 10, fontWeight: 800, fontFamily: 'var(--mono)',
                      }}>{step}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{label}</span>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                  <p className="label">Placeholders aceitos</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 7 }}>
                    {['{script_text}', '{max_scenes}', '{physical_characteristics}', '{character_list}', '{location}', '{description}', '{style_instruction}'].map(tag => (
                      <Tag key={tag}>{tag}</Tag>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <PromptGroup
                  title="Análise de roteiro"
                  description="Converte texto livre, DOCX ou roteiro colado em uma estrutura de cenas e subcenas para o fluxo interno."
                  badge="Entrada"
                >
                  <Field
                    id="scriptStructuringPrompt"
                    label="Estruturação de roteiro livre"
                    description={<>Use <Tag>{'{script_text}'}</Tag> para o roteiro original e <Tag>{'{max_scenes}'}</Tag> para o limite de linhas permitido pelo plano.</>}
                    name="scriptStructuringPrompt"
                    value={current.scriptStructuringPrompt}
                    rows={10}
                    onChange={handleChange}
                  />
                </PromptGroup>

                <PromptGroup
                  title="Análise visual global"
                  description="Cria o contexto cinematográfico que será anexado às gerações de imagem para manter atmosfera e direção visual."
                  badge="Contexto"
                >
                  <Field
                    id="generalContextPrompt"
                    label="Contexto geral do projeto"
                    description="Analisa todo o roteiro estruturado para resumir cenário, tom, atmosfera, época e linguagem visual."
                    name="generalContextPrompt"
                    value={current.generalContextPrompt}
                    rows={6}
                    onChange={handleChange}
                  />
                </PromptGroup>

                <PromptGroup
                  title="Personagens"
                  description="Identifica personagens e cria uma base consistente para continuidade visual ao longo das cenas."
                  badge="Elenco"
                >
                  <Field
                    id="characterGenerationPrompt"
                    label="Identificação e descrição de personagens"
                    description="Extrai nomes únicos e características físicas com base no roteiro. O retorno precisa ser JSON estruturado."
                    name="characterGenerationPrompt"
                    value={current.characterGenerationPrompt}
                    rows={7}
                    onChange={handleChange}
                  />

                  <Field
                    id="characterImagePrompt"
                    label="Geração de imagem de personagem"
                    description={<>Template usado para retratos dos personagens. Use <Tag>{'{physical_characteristics}'}</Tag> para inserir a descrição física detectada. Evite qualquer instrução que peça texto, card, layout, tela, gráfico, UI ou GUI.</>}
                    name="characterImagePrompt"
                    value={current.characterImagePrompt}
                    rows={6}
                    onChange={handleChange}
                  />
                </PromptGroup>

                <PromptGroup
                  title="Cenas e prompts visuais"
                  description="Marca personagens citados em cada cena e gera o prompt visual que será enviado ao modelo de imagem."
                  badge="Produção"
                >
                  <Field
                    id="sceneAnalysisPrompt"
                    label="Análise de cena e prompt de imagem"
                    description={<>Use <Tag>{'{character_list}'}</Tag>, <Tag>{'{location}'}</Tag>, <Tag>{'{description}'}</Tag> e <Tag>{'{style_instruction}'}</Tag>. O retorno precisa conter <Tag>tagged_description</Tag> e <Tag>image_prompt</Tag>.</>}
                    name="sceneAnalysisPrompt"
                    value={current.sceneAnalysisPrompt}
                    rows={10}
                    onChange={handleChange}
                  />
                </PromptGroup>
              </div>
            </div>
          )}

          {activeTab === 'workflow' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
              {[
                { title: 'Criar', desc: 'Novo projeto, colar roteiro e importar CSV ficam sempre juntos no topo do menu.' },
                { title: 'Produção', desc: 'Depois da análise, personagens, cenas, custos e propriedades aparecem como módulos de trabalho.' },
                { title: 'Biblioteca', desc: 'Galeria, projeto .zip, salvamento na nuvem e exportação ficam agrupados para recuperação e entrega.' },
                { title: 'Conta', desc: 'Configurações, plano, créditos, modo de cobrança e login ficam separados da produção criativa.' },
              ].map(item => (
                <div key={item.title} className="card-sm" style={{ padding: 16 }}>
                  <p style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-1)' }}>{item.title}</p>
                  <p style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.65, marginTop: 8 }}>{item.desc}</p>
                </div>
              ))}
              <div className="card-sm" style={{ padding: 16, gridColumn: '1 / -1' }}>
                <p className="label">Padrão de produto</p>
                <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7 }}>
                  A navegação segue um modelo de ferramenta profissional: entrada do trabalho, módulos de produção, biblioteca de ativos e área de conta. Isso reduz cliques ambíguos e prepara o app para crescer com dashboard, histórico, planos e admin sem virar um menu confuso.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 20px', borderTop: '1px solid var(--border)',
          background: 'var(--surface-2)', flexShrink: 0,
        }}>
          {activeTab === 'prompts' ? (
            <>
              <button onClick={handleRestoreDefaults} className="btn btn-ghost" style={{ fontSize: 12 }}>
                Restaurar Padrões
              </button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={onClose} className="btn btn-ghost" style={{ fontSize: 12 }}>
                  Cancelar
                </button>
                <button onClick={() => { onSave(current); onClose(); }} className="btn btn-primary" style={{ fontSize: 12 }}>
                  Salvar Prompts
                </button>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
              <button onClick={onClose} className="btn btn-ghost" style={{ fontSize: 12 }}>
                Fechar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
