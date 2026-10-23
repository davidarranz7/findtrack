import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { TransactionsFiltersService } from '../../services/transactions-filters';
import { TransactionsStateService } from '../../services/transactions-state';
import { TransactionsSummaryService } from '../../services/transactions-summary';

@Component({
  selector: 'app-transactions-summary',
  templateUrl: './transactions-summary.html',
  styleUrl: './transactions-summary.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransactionsSummary {
  protected readonly state = inject(TransactionsStateService);
  protected readonly filters = inject(TransactionsFiltersService);
  protected readonly summary = inject(TransactionsSummaryService);
}
