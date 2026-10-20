import { Category, Transaction } from '../../models';

export function getTransactionCategoryName(
  transaction: Transaction,
  categories: Category[],
): string {
  const category = categories.find((item) => item.id === transaction.categoryId);

  if (category) {
    return category.name;
  }

  const snapshot = transaction.categoryNameSnapshot;

  return snapshot?.trim() ? `${snapshot} (eliminada)` : 'Sin categoría';
}
