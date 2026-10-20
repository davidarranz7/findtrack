import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';

import { Transaction } from '../../models';
import { TransactionsFiltersService } from '../services/transactions-filters';
import { TransactionsStateService } from '../services/transactions-state';
import { getTransactionCategoryName } from '../utils/transaction-category.utils';
import {
  formatTransactionAmount,
  formatTransactionDate,
  getPaymentMethodIcon,
  getPaymentMethodLabel,
} from '../utils/transaction-display.utils';

@Component({
  selector: 'app-transactions-table',
  templateUrl: './transactions-table.html',
  styleUrl: './transactions-table.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransactionsTable {
  protected readonly state = inject(TransactionsStateService);
  protected readonly filters = inject(TransactionsFiltersService);

  readonly deletingTransactionId = input<string | null>(null);

  readonly editRequested = output<Transaction>();
  readonly deleteRequested = output<Transaction>();

  protected readonly getCategoryName = getTransactionCategoryName;
  protected readonly formatTransactionDate = formatTransactionDate;
  protected readonly formatTransactionAmount = formatTransactionAmount;
  protected readonly getPaymentMethodIcon = getPaymentMethodIcon;
  protected readonly getPaymentMethodLabel = getPaymentMethodLabel;
}
