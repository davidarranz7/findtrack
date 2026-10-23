import { inject, Injectable } from '@angular/core';
import { forkJoin, Observable } from 'rxjs';

import { Category, Transaction } from '../../../../../features/finance/models';
import { CategoryService } from '../../../../../features/finance/services/category.service';
import { TransactionService } from '../../../../../features/finance/services/transaction.service';

export interface HeaderSearchData {
  transactions: Transaction[];
  categories: Category[];
}

@Injectable({
  providedIn: 'root',
})
export class HeaderSearchService {
  private readonly transactionService = inject(TransactionService);
  private readonly categoryService = inject(CategoryService);

  readonly transactionsChanged$ = this.transactionService.transactionsChanged$;

  loadData(userId: string): Observable<HeaderSearchData> {
    return forkJoin({
      transactions: this.transactionService.getTransactions(userId),
      categories: this.categoryService.getCategories(userId),
    });
  }

  filterTransactions(transactions: readonly Transaction[], query: string): Transaction[] {
    const normalizedQuery = query.trim().toLocaleLowerCase('es-ES');

    if (!normalizedQuery) {
      return [];
    }

    return transactions
      .filter((transaction) => {
        const description = transaction.description.toLocaleLowerCase('es-ES');
        const notes = (transaction.notes ?? '').toLocaleLowerCase('es-ES');

        return description.includes(normalizedQuery) || notes.includes(normalizedQuery);
      })
      .sort((first, second) => second.date.localeCompare(first.date));
  }
}
