import React, { useState } from 'react';
import { loginAccount, registerAccount, requestPasswordReset, resetPassword, type CurrentUser } from '../services/saasService';
import { XIcon } from './icons';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthenticated: (user: CurrentUser) => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onAuthenticated }) => {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot' | 'reset'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [devResetToken, setDevResetToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      if (mode === 'forgot') {
        const payload = await requestPasswordReset(email);
        setResetMessage(payload.message);
        setDevResetToken(payload.resetToken || '');
        if (payload.resetToken) setResetToken(payload.resetToken);
        setMode('reset');
        return;
      }

      if (mode === 'reset') {
        const user = await resetPassword(resetToken, password);
        onAuthenticated(user);
        onClose();
        return;
      }

      const user = mode === 'login'
        ? await loginAccount(email, password)
        : await registerAccount(name, email, password);
      onAuthenticated(user);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao autenticar.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.72)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <form onSubmit={handleSubmit} className="card" style={{
        width: '100%', maxWidth: 420, padding: 20,
        display: 'flex', flexDirection: 'column', gap: 14,
        boxShadow: '0 24px 80px rgba(0,0,0,0.45)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <p style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-1)' }}>
              {mode === 'login' && 'Entrar na conta'}
              {mode === 'register' && 'Criar conta'}
              {mode === 'forgot' && 'Recuperar senha'}
              {mode === 'reset' && 'Redefinir senha'}
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 2 }}>
              {mode === 'forgot' || mode === 'reset'
                ? 'Use um token temporário para criar uma nova senha.'
                : 'Salve projetos, controle créditos e use sua API key com segurança.'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="icon-btn" title="Fechar">
            <XIcon width={14} height={14} />
          </button>
        </div>

        <div style={{ display: 'flex', gap: 4, padding: 3, borderRadius: 8, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
          <button
            type="button"
            onClick={() => { setMode('login'); setError(''); }}
            style={{
              flex: 1, padding: '7px 8px', borderRadius: 6, border: 'none',
              cursor: 'pointer', background: mode === 'login' ? 'var(--surface)' : 'transparent',
              color: mode === 'login' ? 'var(--text-1)' : 'var(--text-3)', fontWeight: 600,
            }}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => { setMode('register'); setError(''); }}
            style={{
              flex: 1, padding: '7px 8px', borderRadius: 6, border: 'none',
              cursor: 'pointer', background: mode === 'register' ? 'var(--surface)' : 'transparent',
              color: mode === 'register' ? 'var(--text-1)' : 'var(--text-3)', fontWeight: 600,
            }}
          >
            Cadastro
          </button>
        </div>

        {mode === 'register' && (
          <div>
            <label className="label">Nome</label>
            <input value={name} onChange={e => setName(e.target.value)} className="field" autoComplete="name" />
          </div>
        )}

        {mode !== 'reset' && (
        <div>
          <label className="label">E-mail</label>
          <input value={email} onChange={e => setEmail(e.target.value)} className="field" type="email" autoComplete="email" />
        </div>
        )}

        {mode === 'reset' && (
          <div>
            <label className="label">Token de recuperação</label>
            <input value={resetToken} onChange={e => setResetToken(e.target.value)} className="field" autoComplete="one-time-code" />
          </div>
        )}

        {mode !== 'forgot' && (
        <div>
          <label className="label">Senha</label>
          <input value={password} onChange={e => setPassword(e.target.value)} className="field" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
        </div>
        )}

        {resetMessage && (
          <div className="status-strip info" style={{ fontSize: 12, lineHeight: 1.5 }}>
            {resetMessage}
          </div>
        )}

        {devResetToken && mode === 'reset' && (
          <div style={{
            padding: 12, borderRadius: 8, border: '1px solid var(--indigo-b)',
            background: 'var(--indigo-s)', display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)' }}>Token local de recuperação</p>
            <code style={{ fontSize: 11, color: 'var(--text-2)', wordBreak: 'break-all', fontFamily: 'var(--mono)' }}>{devResetToken}</code>
            <p style={{ fontSize: 11, color: 'var(--text-3)', lineHeight: 1.5 }}>
              Em produção, este token deve ser enviado por e-mail. No ambiente local ele aparece aqui para concluir o teste.
            </p>
          </div>
        )}

        {error && (
          <p style={{ fontSize: 12, color: 'var(--red)', lineHeight: 1.5 }}>{error}</p>
        )}

        <button type="submit" disabled={isLoading} className="btn btn-primary" style={{ justifyContent: 'center', padding: '10px 14px' }}>
          {isLoading && 'Aguarde...'}
          {!isLoading && mode === 'login' && 'Entrar'}
          {!isLoading && mode === 'register' && 'Criar conta'}
          {!isLoading && mode === 'forgot' && 'Gerar token de recuperação'}
          {!isLoading && mode === 'reset' && 'Redefinir senha'}
        </button>

        {mode === 'login' && (
          <button type="button" className="btn btn-ghost" style={{ justifyContent: 'center' }} onClick={() => { setMode('forgot'); setError(''); }}>
            Esqueci minha senha
          </button>
        )}
        {(mode === 'forgot' || mode === 'reset') && (
          <button type="button" className="btn btn-ghost" style={{ justifyContent: 'center' }} onClick={() => { setMode('login'); setError(''); }}>
            Voltar para login
          </button>
        )}
      </form>
    </div>
  );
};

export default AuthModal;
