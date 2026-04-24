import { generateClient } from 'aws-amplify/api';

const client = generateClient();

const DELETE_EXPENSE = `
  mutation DeleteExpense($input: DeleteExpenseInput!) {
    deleteExpense(input: $input)
  }
`;

interface Expense {
  expenseId: string;
  description: string;
  category: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  createdAt: string;
}

interface Props {
  expenses: Expense[];
  onDeleted: () => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  'Comida & Restaurantes': '#f97316',
  'Supermercado': '#22c55e',
  'Transporte': '#3b82f6',
  'Entretenimiento': '#a855f7',
  'Salud': '#ef4444',
  'Servicios (luz, agua, etc.)': '#f59e0b',
  'Ropa & Personal': '#ec4899',
  'Suscripciones': '#14b8a6',
  'Viajes': '#6366f1',
  'Otros': '#64748b',
};

export default function ExpenseList({ expenses, onDeleted }: Props) {
  if (expenses.length === 0) {
    return (
      <div style={s.empty}>
        <p style={s.emptyText}>No hay gastos este mes.</p>
        <p style={s.emptyHint}>Usa el bot de Telegram o el botón "+ Nuevo gasto".</p>
      </div>
    );
  }

  const handleDelete = async (expenseId: string) => {
    if (!confirm('¿Eliminar este gasto?')) return;
    try {
      await client.graphql({
        query: DELETE_EXPENSE,
        variables: { input: { expenseId } },
      });
      onDeleted();
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const sorted = [...expenses].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <div style={s.list}>
      {sorted.map((exp) => (
        <div key={exp.expenseId} style={s.item}>
          <div style={{ ...s.dot, background: CATEGORY_COLORS[exp.category] || '#64748b' }} />
          <div style={s.info}>
            <p style={s.desc}>{exp.description}</p>
            <p style={s.meta}>
              {exp.category} · {exp.paymentMethod} ·{' '}
              <span style={s.date}>{formatDate(exp.createdAt)}</span>
            </p>
          </div>
          <div style={s.right}>
            <p style={s.amount}>{formatAmount(exp.amount, exp.currency)}</p>
            <button style={s.deleteBtn} onClick={() => handleDelete(exp.expenseId)} title="Eliminar">
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function formatAmount(amount: number, currency: string): string {
  if (currency === 'USD') return `$${amount.toLocaleString('es-CR', { minimumFractionDigits: 2 })}`;
  return `₡${amount.toLocaleString('es-CR', { minimumFractionDigits: 0 })}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('es-CR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

const s: Record<string, React.CSSProperties> = {
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 16px',
    background: '#1e293b',
    borderBottom: '1px solid #1e293b',
    borderRadius: 8,
    marginBottom: 4,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    flexShrink: 0,
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  desc: {
    fontSize: 14,
    fontWeight: 500,
    color: '#f1f5f9',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  meta: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  date: {
    color: '#475569',
  },
  right: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  amount: {
    fontSize: 15,
    fontWeight: 700,
    color: '#a5b4fc',
  },
  deleteBtn: {
    background: 'none',
    border: 'none',
    color: '#475569',
    cursor: 'pointer',
    fontSize: 14,
    padding: 2,
  },
  empty: {
    padding: '48px 24px',
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: '#64748b',
    marginBottom: 6,
  },
  emptyHint: {
    fontSize: 13,
    color: '#475569',
  },
};
