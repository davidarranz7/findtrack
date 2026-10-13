export type TransactionType = 'income' | 'expense';

export type PaymentMethod = 'cash' | 'card' | 'bankTransfer';

export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  amount: number;
  description: string;
  categoryId: string | null;
  /** Conserva el nombre histórico cuando se elimina una categoría. */
  categoryNameSnapshot?: string | null;
  date: string;
  paymentMethod: PaymentMethod;
  notes: string;
}
