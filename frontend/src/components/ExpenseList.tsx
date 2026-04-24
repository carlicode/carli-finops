import { generateClient } from 'aws-amplify/api';
import { formatMoney } from '../currency';
import { t } from '../theme';

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
  flow?: string;
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
  'Salario / Trabajo': '#4ade80',
  'Redes sociales (TikTok, etc.)': '#f472b6',
  'Freelance': '#38bdf8',
  'Inversiones / intereses': '#a3e635',
  'Regalos': '#fbbf24',
  'Otros ingresos': '#c084fc',
  'Otros': '#9d4a6c',
};

export default function ExpenseList({ expenses, onDeleted }: Props) {
  if (expenses.length === 0) {
    return (
      <div style={s.empty}>
        <p style={s.emptyText}>No hay movimientos este mes.</p>
        <p style={s.emptyHint}>Usa el bot de Telegram o «+ Nuevo movimiento».</p>
      </div>
    );
  }

  const handleDelete = async (expenseId: string) => {
    if (!confirm('¿Eliminar este registro?')) return;
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
      {sorted.map((exp) => {
        const isIncome = (exp.flow || 'EXPENSE') === 'INCOME';
        return (
          <div key={exp.expenseId} style={s.item}>
            <div style={{ ...s.dot, background: CATEGORY_COLORS[exp.category] || t.accent }} />
            <div style={s.info}>
              <p style={s.desc}>{exp.description}</p>
              <p style={s.meta}>
                <span style={{ color: isIncome ? t.income : t.expense, fontWeight: 600, marginRight: 6 }}>
                  {isIncome ? 'Ingreso' : 'Gasto'}
                </span>
                {exp.category} · {exp.paymentMethod} ·{' '}
                <span style={s.date}>{formatDate(exp.createdAt)}</span>
              </p>
            </div>
            <div style={s.right}>
              <p style={{ ...s.amount, color: isIncome ? t.income : t.text }}>
                {isIncome ? '+' : '−'}
                {formatMoney(exp.amount, exp.currency)}
              </p>
              <button type="button" style={s.deleteBtn} onClick={() => handleDelete(exp.expenseId)} title="Eliminar">
                ✕
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('es-BO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
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
    background: t.bgElevated,
    border: `1px solid ${t.border}`,
    borderRadius: 8,
    marginBottom: 6,
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
    color: t.text,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  meta: {
    fontSize: 12,
    color: t.textSubtle,
    marginTop: 2,
  },
  date: {
    color: t.textSubtle,
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
  },
  deleteBtn: {
    background: 'none',
    border: 'none',
    color: t.textSubtle,
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
    color: t.textMuted,
    marginBottom: 6,
  },
  emptyHint: {
    fontSize: 13,
    color: t.textSubtle,
  },
};
