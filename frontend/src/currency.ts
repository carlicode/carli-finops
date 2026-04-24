/**
 * Formato de moneda: BOB (por defecto) y USD. CRC = datos heredados.
 */
export function formatMoney(amount: number, currency: string): string {
  const c = (currency || 'BOB').toUpperCase();
  if (c === 'USD') {
    return `US$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (c === 'CRC' || c === 'BOB' || c === 'BS' || c === 'BS.') {
    return `Bs. ${amount.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `Bs. ${amount.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export const CURRENCY_OPTIONS = [
  { value: 'BOB', label: 'Bs. BOB' },
  { value: 'USD', label: 'US$ USD' },
] as const;
