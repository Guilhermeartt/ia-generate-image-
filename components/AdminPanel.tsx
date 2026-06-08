import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  getAdminSummary,
  listAdminUsers,
  getAdminUserDetail,
  adminGrantCredits,
  adminChangePlan,
  listAdminPayments,
  listStripeEvents,
  listPlans,
  type AdminSummary,
  type AdminUserListItem,
  type AdminUserDetail,
  type AdminPayment,
  type StripeEventRow,
  type Plan,
} from '../services/saasService';

type AdminTab = 'overview' | 'users' | 'payments' | 'webhooks';

interface AdminPanelProps {
  onClose: () => void;
}

const formatBrl = (cents: number): string =>
  (Number(cents || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const formatBrlDirect = (value: number): string =>
  Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const formatNumber = (n: number): string => Number(n || 0).toLocaleString('pt-BR');

const formatDate = (iso: string | null): string => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('pt-BR');
  } catch {
    return iso;
  }
};

const AdminPanel: React.FC<AdminPanelProps> = ({ onClose }) => {
  const [tab, setTab] = useState<AdminTab>('overview');
  const [plans, setPlans] = useState<Plan[]>([]);

  useEffect(() => {
    listPlans().then(setPlans).catch(() => setPlans([]));
  }, []);

  return (
    <div style={styles.root}>
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <strong>Painel administrativo</strong>
          <span style={styles.badge}>admin</span>
        </div>
        <button style={styles.closeBtn} onClick={onClose}>Fechar</button>
      </header>

      <nav style={styles.tabs}>
        {(['overview', 'users', 'payments', 'webhooks'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{ ...styles.tabBtn, ...(tab === t ? styles.tabBtnActive : null) }}
          >
            {t === 'overview' ? 'Visão geral' : t === 'users' ? 'Usuários' : t === 'payments' ? 'Pagamentos' : 'Webhooks'}
          </button>
        ))}
      </nav>

      <main style={styles.main}>
        {tab === 'overview' && <OverviewView />}
        {tab === 'users' && <UsersView plans={plans} />}
        {tab === 'payments' && <PaymentsView />}
        {tab === 'webhooks' && <WebhooksView />}
      </main>
    </div>
  );
};

