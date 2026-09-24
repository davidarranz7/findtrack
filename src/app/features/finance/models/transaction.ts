export type TransactionType = 'income' | 'expense';

export type PaymentMethod = 'cash' | 'card' | 'bankTransfer';

export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  amount: number;
  description: string;
  categoryId: string;
  date: string;
  paymentMethod: PaymentMethod;
  tagIds: string[];
  notes: string;
}
