import { useState } from 'react';
import { signIn } from 'aws-amplify/auth';

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
          <span style={s.logoIcon}>₡</span>
        </div>
        <h1 style={s.title}>Carli FinOps</h1>
        <p style={s.subtitle}>Control de gastos personales</p>

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
              placeholder="••••••••"
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
    background: '#0f172a',
    padding: 24,
  },
  card: {
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: 16,
    padding: '40px 36px',
    width: '100%',
    maxWidth: 380,
    textAlign: 'center',
  },
  logo: {
    width: 64,
    height: 64,
    background: '#312e81',
    borderRadius: 16,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 20px',
  },
  logoIcon: {
    fontSize: 28,
    color: '#a5b4fc',
    fontWeight: 700,
  },
  title: {
    fontSize: 24,
    fontWeight: 700,
    color: '#f1f5f9',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
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
    color: '#94a3b8',
  },
  input: {
    padding: '10px 14px',
    background: '#0f172a',
    border: '1px solid #334155',
    borderRadius: 8,
    color: '#f1f5f9',
    fontSize: 15,
    outline: 'none',
  },
  error: {
    color: '#f87171',
    fontSize: 13,
    textAlign: 'center',
  },
  btn: {
    padding: '12px',
    background: '#4f46e5',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: 8,
  },
};
