import { today } from '../fixtures/finora.fixture';

export function monthShift(offset: number, anchor = today()): string {
  const [year, month] = anchor.slice(0, 7).split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1 + offset, 15));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function dateInMonth(offset: number, day = 15, anchor = today()): string {
  return `${monthShift(offset, anchor)}-${String(day).padStart(2, '0')}`;
}

export const euros = (amount: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(amount);
