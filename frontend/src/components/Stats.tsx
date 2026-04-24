import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { formatMoney } from '../currency';
import { t } from '../theme';

interface Item {
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
  expenses: Item[];
}

const PINK_SCALE = ['#ec4899', '#f472b6', '#fb7185', '#f9a8d4', '#fda4af', '#e879f9', '#a78bfa', '#c084fc'];

function isIncome(item: Item): boolean {
  return (item.flow || 'EXPENSE') === 'INCOME';
}

function normCur(c: string): string {
  const u = (c || 'BOB').toUpperCase();
  if (u === 'USD') return 'USD';
  return 'BOB';
}

function sumBy(items: Item[], cur: 'BOB' | 'USD', kind: 'in' | 'out'): number {
  return items
    .filter((e) => normCur(e.currency) === cur)
    .filter((e) => (kind === 'in' ? isIncome(e) : !isIncome(e)))
    .reduce((s, e) => s + e.amount, 0);
}

export default function Stats({ expenses }: Props) {
  if (expenses.length === 0) return null;

  const inBob = sumBy(expenses, 'BOB', 'in');
  const inUsd = sumBy(expenses, 'USD', 'in');
  const outBob = sumBy(expenses, 'BOB', 'out');
  const outUsd = sumBy(expenses, 'USD', 'out');

  type Row = { name: string; value: number; cur: 'BOB' | 'USD' };
  const byCategory: Row[] = [];
  const acc: Record<string, number> = {};
  for (const e of expenses) {
    if (isIncome(e)) continue;
    const cur = (normCur(e.currency) as 'BOB' | 'USD') || 'BOB';
    const key = `${e.category}|${cur}`;
    acc[key] = (acc[key] || 0) + e.amount;
  }
  for (const [key, value] of Object.entries(acc)) {
    const [name, c] = key.split('|');
    byCategory.push({ name: `${name} (${c})`, value, cur: c as 'BOB' | 'USD' });
  }
  byCategory.sort((a, b) => b.value - a.value);
  const categoryData = byCategory;

  const byPayment: Record<string, number> = {};
  for (const e of expenses) {
    byPayment[e.paymentMethod] = (byPayment[e.paymentMethod] || 0) + 1;
  }
  const paymentData = Object.entries(byPayment)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const fmtTooltip = (v: number) => String(v);

  return (
    <div style={s.root}>
      <div style={s.totals}>
        <div style={s.statCard}>
          <p style={s.statLabel}>Gastos (BOB / Bs.)</p>
          <p style={s.statValueNeg}>{outBob > 0 ? `−${formatMoney(outBob, 'BOB')}` : '—'}</p>
        </div>
        <div style={s.statCard}>
          <p style={s.statLabel}>Gastos (USD)</p>
          <p style={s.statValueNeg}>{outUsd > 0 ? `−${formatMoney(outUsd, 'USD')}` : '—'}</p>
        </div>
        <div style={s.statCard}>
          <p style={s.statLabel}>Ingresos (BOB / Bs.)</p>
          <p style={s.statValuePos}>{inBob > 0 ? `+${formatMoney(inBob, 'BOB')}` : '—'}</p>
        </div>
        <div style={s.statCard}>
          <p style={s.statLabel}>Ingresos (USD)</p>
          <p style={s.statValuePos}>{inUsd > 0 ? `+${formatMoney(inUsd, 'USD')}` : '—'}</p>
        </div>
        <div style={s.statCard}>
          <p style={s.statLabel}>Movimientos</p>
          <p style={s.statValue}>{expenses.length}</p>
        </div>
      </div>

      <div style={s.charts}>
        {categoryData.length > 0 && (
          <div style={s.chartBox}>
            <p style={s.chartTitle}>Gastos por categoría</p>
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
                    <Cell key={i} fill={PINK_SCALE[i % PINK_SCALE.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(
                    v: number,
                    _n: string,
                    item: { payload?: Row } | undefined,
                  ) => [formatMoney(v, item?.payload?.cur || 'BOB'), 'Monto']}
                  contentStyle={tooltip}
                />
              </PieChart>
            </ResponsiveContainer>
            <div style={s.legend}>
              {categoryData.slice(0, 6).map((d, i) => (
                <div key={d.name} style={s.legendItem}>
                  <span style={{ ...s.legendDot, background: PINK_SCALE[i % PINK_SCALE.length] }} />
                  <span style={s.legendLabel}>{d.name}</span>
                  <span style={s.legendValue}>{formatMoney(d.value, d.cur)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {paymentData.length > 0 && (
          <div style={s.chartBox}>
            <p style={s.chartTitle}>Cuenta / método (cantidad de movimientos)</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={paymentData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={t.border} />
                <XAxis dataKey="name" tick={{ fill: t.textSubtle, fontSize: 10 }} />
                <YAxis tick={{ fill: t.textSubtle, fontSize: 11 }} />
                <Tooltip
                  contentStyle={tooltip}
                  formatter={(v: number) => [fmtTooltip(v), 'Mov.']}
                />
                <Bar dataKey="count" fill={t.accent} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

const tooltip: React.CSSProperties = {
  background: t.bgElevated,
  border: `1px solid ${t.border}`,
  borderRadius: 8,
  color: t.text,
  fontSize: 12,
};

const s: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },
  totals: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: 12,
  },
  statCard: {
    background: t.bgElevated,
    border: `1px solid ${t.border}`,
    borderRadius: 12,
    padding: '16px 18px',
  },
  statLabel: {
    fontSize: 12,
    color: t.textSubtle,
    marginBottom: 6,
    fontWeight: 500,
  },
  statValue: {
    fontSize: 22,
    fontWeight: 700,
    color: t.text,
  },
  statValueNeg: {
    fontSize: 20,
    fontWeight: 700,
    color: t.expense,
  },
  statValuePos: {
    fontSize: 20,
    fontWeight: 700,
    color: t.income,
  },
  charts: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: 16,
  },
  chartBox: {
    background: t.bgElevated,
    border: `1px solid ${t.border}`,
    borderRadius: 12,
    padding: '20px 16px',
  },
  chartTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: t.textMuted,
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
    color: t.textMuted,
    flex: 1,
  },
  legendValue: {
    fontSize: 12,
    fontWeight: 600,
    color: t.text,
  },
};