// ── Tab: Visão geral ─────────────────────────────────────────────────────────
const OverviewView: React.FC = () => {
  const [data, setData] = useState<AdminSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAdminSummary().then(setData).catch((e) => setError(e?.message || 'Erro ao carregar.'));
  }, []);

  if (error) return <div style={styles.error}>{error}</div>;
  if (!data) return <div style={styles.muted}>Carregando…</div>;

  return (
    <div>
      <section style={styles.statRow}>
        <Stat label="Usuários" value={formatNumber(data.totals.users)} />
        <Stat label="Projetos" value={formatNumber(data.totals.projects)} />
        <Stat label="Chamadas IA" value={formatNumber(data.totals.usageCalls)} />
        <Stat label="Custo total" value={formatBrlDirect(data.totals.costBrl)} />
        <Stat label="Créditos usados" value={formatNumber(data.totals.creditsUsed)} />
      </section>

      <section style={styles.section}>
        <h3 style={styles.h3}>Usuários por plano</h3>
        <table style={styles.table}>
          <thead>
            <tr><th>Plano</th><th>Usuários</th></tr>
          </thead>
          <tbody>
            {data.usersByPlan.map((row) => (
              <tr key={row.planId}><td>{row.planId}</td><td>{formatNumber(row.users)}</td></tr>
            ))}
          </tbody>
        </table>
      </section>

      <section style={styles.section}>
        <h3 style={styles.h3}>Top 20 usuários por custo</h3>
        <table style={styles.table}>
          <thead>
            <tr>
              <th>Email</th><th>Plano</th><th>Chamadas</th><th>Custo</th>
              <th>Créditos usados</th><th>Saldo</th><th>Último uso</th>
            </tr>
          </thead>
          <tbody>
            {data.topUsers.map((u) => (
              <tr key={u.id}>
                <td>{u.email}</td>
                <td>{u.planId}</td>
                <td style={styles.num}>{formatNumber(u.calls)}</td>
                <td style={styles.num}>{formatBrlDirect(u.costBrl)}</td>
                <td style={styles.num}>{formatNumber(u.creditsUsed)}</td>
                <td style={styles.num}>{formatNumber(u.creditBalance)}</td>
                <td>{formatDate(u.lastUsageAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section style={styles.section}>
        <h3 style={styles.h3}>Uso recente</h3>
        <table style={styles.table}>
          <thead>
            <tr><th>Quando</th><th>Email</th><th>Operação</th><th>Modelo</th><th>Modo</th><th>Custo</th><th>Créditos</th></tr>
          </thead>
          <tbody>
            {data.recentUsage.map((row, idx) => (
              <tr key={idx}>
                <td>{formatDate(row.createdAt)}</td>
                <td>{row.email || '—'}</td>
                <td>{row.operation}</td>
                <td>{row.model}</td>
                <td>{row.billingMode}</td>
                <td style={styles.num}>{formatBrlDirect(row.costBrl)}</td>
                <td style={styles.num}>{formatNumber(row.creditCost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
};

// ── Tab: Usuários ────────────────────────────────────────────────────────────
const UsersView: React.FC<{ plans: Plan[] }> = ({ plans }) => {
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [page, setPage] = useState(0);
  const limit = 25;
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listAdminUsers({ search, plan: planFilter, limit, offset: page * limit });
      setUsers(res.users);
      setTotal(res.total);
    } catch (e: any) {
      setError(e?.message || 'Erro ao carregar usuários.');
    } finally {
      setLoading(false);
    }
  }, [search, planFilter, page]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div>
      <div style={styles.toolbar}>
        <input
          type="text"
          placeholder="Buscar por email ou nome"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          style={styles.input}
        />
        <select value={planFilter} onChange={(e) => { setPlanFilter(e.target.value); setPage(0); }} style={styles.input}>
          <option value="">Todos os planos</option>
          {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <span style={styles.muted}>{loading ? 'Carregando…' : `${formatNumber(total)} usuários`}</span>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      <table style={styles.table}>
        <thead>
          <tr>
            <th>Email</th><th>Nome</th><th>Plano</th><th>Saldo</th><th>Projetos</th>
            <th>Verificado</th><th>Último uso</th><th>Criado</th><th></th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>{u.email}</td>
              <td>{u.name}</td>
              <td>{u.planId}</td>
              <td style={styles.num}>{formatNumber(u.creditBalance)}</td>
              <td style={styles.num}>{u.projectCount}</td>
              <td>{u.emailVerifiedAt ? '✅' : '⏳'}</td>
              <td>{formatDate(u.lastUsageAt)}</td>
              <td>{formatDate(u.createdAt)}</td>
              <td>
                <button onClick={() => setSelectedUserId(u.id)} style={styles.linkBtn}>Detalhes</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={styles.pagination}>
        <button disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} style={styles.pageBtn}>Anterior</button>
        <span style={styles.muted}>Página {page + 1} de {totalPages}</span>
        <button disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)} style={styles.pageBtn}>Próxima</button>
      </div>

      {selectedUserId && (
        <UserDetailModal
          userId={selectedUserId}
          plans={plans}
          onClose={() => { setSelectedUserId(null); load(); }}
        />
      )}
    </div>
  );
};

// ── User detail modal ───────────────────────────────────────────────────────
const UserDetailModal: React.FC<{ userId: string; plans: Plan[]; onClose: () => void }> = ({ userId, plans, onClose }) => {
  const [data, setData] = useState<AdminUserDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [creditAmount, setCreditAmount] = useState('');
  const [creditReason, setCreditReason] = useState('');
  const [newPlan, setNewPlan] = useState('');

  const reload = useCallback(() => {
    getAdminUserDetail(userId).then(setData).catch((e) => setError(e?.message || 'Erro.'));
  }, [userId]);

  useEffect(() => { reload(); }, [reload]);
  useEffect(() => { if (data?.user.planId) setNewPlan(data.user.planId); }, [data?.user.planId]);

  const handleGrant = async () => {
    const amount = Math.trunc(Number(creditAmount));
    if (!amount) { setError('Quantidade inválida.'); return; }
    setBusy(true); setError(null);
    try {
      await adminGrantCredits(userId, amount, creditReason || undefined);
      setCreditAmount(''); setCreditReason('');
      reload();
    } catch (e: any) {
      setError(e?.message || 'Falha ao conceder créditos.');
    } finally { setBusy(false); }
  };

  const handlePlan = async () => {
    if (!newPlan || newPlan === data?.user.planId) return;
    setBusy(true); setError(null);
    try {
      await adminChangePlan(userId, newPlan);
      reload();
    } catch (e: any) {
      setError(e?.message || 'Falha ao mudar plano.');
    } finally { setBusy(false); }
  };

  return (
    <div style={styles.modalBackdrop} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <header style={styles.modalHeader}>
          <strong>Detalhes do usuário</strong>
          <button style={styles.closeBtn} onClick={onClose}>Fechar</button>
        </header>
        {!data ? <div style={styles.muted}>Carregando…</div> : (
          <div style={styles.modalBody}>
            <section>
              <h3 style={styles.h3}>{data.user.name} · {data.user.email}</h3>
              <p style={styles.muted}>
                {data.user.planId} · saldo {formatNumber(data.user.creditBalance)} créditos · criado {formatDate(data.user.createdAt)}
                {data.user.emailVerified ? ' · email ✅' : ' · email ⏳ não verificado'}
              </p>
            </section>

            <section style={styles.actionBox}>
              <h4 style={styles.h4}>Conceder/debitar créditos</h4>
              <div style={styles.formRow}>
                <input
                  type="number"
                  placeholder="Quantidade (negativo p/ debitar)"
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(e.target.value)}
                  style={styles.input}
                />
                <input
                  type="text"
                  placeholder="Motivo (opcional)"
                  value={creditReason}
                  onChange={(e) => setCreditReason(e.target.value)}
                  style={{ ...styles.input, flex: 1 }}
                />
                <button onClick={handleGrant} disabled={busy} style={styles.primaryBtn}>Aplicar</button>
              </div>
            </section>

            <section style={styles.actionBox}>
              <h4 style={styles.h4}>Mudar plano</h4>
              <div style={styles.formRow}>
                <select value={newPlan} onChange={(e) => setNewPlan(e.target.value)} style={styles.input}>
                  {plans.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.id})</option>)}
                </select>
                <button onClick={handlePlan} disabled={busy || newPlan === data.user.planId} style={styles.primaryBtn}>Mudar</button>
              </div>
            </section>

            {error && <div style={styles.error}>{error}</div>}

            <section style={styles.section}>
              <h4 style={styles.h4}>Histórico de créditos</h4>
              <table style={styles.table}>
                <thead><tr><th>Quando</th><th>Tipo</th><th>Δ</th><th>Saldo</th><th>Descrição</th></tr></thead>
                <tbody>
                  {data.creditHistory.map((c, idx) => (
                    <tr key={idx}>
                      <td>{formatDate(c.createdAt)}</td>
                      <td>{c.type}</td>
                      <td style={{ ...styles.num, color: c.amount >= 0 ? '#2da44e' : '#d1242f' }}>
                        {c.amount > 0 ? `+${formatNumber(c.amount)}` : formatNumber(c.amount)}
                      </td>
                      <td style={styles.num}>{formatNumber(c.balanceAfter)}</td>
                      <td>{c.description || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section style={styles.section}>
              <h4 style={styles.h4}>Pagamentos</h4>
              {data.payments.length === 0 ? <div style={styles.muted}>Sem pagamentos.</div> : (
                <table style={styles.table}>
                  <thead><tr><th>Quando</th><th>Provider</th><th>Valor</th><th>Status</th><th>Recibo</th></tr></thead>
                  <tbody>
                    {data.payments.map((p) => (
                      <tr key={p.id}>
                        <td>{formatDate(p.createdAt)}</td>
                        <td>{p.provider}</td>
                        <td style={styles.num}>{formatBrl(p.amountBrl)}</td>
                        <td>{p.status}</td>
                        <td>{p.receiptUrl ? <a href={p.receiptUrl} target="_blank" rel="noopener noreferrer">Abrir</a> : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            <section style={styles.section}>
              <h4 style={styles.h4}>Uso recente</h4>
              <table style={styles.table}>
                <thead><tr><th>Quando</th><th>Operação</th><th>Modelo</th><th>Custo</th><th>Créditos</th></tr></thead>
                <tbody>
                  {data.recentUsage.map((u, idx) => (
                    <tr key={idx}>
                      <td>{formatDate(u.createdAt)}</td>
                      <td>{u.operation}</td>
                      <td>{u.model}</td>
                      <td style={styles.num}>{formatBrlDirect(u.costBrl)}</td>
                      <td style={styles.num}>{formatNumber(u.creditCost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Tab: Pagamentos ──────────────────────────────────────────────────────────
const PaymentsView: React.FC = () => {
  const [page, setPage] = useState(0);
  const limit = 50;
  const [data, setData] = useState<{ payments: AdminPayment[]; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listAdminPayments({ limit, offset: page * limit })
      .then((r) => setData({ payments: r.payments, total: r.total }))
      .catch((e) => setError(e?.message || 'Erro.'));
  }, [page]);

  const totalPages = Math.max(1, Math.ceil((data?.total || 0) / limit));

  return (
    <div>
      {error && <div style={styles.error}>{error}</div>}
      {!data ? <div style={styles.muted}>Carregando…</div> : (
        <>
          <p style={styles.muted}>{formatNumber(data.total)} pagamentos registrados</p>
          <table style={styles.table}>
            <thead>
              <tr><th>Quando</th><th>Email</th><th>Provider</th><th>Valor</th><th>Status</th><th>Recibo</th><th>Invoice</th></tr>
            </thead>
            <tbody>
              {data.payments.map((p) => (
                <tr key={p.id}>
                  <td>{formatDate(p.createdAt)}</td>
                  <td>{p.userEmail || '—'}</td>
                  <td>{p.provider}</td>
                  <td style={styles.num}>{formatBrl(p.amountBrl)}</td>
                  <td>{p.status}</td>
                  <td>{p.receiptUrl ? <a href={p.receiptUrl} target="_blank" rel="noopener noreferrer">Abrir</a> : '—'}</td>
                  <td>{p.stripeInvoiceId || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={styles.pagination}>
            <button disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} style={styles.pageBtn}>Anterior</button>
            <span style={styles.muted}>Página {page + 1} de {totalPages}</span>
            <button disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)} style={styles.pageBtn}>Próxima</button>
          </div>
        </>
      )}
    </div>
  );
};

// ── Tab: Webhooks ────────────────────────────────────────────────────────────
const WebhooksView: React.FC = () => {
  const [onlyFailed, setOnlyFailed] = useState(false);
  const [events, setEvents] = useState<StripeEventRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listStripeEvents(onlyFailed, 100)
      .then((r) => setEvents(r.events))
      .catch((e) => setError(e?.message || 'Erro.'));
  }, [onlyFailed]);

  return (
    <div>
      <div style={styles.toolbar}>
        <label style={styles.muted}>
          <input type="checkbox" checked={onlyFailed} onChange={(e) => setOnlyFailed(e.target.checked)} />{' '}
          Só falhas
        </label>
      </div>
      {error && <div style={styles.error}>{error}</div>}
      <table style={styles.table}>
        <thead>
          <tr><th>Recebido</th><th>Tipo</th><th>Processado</th><th>Erro</th><th>ID</th></tr>
        </thead>
        <tbody>
          {events.length === 0 ? (
            <tr><td colSpan={5} style={styles.muted}>Nenhum evento ainda.</td></tr>
          ) : events.map((e) => (
            <tr key={e.id}>
              <td>{formatDate(e.receivedAt)}</td>
              <td>{e.type}</td>
              <td>{e.processedAt ? formatDate(e.processedAt) : <span style={{ color: '#bd8b00' }}>pendente</span>}</td>
              <td style={{ color: e.error ? '#d1242f' : undefined }}>{e.error || '—'}</td>
              <td style={styles.monospace}>{e.id}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ── Componentes pequenos ────────────────────────────────────────────────────
const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={styles.stat}>
    <div style={styles.statLabel}>{label}</div>
    <div style={styles.statValue}>{value}</div>
  </div>
);

// ── Estilos inline (mantém o componente isolado do design system existente) ─
const styles: Record<string, React.CSSProperties> = {
  root: {
    position: 'fixed', inset: 0, background: 'var(--bg-primary, #0d1117)', color: 'var(--text-primary, #e6edf3)',
    zIndex: 1000, display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, sans-serif',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '16px 24px', borderBottom: '1px solid var(--border-color, #30363d)',
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 12 },
  badge: {
    background: '#bf3989', color: 'white', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600,
  },
  closeBtn: {
    background: 'transparent', color: 'inherit', border: '1px solid var(--border-color, #30363d)',
    padding: '6px 12px', borderRadius: 6, cursor: 'pointer',
  },
  tabs: { display: 'flex', gap: 4, padding: '8px 24px', borderBottom: '1px solid var(--border-color, #30363d)' },
  tabBtn: {
    padding: '8px 16px', background: 'transparent', color: 'inherit', border: 'none',
    borderRadius: 6, cursor: 'pointer', fontSize: 14,
  },
  tabBtnActive: { background: 'var(--bg-tertiary, #21262d)', fontWeight: 600 },
  main: { flex: 1, overflow: 'auto', padding: 24 },
  statRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 },
  stat: { background: 'var(--bg-secondary, #161b22)', padding: 16, borderRadius: 8, border: '1px solid var(--border-color, #30363d)' },
  statLabel: { fontSize: 12, textTransform: 'uppercase', opacity: 0.7, marginBottom: 4 },
  statValue: { fontSize: 22, fontWeight: 600 },
  section: { marginTop: 24 },
  h3: { fontSize: 16, marginBottom: 8 },
  h4: { fontSize: 14, marginBottom: 8 },
  table: {
    width: '100%', borderCollapse: 'collapse', fontSize: 13,
    background: 'var(--bg-secondary, #161b22)', borderRadius: 8, overflow: 'hidden',
  },
  num: { textAlign: 'right', fontVariantNumeric: 'tabular-nums' },
  toolbar: { display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 },
  input: {
    padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border-color, #30363d)',
    background: 'var(--bg-secondary, #161b22)', color: 'inherit', fontSize: 13,
  },
  pagination: { display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  pageBtn: {
    padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border-color, #30363d)',
    background: 'transparent', color: 'inherit', cursor: 'pointer',
  },
  linkBtn: {
    background: 'transparent', border: 'none', color: '#2f81f7', cursor: 'pointer', textDecoration: 'underline',
  },
  primaryBtn: {
    background: '#2da44e', color: 'white', border: 'none', padding: '6px 16px', borderRadius: 6, cursor: 'pointer',
  },
  muted: { opacity: 0.7, fontSize: 13 },
  error: { padding: 8, background: '#d1242f22', border: '1px solid #d1242f', borderRadius: 6, color: '#ff7b72', marginBottom: 12 },
  modalBackdrop: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1100,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  modal: {
    background: 'var(--bg-primary, #0d1117)', borderRadius: 8, width: '100%', maxWidth: 900,
    maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
    border: '1px solid var(--border-color, #30363d)',
  },
  modalHeader: { display: 'flex', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border-color, #30363d)' },
  modalBody: { padding: 16, overflow: 'auto' },
  actionBox: { background: 'var(--bg-secondary, #161b22)', padding: 12, borderRadius: 6, marginTop: 12 },
  formRow: { display: 'flex', gap: 8, alignItems: 'center' },
  monospace: { fontFamily: 'monospace', fontSize: 11, opacity: 0.7 },
};

export default AdminPanel;
