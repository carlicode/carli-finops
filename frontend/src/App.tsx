import { useState, useEffect } from 'react';
import { getCurrentUser } from 'aws-amplify/auth';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import { t } from './theme';

export default function App() {
  const [user, setUser] = useState<{ username: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCurrentUser()
      .then((u) => setUser({ username: u.username }))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={styles.loading}>
        <div style={styles.spinner} />
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={(username) => setUser({ username })} />;
  }

  return <Dashboard username={user.username} onLogout={() => setUser(null)} />;
}

const styles = {
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    background: t.bg,
  } as React.CSSProperties,
  spinner: {
    width: 40,
    height: 40,
    border: `3px solid ${t.border}`,
    borderTop: `3px solid ${t.accent}`,
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  } as React.CSSProperties,
};
