import { useState, useEffect, useCallback } from 'react';
import { signOut } from 'aws-amplify/auth';
import { generateClient } from 'aws-amplify/api';
import ExpenseForm from '../components/ExpenseForm';
import ExpenseList from '../components/ExpenseList';
import Stats from '../components/Stats';
import { t } from '../theme';

const client = generateClient();

const LIST_EXPENSES = `
  query ListExpenses($month: String) {
    listExpenses(month: $month) {
      items {
        userId
        expenseId
        description
        category
        amount
        currency
        paymentMethod
        flow
        createdAt
        month
      }
      total
    }
  }
`;

const ON_CREATE_EXPENSE = `
  subscription OnCreateExpense {
    onCreateExpense {
      userId
      expenseId
      description
      category
      amount
      currency
      paymentMethod
      flow
      createdAt
      month
    }
  }
`;

interface Expense {
  expenseId: string;
  description: string;
  category: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  flow?: string;
  createdAt: string;
  month: string;
}

interface Props {
  username: string;
  onLogout: () => void;
}

function getCurrentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function formatMonthLabel(ym: string): string {
  const [year, month] = ym.split('-');
  const d = new Date(parseInt(year), parseInt(month) - 1, 1);
  return d.toLocaleDateString('es-BO', { month: 'long', year: 'numeric' });
}

export default function Dashboard({ username, onLogout }: Props) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'list' | 'stats'>('list');
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchExpenses = useCallback(async () => {
    try {
      const result = await client.graphql({
        query: LIST_EXPENSES,
        variables: { month: selectedMonth },
      }) as { data: { listExpenses: { items: Expense[] } } };
      setExpenses(result.data.listExpenses.items || []);
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    setLoading(true);
    fetchExpenses();
  }, [fetchExpenses, selectedMonth]);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const observable = client.graphql({ query: ON_CREATE_EXPENSE }) as any;
    const sub = observable.subscribe({
      next: ({ data }: { data: { onCreateExpense: Expense } }) => {
        const expense = data.onCreateExpense;
        if (expense.month === selectedMonth) {
          setExpenses((prev) => {
            const exists = prev.some((e) => e.expenseId === expense.expenseId);
            if (exists) return prev;
            return [expense, ...prev];
          });
          setLastRefresh(new Date());
        }
      },
      error: (err: unknown) => console.warn('Subscription error:', err),
    });
    return () => sub.unsubscribe();
  }, [selectedMonth]);

  const handleLogout = async () => {
    await signOut();
    onLogout();
  };

  const months: string[] = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    months.push(d.toISOString().slice(0, 7));
  }

  return (
    <div style={s.root}>
      <aside style={s.sidebar}>
        <div style={s.logo}>
          <span style={s.logoIcon}>Bs</span>
          <span style={s.logoText}>FinOps</span>
        </div>

        <nav style={s.nav}>
          <button
            type="button"
            style={{ ...s.navItem, ...(tab === 'list' ? s.navActive : {}) }}
            onClick={() => setTab('list')}
          >
            Movimientos
          </button>
          <button
            type="button"
            style={{ ...s.navItem, ...(tab === 'stats' ? s.navActive : {}) }}
            onClick={() => setTab('stats')}
          >
            Resumen
          </button>
        </nav>

        <div style={s.monthPicker}>
          <p style={s.monthLabel}>Mes</p>
          {months.map((m) => (
            <button
              type="button"
              key={m}
              style={{ ...s.monthBtn, ...(selectedMonth === m ? s.monthActive : {}) }}
              onClick={() => setSelectedMonth(m)}
            >
              {formatMonthLabel(m)}
            </button>
          ))}
        </div>

        <div style={s.sidebarBottom}>
          <p style={s.userLabel}>{username}</p>
          <button type="button" style={s.logoutBtn} onClick={handleLogout}>
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main style={s.main}>
        <div style={s.topBar}>
          <div>
            <h1 style={s.pageTitle}>{formatMonthLabel(selectedMonth)}</h1>
            <p style={s.subtitle}>
              Actualizado {lastRefresh.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}
              <span style={s.liveDot} title="Tiempo real" />
            </p>
          </div>
          <ExpenseForm onCreated={() => fetchExpenses()} />
        </div>

        {loading ? (
          <div style={s.center}>
            <div style={s.spinner} />
          </div>
        ) : (
          <>
            {tab === 'list' && (
              <ExpenseList
                expenses={expenses}
                onDeleted={() => fetchExpenses()}
                onEdited={() => fetchExpenses()}
              />
            )}
            {tab === 'stats' && <Stats expenses={expenses} />}
          </>
        )}
      </main>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    height: '100vh',
    background: t.bg,
    color: t.text,
    overflow: 'hidden',
  },
  sidebar: {
    width: 220,
    background: t.bgElevated,
    borderRight: `1px solid ${t.border}`,
    display: 'flex',
    flexDirection: 'column',
    padding: '24px 16px',
    flexShrink: 0,
    overflowY: 'auto',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 32,
    paddingLeft: 4,
  },
  logoIcon: {
    width: 32,
    height: 32,
    background: t.accentSoft,
    border: `1px solid ${t.accentBorder}`,
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    fontWeight: 700,
    color: t.accentHover,
  },
  logoText: {
    fontSize: 16,
    fontWeight: 700,
    color: t.text,
  },
  nav: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    marginBottom: 28,
  },
  navItem: {
    padding: '9px 12px',
    background: 'none',
    border: 'none',
    borderRadius: 8,
    color: t.textSubtle,
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    textAlign: 'left',
  },
  navActive: {
    background: t.inputBg,
    color: t.accentHover,
  },
  monthPicker: {
    flex: 1,
  },
  monthLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: t.textSubtle,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    marginBottom: 8,
    paddingLeft: 4,
  },
  monthBtn: {
    display: 'block',
    width: '100%',
    padding: '7px 12px',
    background: 'none',
    border: 'none',
    borderRadius: 6,
    color: t.textSubtle,
    fontSize: 13,
    cursor: 'pointer',
    textAlign: 'left',
    marginBottom: 2,
  },
  monthActive: {
    background: t.inputBg,
    color: t.text,
  },
  sidebarBottom: {
    marginTop: 24,
    paddingTop: 16,
    borderTop: `1px solid ${t.border}`,
  },
  userLabel: {
    fontSize: 13,
    color: t.textMuted,
    marginBottom: 10,
    paddingLeft: 4,
  },
  logoutBtn: {
    background: 'none',
    border: `1px solid ${t.border}`,
    borderRadius: 6,
    color: t.textSubtle,
    fontSize: 12,
    padding: '6px 12px',
    cursor: 'pointer',
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    padding: '28px 32px',
    overflowY: 'auto',
    gap: 20,
  },
  topBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: 700,
    color: t.text,
    textTransform: 'capitalize',
  },
  subtitle: {
    fontSize: 13,
    color: t.textSubtle,
    marginTop: 4,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  liveDot: {
    display: 'inline-block',
    width: 6,
    height: 6,
    background: t.income,
    borderRadius: '50%',
  },
  center: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  spinner: {
    width: 32,
    height: 32,
    border: `3px solid ${t.border}`,
    borderTop: `3px solid ${t.accent}`,
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
};
