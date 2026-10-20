import { PaymentMethod, Transaction } from '../../models';

const currencyFormatter = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
});

const dateFormatter = new Intl.DateTimeFormat('es-ES', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const paymentMethodLabels: Record<PaymentMethod, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  bankTransfer: 'Transferencia',
};

const paymentMethodIcons: Record<PaymentMethod, string> = {
  cash: 'bi-cash',
  card: 'bi-credit-card',
  bankTransfer: 'bi-bank',
};

export function formatTransactionDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number);

  return dateFormatter.format(new Date(year, month - 1, day));
}

export function formatTransactionAmount(transaction: Transaction): string {
  const formattedAmount = currencyFormatter.format(transaction.amount);

  return transaction.type === 'income' ? `+${formattedAmount}` : `-${formattedAmount}`;
}

export function getPaymentMethodLabel(paymentMethod: PaymentMethod): string {
  return paymentMethodLabels[paymentMethod];
}

export function getPaymentMethodIcon(paymentMethod: PaymentMethod): string {
  return paymentMethodIcons[paymentMethod];
}
