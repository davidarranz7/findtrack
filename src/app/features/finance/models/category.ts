export type CategoryType = 'income' | 'expense' | 'both';

export interface Category {
  id: string;
  userId: string | null;
  name: string;
  type: CategoryType;
  icon: string;
  color: string;
}
