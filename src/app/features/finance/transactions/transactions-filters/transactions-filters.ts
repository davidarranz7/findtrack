import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { TransactionsFiltersService } from '../services/transactions-filters';
import { TransactionsStateService } from '../services/transactions-state';
import { TransactionsSummaryService } from '../services/transactions-summary';

@Component({
  selector: 'app-transactions-filters',
  templateUrl: './transactions-filters.html',
  styleUrl: './transactions-filters.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransactionsFilters {
  protected readonly state = inject(TransactionsStateService);
  protected readonly filters = inject(TransactionsFiltersService);
  protected readonly summary = inject(TransactionsSummaryService);
}
