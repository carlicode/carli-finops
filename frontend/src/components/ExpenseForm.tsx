import { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/api';
import { t } from '../theme';
import { CURRENCY_OPTIONS, formatMoney } from '../currency';

const client = generateClient();

const CREATE_EXPENSE = `
  mutation CreateExpense($input: CreateExpenseInput!) {
    createExpense(input: $input) {
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

const EXPENSE_CATS = [
  'Comida & Restaurantes',
  'Supermercado',
  'Transporte',
  'Entretenimiento',
  'Salud',
  'Servicios (luz, agua, etc.)',
  'Ropa & Personal',
  'Suscripciones',
  'Viajes',
  'Madre',
  'Otros',
];

const INCOME_CATS = [
  'Salario / Trabajo',
  'Redes sociales (TikTok, etc.)',
  'Freelance',
  'Inversiones / intereses',
  'Regalos',
  'Otros ingresos',
];

const PAYMENT_METHODS = [
  'Efectivo',
  'Tarjeta de Crédito',
  'Tarjeta de Débito',
  'Transferencia',
  'BCP',
  'BNB',
  'Regions Bank',
  'Truist Bank',
  'Billetera digital',
];

interface Props {
  onCreated: () => void;
}

export default function ExpenseForm({ onCreated }: Props) {
  const [flow, setFlow] = useState<'EXPENSE' | 'INCOME'>('EXPENSE');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(EXPENSE_CATS[0]);
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('BOB');
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS[2]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);

  const categories = flow === 'INCOME' ? INCOME_CATS : EXPENSE_CATS;

  useEffect(() => {
    setCategory(flow === 'INCOME' ? INCOME_CATS[0] : EXPENSE_CATS[0]);
  }, [flow]);

  const reset = () => {
    setFlow('EXPENSE');
    setDescription('');
    setCategory(EXPENSE_CATS[0]);
    setAmount('');
    setCurrency('BOB');
    setPaymentMethod(PAYMENT_METHODS[2]);
    setError('');
  };

  const handleOpen = () => {
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const parsed = parseFloat(amount.replace(/,/g, ''));
    if (!parsed || parsed <= 0) {
      setError('Ingresa un monto válido.');
      return;
    }
    setLoading(true);
    try {
      const list = flow === 'INCOME' ? INCOME_CATS : EXPENSE_CATS;
      const finalCat = list.includes(category) ? category : list[0];
      await client.graphql({
        query: CREATE_EXPENSE,
        variables: {
          input: {
            description,
            category: finalCat,
            amount: parsed,
            currency: currency || 'BOB',
            paymentMethod,
            flow,
          },
        },
      });
      reset();
      setOpen(false);
      onCreated();
    } catch (err) {
      setError('Error al guardar. Intenta de nuevo.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <button type="button" style={s.addBtn} onClick={handleOpen}>
        + Nuevo movimiento
      </button>
    );
  }

  return (
    <div style={s.overlay}>
      <div style={s.modal}>
        <div style={s.header}>
          <h2 style={s.title}>Registrar movimiento</h2>
          <button type="button" style={s.close} onClick={() => { reset(); setOpen(false); }} aria-label="Cerrar">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} style={s.form}>
          <div style={s.flowRow}>
            <span style={s.flowLabel}>Tipo</span>
            <div style={s.toggle}>
              <button
                type="button"
                style={{ ...s.toggleBtn, ...(flow === 'EXPENSE' ? s.toggleOn : {}) }}
                onClick={() => { setFlow('EXPENSE'); setCategory(EXPENSE_CATS[0]); }}
              >
                Gasto
              </button>
              <button
                type="button"
                style={{ ...s.toggleBtn, ...(flow === 'INCOME' ? s.toggleOn : {}) }}
                onClick={() => { setFlow('INCOME'); setCategory(INCOME_CATS[0]); }}
              >
                Ingreso
              </button>
            </div>
          </div>

          <Field label="Descripción">
            <input
              style={s.input}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={flow === 'EXPENSE' ? 'Ej: Almuerzo' : 'Ej: Pago TikTok quincenal'}
              required
              autoFocus
            />
          </Field>

          <Field label={flow === 'EXPENSE' ? 'Categoría' : 'Fuente / tipo'}>
            <select
              style={s.input}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {categories.map((c) => <option key={c}>{c}</option>)}
            </select>
          </Field>

          <div style={s.row}>
            <Field label="Monto" style={{ flex: 1 }}>
              <input
                style={s.input}
                type="number"
                min="0"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                required
              />
            </Field>
            <Field label="Moneda" style={{ width: 120 }}>
              <select style={s.input} value={currency} onChange={(e) => setCurrency(e.target.value)}>
                {CURRENCY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
          </div>

          <p style={s.hint}>
            {amount && !Number.isNaN(parseFloat(amount)) ? `Vista previa: ${formatMoney(parseFloat(amount), currency)}` : ' '}
          </p>

          <Field label={flow === 'EXPENSE' ? 'Método de pago' : 'Cuenta / dónde entró'}>
            <select style={s.input} value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              {PAYMENT_METHODS.map((m) => <option key={m}>{m}</option>)}
            </select>
          </Field>

          {error && <p style={s.error}>{error}</p>}

          <div style={s.actions}>
            <button type="button" style={s.cancelBtn} onClick={() => { reset(); setOpen(false); }}>
              Cancelar
            </button>
            <button type="submit" style={{ ...s.saveBtn, opacity: loading ? 0.7 : 1 }} disabled={loading}>
              {loading ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children, style }: { label: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, ...style }}>
      <label style={{ fontSize: 12, fontWeight: 500, color: t.textMuted }}>{label}</label>
      {children}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  addBtn: {
    padding: '10px 20px',
    background: t.accent,
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.65)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: 16,
  },
  modal: {
    background: t.bgElevated,
    border: `1px solid ${t.border}`,
    borderRadius: 16,
    width: '100%',
    maxWidth: 480,
    padding: 28,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    color: t.text,
  },
  close: {
    background: 'none',
    border: 'none',
    color: t.textSubtle,
    fontSize: 18,
    cursor: 'pointer',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  flowRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  flowLabel: {
    fontSize: 12,
    fontWeight: 500,
    color: t.textMuted,
  },
  toggle: {
    display: 'flex',
    gap: 8,
  },
  toggleBtn: {
    flex: 1,
    padding: '8px 12px',
    background: t.inputBg,
    border: `1px solid ${t.border}`,
    borderRadius: 8,
    color: t.textMuted,
    fontSize: 14,
    cursor: 'pointer',
  },
  toggleOn: {
    background: t.accentSoft,
    border: `1px solid ${t.accentBorder}`,
    color: t.text,
  },
  input: {
    padding: '9px 12px',
    background: t.inputBg,
    border: `1px solid ${t.border}`,
    borderRadius: 8,
    color: t.text,
    fontSize: 14,
    width: '100%',
  },
  row: {
    display: 'flex',
    gap: 10,
  },
  hint: {
    fontSize: 12,
    color: t.textSubtle,
    minHeight: 16,
    margin: 0,
  },
  error: {
    color: '#fb7185',
    fontSize: 13,
  },
  actions: {
    display: 'flex',
    gap: 10,
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  cancelBtn: {
    padding: '9px 18px',
    background: 'transparent',
    border: `1px solid ${t.border}`,
    borderRadius: 8,
    color: t.textMuted,
    fontSize: 14,
    cursor: 'pointer',
  },
  saveBtn: {
    padding: '9px 20px',
    background: t.accent,
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
};
