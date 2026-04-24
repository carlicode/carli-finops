import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

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
}

const COLORS = ['#6366f1', '#f97316', '#22c55e', '#a855f7', '#3b82f6', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6', '#64748b'];

export default function Stats({ expenses }: Props) {
  if (expenses.length === 0) return null;

  const crcExpenses = expenses.filter((e) => e.currency === 'CRC');
  const usdExpenses = expenses.filter((e) => e.currency === 'USD');
  const totalCRC = crcExpenses.reduce((s, e) => s + e.amount, 0);
  const totalUSD = usdExpenses.reduce((s, e) => s + e.amount, 0);

  // Group by category
  const byCategory: Record<string, number> = {};
  for (const e of crcExpenses) {
    byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
  }
  const categoryData = Object.entries(byCategory)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // Group by payment method
  const byPayment: Record<string, number> = {};
  for (const e of expenses) {
    byPayment[e.paymentMethod] = (byPayment[e.paymentMethod] || 0) + 1;
  }
  const paymentData = Object.entries(byPayment)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  return (
    <div style={s.root}>
      {/* Totals */}
      <div style={s.totals}>
        <div style={s.statCard}>
          <p style={s.statLabel}>Total gastos</p>
          <p style={s.statValue}>{expenses.length}</p>
        </div>
        {totalCRC > 0 && (
          <div style={s.statCard}>
            <p style={s.statLabel}>Total CRC</p>
            <p style={s.statValue}>₡{totalCRC.toLocaleString('es-CR')}</p>
          </div>
        )}
        {totalUSD > 0 && (
          <div style={s.statCard}>
            <p style={s.statLabel}>Total USD</p>
            <p style={s.statValue}>${totalUSD.toFixed(2)}</p>
          </div>
        )}
        <div style={s.statCard}>
          <p style={s.statLabel}>Promedio por gasto</p>
          <p style={s.statValue}>
            {totalCRC > 0 ? `₡${(totalCRC / (crcExpenses.length || 1)).toLocaleString('es-CR', { maximumFractionDigits: 0 })}` : '-'}
          </p>
        </div>
      </div>

      <div style={s.charts}>
        {/* Pie chart by category */}
        {categoryData.length > 0 && (
          <div style={s.chartBox}>
            <p style={s.chartTitle}>Por categoría</p>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={categoryData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                >
                  {categoryData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: number) => `₡${v.toLocaleString('es-CR')}`}
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#f1f5f9', fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div style={s.legend}>
              {categoryData.slice(0, 5).map((d, i) => (
                <div key={d.name} style={s.legendItem}>
                  <span style={{ ...s.legendDot, background: COLORS[i % COLORS.length] }} />
                  <span style={s.legendLabel}>{d.name}</span>
                  <span style={s.legendValue}>₡{d.value.toLocaleString('es-CR')}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bar chart by payment method */}
        {paymentData.length > 0 && (
          <div style={s.chartBox}>
            <p style={s.chartTitle}>Método de pago</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={paymentData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, color: '#f1f5f9', fontSize: 12 }}
                  formatter={(v: number) => [`${v} gastos`, 'Cantidad']}
                />
                <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  totals: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: 12,
  },
  statCard: {
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: 12,
    padding: '16px 18px',
  },
  statLabel: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 6,
    fontWeight: 500,
  },
  statValue: {
    fontSize: 22,
    fontWeight: 700,
    color: '#f1f5f9',
  },
  charts: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: 16,
  },
  chartBox: {
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: 12,
    padding: '20px 16px',
  },
  chartTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: '#94a3b8',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  legend: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    marginTop: 12,
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    flexShrink: 0,
  },
  legendLabel: {
    fontSize: 12,
    color: '#94a3b8',
    flex: 1,
  },
  legendValue: {
    fontSize: 12,
    fontWeight: 600,
    color: '#f1f5f9',
  },
};
