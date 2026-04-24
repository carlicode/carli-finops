import { useState } from 'react';
import { signIn } from 'aws-amplify/auth';
import { t } from '../theme';

interface Props {
  onLogin: (username: string) => void;
}

export default function Login({ onLogin }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await signIn({ username, password });
      if (result.isSignedIn) {
        onLogin(username);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al iniciar sesión';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={s.root}>
      <div style={s.card}>
        <div style={s.logo}>
          <span style={s.logoIcon}>Bs</span>
        </div>
        <h1 style={s.title}>Carli FinOps</h1>
        <p style={s.subtitle}>Gastos e ingresos (BOB / USD)</p>

        <form onSubmit={handleSubmit} style={s.form}>
          <div style={s.field}>
            <label style={s.label}>Usuario</label>
            <input
              style={s.input}
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="carli"
              required
              autoFocus
            />
          </div>
          <div style={s.field}>
            <label style={s.label}>Contraseña</label>
            <input
              style={s.input}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && <p style={s.error}>{error}</p>}

          <button style={{ ...s.btn, opacity: loading ? 0.7 : 1 }} type="submit" disabled={loading}>
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  root: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: t.bg,
    padding: 24,
  },
  card: {
    background: t.bgElevated,
    border: `1px solid ${t.border}`,
    borderRadius: 16,
    padding: '40px 36px',
    width: '100%',
    maxWidth: 380,
    textAlign: 'center',
  },
  logo: {
    width: 64,
    height: 64,
    background: t.accentSoft,
    border: `1px solid ${t.accentBorder}`,
    borderRadius: 16,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 20px',
  },
  logoIcon: {
    fontSize: 18,
    fontWeight: 800,
    color: t.accent,
  },
  title: {
    fontSize: 24,
    fontWeight: 700,
    color: t.text,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: t.textMuted,
    marginBottom: 32,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    textAlign: 'left',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: 500,
    color: t.textMuted,
  },
  input: {
    padding: '10px 14px',
    background: t.inputBg,
    border: `1px solid ${t.border}`,
    borderRadius: 8,
    color: t.text,
    fontSize: 15,
    outline: 'none',
  },
  error: {
    color: '#fb7185',
    fontSize: 13,
    textAlign: 'center',
  },
  btn: {
    padding: '12px',
    background: t.accent,
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: 8,
  },
};
