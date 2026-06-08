import React, { useEffect, useState } from 'react';
import {
  deleteCloudProject,
  getAdminSummary,
  getUsageSummary,
  listCloudProjects,
  listPlans,
  loadCloudProject,
  mockUpgradePlan,
  startCheckout,
  type CloudProjectListItem,
  type CurrentUser,
  type Plan,
} from '../services/saasService';
import type { ProjectState } from '../types';
import { XIcon } from './icons';

interface AccountModalProps {
  isOpen: boolean;
  user: CurrentUser | null;
  onClose: () => void;
  onUserUpdate: (user: CurrentUser) => void;
  onLoadProject: (projectId: string, project: ProjectState) => void;
}

type Tab = 'overview' | 'projects' | 'plans' | 'usage' | 'admin';

const money = (cents: number) =>
  (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtDate = (value: string) =>
  new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

const getBillingModeLabel = (mode?: string | null) => {
  if (mode === 'user_key') return 'API própria salva';
  if (mode === 'user_key_ephemeral') return 'API própria local';
  if (mode === 'platform') return 'API da plataforma';
  return 'Origem não registrada';
};

const AccountModal: React.FC<AccountModalProps> = ({ isOpen, user, onClose, onUserUpdate, onLoadProject }) => {
  const [tab, setTab] = useState<Tab>('overview');
  const [plans, setPlans] = useState<Plan[]>([]);
  const [projects, setProjects] = useState<CloudProjectListItem[]>([]);
  const [usage, setUsage] = useState<any>(null);
  const [admin, setAdmin] = useState<any>(null);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !user) return;
    setMessage('');
    Promise.all([
      listPlans().then(setPlans),
      listCloudProjects().then(setProjects),
      getUsageSummary().then(setUsage),
      user.isAdmin ? getAdminSummary().then(setAdmin) : Promise.resolve(),
    ]).catch(e => setMessage(e instanceof Error ? e.message : 'Falha ao carregar dados da conta.'));
  }, [isOpen, user]);

  if (!isOpen || !user) return null;

  const refreshProjects = async () => {
    setProjects(await listCloudProjects());
  };

  const handleLoadProject = async (projectId: string) => {
    setIsLoading(true);
    try {
      const project = await loadCloudProject(projectId);
      onLoadProject(projectId, project);
      onClose();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Falha ao carregar projeto.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    if (!window.confirm('Excluir este projeto salvo na nuvem?')) return;
    setIsLoading(true);
    try {
      await deleteCloudProject(projectId);
      await refreshProjects();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Falha ao excluir projeto.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpgrade = async (planId: string) => {
    setIsLoading(true);
    setMessage('');
    try {
      const checkout = await startCheckout(planId);
      if (checkout.checkoutUrl) {
        window.location.href = checkout.checkoutUrl;
        return;
      }
      const updated = await mockUpgradePlan(planId);
      onUserUpdate(updated);
      setMessage(checkout.message || 'Plano atualizado em modo de teste local.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Falha ao atualizar plano.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderOverview = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
      {[
        { label: 'Plano', value: user.plan?.name || user.planId, sub: user.aiBillingMode === 'user_key' ? 'API própria' : 'API da plataforma' },
        { label: 'Créditos', value: String(user.creditBalance), sub: 'saldo atual' },
        { label: 'API Key', value: user.hasGeminiApiKey ? 'Configurada' : 'Não salva', sub: user.geminiApiKeyStatus || 'Gemini' },
      ].map(card => (
        <div key={card.label} className="card-sm" style={{ padding: 14 }}>
          <p className="label">{card.label}</p>
          <p style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-1)' }}>{card.value}</p>
          <p style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 4 }}>{card.sub}</p>
        </div>
      ))}
    </div>
  );

  const renderProjects = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {projects.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-4)' }}>Nenhum projeto salvo na nuvem ainda.</p>}
      {projects.map(project => (
        <div key={project.id} className="card-sm" style={{ padding: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{project.name}</p>
            <p style={{ fontSize: 11, color: 'var(--text-4)' }}>Atualizado em {fmtDate(project.updated_at)}</p>
          </div>
          <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={() => handleLoadProject(project.id)} disabled={isLoading}>Abrir</button>
          <button className="btn btn-danger" style={{ fontSize: 12 }} onClick={() => handleDeleteProject(project.id)} disabled={isLoading}>Excluir</button>
        </div>
      ))}
    </div>
  );

  const renderPlans = () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
      {plans.map(plan => {
        const isCurrent = plan.id === user.planId;
        return (
          <div key={plan.id} className={`card${isCurrent ? ' card-active' : ''}`} style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-1)' }}>{plan.name}</p>
            <p style={{ fontSize: 22, fontWeight: 900, color: '#34D399', fontFamily: 'var(--mono)' }}>{money(plan.priceBrl)}</p>
            <p style={{ fontSize: 12, color: 'var(--text-3)' }}>{plan.monthlyCredits.toLocaleString('pt-BR')} créditos/mês</p>
            <p style={{ fontSize: 12, color: 'var(--text-3)' }}>{plan.maxProjects} projetos · {plan.maxScenesPerScript} cenas/roteiro</p>
            <p style={{ fontSize: 12, color: 'var(--text-3)' }}>{plan.allowUserApiKey ? 'Permite API própria' : 'Somente API da plataforma'}</p>
            <button className={isCurrent ? 'btn btn-ghost' : 'btn btn-primary'} disabled={isCurrent || isLoading} onClick={() => handleUpgrade(plan.id)} style={{ justifyContent: 'center', marginTop: 'auto' }}>
              {isCurrent ? 'Plano atual' : 'Selecionar'}
            </button>
          </div>
        );
      })}
    </div>
  );

  const currentApiSource = (() => {
    if (user.aiBillingMode === 'user_key') {
      if (user.hasGeminiApiKey) {
        return {
          label: 'Gemini API própria salva',
          tone: '#38BDF8',
          description: 'As chamadas da conta usam a chave Gemini criptografada salva no servidor.',
        };
      }

      return {
        label: 'API própria pendente',
        tone: '#F59E0B',
        description: 'O modo BYOK está ativo, mas nenhuma chave Gemini foi salva nesta conta.',
      };
    }

    return {
      label: 'Gemini API da plataforma',
      tone: '#34D399',
      description: 'As chamadas usam a chave da plataforma e consomem créditos do seu plano.',
    };
  })();

  const renderUsage = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        <div className="card-sm" style={{ padding: 14 }}>
          <p className="label">API em uso agora</p>
          <p style={{ fontSize: 16, fontWeight: 800, color: currentApiSource.tone, marginTop: 4 }}>{currentApiSource.label}</p>
          <p style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 6, lineHeight: 1.5 }}>{currentApiSource.description}</p>
        </div>
        <div className="card-sm" style={{ padding: 14 }}>
          <p className="label">Chave Gemini salva</p>
          <p style={{ fontSize: 16, fontWeight: 800, color: user.hasGeminiApiKey ? '#34D399' : '#F59E0B', marginTop: 4 }}>
            {user.hasGeminiApiKey ? 'Configurada' : 'Não configurada'}
          </p>
          <p style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 6, lineHeight: 1.5 }}>
            {user.geminiApiKeyLastValidatedAt
              ? `Validada em ${fmtDate(user.geminiApiKeyLastValidatedAt)}`
              : user.geminiApiKeyStatus || 'Configure em Ajustes para usar BYOK na conta.'}
          </p>
        </div>
        <div className="card-sm" style={{ padding: 14 }}>
          <p className="label">Modo de cobrança</p>
          <p style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-1)', marginTop: 4 }}>
            {user.aiBillingMode === 'user_key' ? 'BYOK' : 'Créditos'}
          </p>
          <p style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 6, lineHeight: 1.5 }}>
            {user.aiBillingMode === 'user_key'
              ? 'Você paga o provedor de IA; a plataforma registra apenas o uso.'
              : `${user.creditBalance.toLocaleString('pt-BR')} créditos disponíveis para chamadas da plataforma.`}
          </p>
        </div>
      </div>

      <div className="card-sm" style={{ overflow: 'hidden' }}>
        <div style={{ padding: 12, borderBottom: '1px solid var(--border)' }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2)' }}>Uso por operação</p>
        </div>
        {(usage?.rows || []).length === 0 ? (
          <p style={{ padding: 12, fontSize: 13, color: 'var(--text-4)' }}>Nenhum uso registrado ainda.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <tbody>
              {usage.rows.map((row: any, index: number) => (
                <tr key={`${row.operation}-${row.model}-${index}`} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: 10, color: 'var(--text-1)', fontWeight: 600 }}>{row.operation}</td>
                  <td style={{ padding: 10, color: 'var(--text-3)' }}>{row.model}</td>
                  <td style={{ padding: 10, color: 'var(--text-3)' }}>{getBillingModeLabel(row.billing_mode || row.billingMode)}</td>
                  <td style={{ padding: 10, color: 'var(--text-3)' }}>{row.calls} chamadas</td>
                  <td style={{ padding: 10, color: '#34D399', fontFamily: 'var(--mono)', textAlign: 'right' }}>{Number(row.credit_cost || 0)} créditos</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card-sm" style={{ overflow: 'hidden' }}>
        <div style={{ padding: 12, borderBottom: '1px solid var(--border)' }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2)' }}>Chamadas recentes</p>
        </div>
        {(usage?.recent || []).length === 0 ? (
          <p style={{ padding: 12, fontSize: 13, color: 'var(--text-4)' }}>Nenhuma chamada recente registrada.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <tbody>
              {usage.recent.map((row: any) => (
                <tr key={row.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: 10, color: 'var(--text-1)', fontWeight: 600 }}>{row.operation}</td>
                  <td style={{ padding: 10, color: 'var(--text-3)' }}>{getBillingModeLabel(row.billing_mode || row.billingMode)}</td>
                  <td style={{ padding: 10, color: 'var(--text-3)' }}>{row.model}</td>
                  <td style={{ padding: 10, color: 'var(--text-4)' }}>{fmtDate(row.created_at || row.createdAt)}</td>
                  <td style={{ padding: 10, color: '#34D399', fontFamily: 'var(--mono)', textAlign: 'right' }}>{Number(row.credit_cost || 0)} créditos</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );

  const renderAdmin = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
        {[
          { label: 'Usuários', value: admin?.totals?.users || 0 },
          { label: 'Projetos', value: admin?.totals?.projects || 0 },
          { label: 'Chamadas', value: admin?.totals?.usageCalls || 0 },
          { label: 'Custo IA', value: Number(admin?.totals?.costBrl || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) },
          { label: 'Créditos', value: admin?.totals?.creditsUsed || 0 },
        ].map(card => (
          <div key={card.label} className="card-sm" style={{ padding: 12 }}>
            <p className="label">{card.label}</p>
            <p style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-1)', marginTop: 4 }}>{card.value}</p>
          </div>
        ))}
      </div>

      <div className="card-sm" style={{ overflow: 'hidden' }}>
        <div style={{ padding: 12, borderBottom: '1px solid var(--border)' }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2)' }}>Usuários com maior uso</p>
        </div>
        {(admin?.topUsers || []).length === 0 ? (
          <p style={{ padding: 12, fontSize: 13, color: 'var(--text-4)' }}>Ainda não há usuários com uso registrado.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <tbody>
              {admin.topUsers.map((row: any) => (
                <tr key={row.id} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: 10, color: 'var(--text-1)', fontWeight: 600 }}>{row.email}</td>
                  <td style={{ padding: 10, color: 'var(--text-3)' }}>{row.planId}</td>
                  <td style={{ padding: 10, color: 'var(--text-3)' }}>{row.calls} chamadas</td>
                  <td style={{ padding: 10, color: 'var(--text-3)' }}>{row.creditBalance} saldo</td>
                  <td style={{ padding: 10, color: '#34D399', fontFamily: 'var(--mono)', textAlign: 'right' }}>
                    {Number(row.costBrl || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.72)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div className="card" style={{ width: 'min(980px, 100%)', maxHeight: '86vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: 16, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-1)' }}>Conta e cobrança</p>
            <p style={{ fontSize: 12, color: 'var(--text-4)' }}>{user.email}</p>
          </div>
          <button onClick={onClose} className="icon-btn" title="Fechar"><XIcon width={14} height={14} /></button>
        </div>

        <div style={{ display: 'flex', gap: 4, padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
          {[
            ['overview', 'Resumo'],
            ['projects', 'Projetos'],
            ['plans', 'Planos'],
            ['usage', 'Uso'],
            ...(user.isAdmin ? [['admin', 'Admin']] : []),
          ].map(([id, label]) => (
            <button
              key={id}
              className={`btn ${tab === id ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setTab(id as Tab)}
              style={{ fontSize: 12 }}
            >
              {label}
            </button>
          ))}
        </div>

        <div style={{ padding: 16, overflowY: 'auto' }}>
          {message && <p style={{ fontSize: 12, color: message.includes('Falha') ? 'var(--red)' : '#34D399', marginBottom: 12 }}>{message}</p>}
          {tab === 'overview' && renderOverview()}
          {tab === 'projects' && renderProjects()}
          {tab === 'plans' && renderPlans()}
          {tab === 'usage' && renderUsage()}
          {tab === 'admin' && renderAdmin()}
        </div>
      </div>
    </div>
  );
};

export default AccountModal;
