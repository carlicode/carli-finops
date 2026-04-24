import { useState } from 'react';
import { generateClient } from 'aws-amplify/api';

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
      createdAt
      month
    }
  }
`;

const CATEGORIES = [
  'Comida & Restaurantes',
  'Supermercado',
  'Transporte',
  'Entretenimiento',
  'Salud',
  'Servicios (luz, agua, etc.)',
  'Ropa & Personal',
  'Suscripciones',
  'Viajes',
  'Otros',
];

const PAYMENT_METHODS = [
  'Efectivo',
  'Tarjeta de Crédito',
  'Tarjeta de Débito',
  'Transferencia',
  'SINPE Móvil',
];

interface Props {
  onCreated: () => void;
}

export default function ExpenseForm({ onCreated }: Props) {
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('CRC');
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS[2]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);

  const reset = () => {
    setDescription('');
    setCategory(CATEGORIES[0]);
    setAmount('');
    setCurrency('CRC');
    setPaymentMethod(PAYMENT_METHODS[2]);
    setError('');
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
      await client.graphql({
        query: CREATE_EXPENSE,
        variables: { input: { description, category, amount: parsed, currency, paymentMethod } },
      });
      reset();
      setOpen(false);
      onCreated();
    } catch (err) {
      setError('Error al guardar el gasto. Intenta de nuevo.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <button style={s.addBtn} onClick={() => setOpen(true)}>
        + Nuevo gasto
      </button>
    );
  }

  return (
    <div style={s.overlay}>
      <div style={s.modal}>
        <div style={s.header}>
          <h2 style={s.title}>Registrar gasto</h2>
          <button style={s.close} onClick={() => { reset(); setOpen(false); }}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={s.form}>
          <Field label="Descripción">
            <input
              style={s.input}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ej: Almuerzo en restaurante"
              required
              autoFocus
            />
          </Field>

          <Field label="Categoría">
            <select style={s.input} value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
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
            <Field label="Moneda" style={{ width: 100 }}>
              <select style={s.input} value={currency} onChange={(e) => setCurrency(e.target.value)}>
                <option value="CRC">₡ CRC</option>
                <option value="USD">$ USD</option>
              </select>
            </Field>
          </div>

          <Field label="Método de pago">
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
      <label style={{ fontSize: 12, fontWeight: 500, color: '#94a3b8' }}>{label}</label>
      {children}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  addBtn: {
    padding: '10px 20px',
    background: '#4f46e5',
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
    background: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: 16,
  },
  modal: {
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: 16,
    width: '100%',
    maxWidth: 480,
    padding: 28,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    color: '#f1f5f9',
  },
  close: {
    background: 'none',
    border: 'none',
    color: '#64748b',
    fontSize: 18,
    cursor: 'pointer',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  input: {
    padding: '9px 12px',
    background: '#0f172a',
    border: '1px solid #334155',
    borderRadius: 8,
    color: '#f1f5f9',
    fontSize: 14,
    width: '100%',
  },
  row: {
    display: 'flex',
    gap: 10,
  },
  error: {
    color: '#f87171',
    fontSize: 13,
  },
  actions: {
    display: 'flex',
    gap: 10,
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  cancelBtn: {
    padding: '9px 18px',
    background: 'transparent',
    border: '1px solid #334155',
    borderRadius: 8,
    color: '#94a3b8',
    fontSize: 14,
    cursor: 'pointer',
  },
  saveBtn: {
    padding: '9px 20px',
    background: '#4f46e5',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
};
