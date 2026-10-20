import { computed, inject, Injectable } from '@angular/core';

import { TransactionsFiltersService } from './transactions-filters';

@Injectable()
export class TransactionsSummaryService {
  private readonly filters = inject(TransactionsFiltersService);

  private readonly currencyFormatter = new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  });

  private readonly totals = computed(() =>
    this.filters.transactionsInSelectedMonth().reduce(
      (summary, transaction) => {
        if (transaction.type === 'income') {
          summary.incomeCount++;
          summary.monthlyIncome += transaction.amount;
        } else {
          summary.expenseCount++;
          summary.monthlyExpenses += transaction.amount;
        }

        return summary;
      },
      {
        incomeCount: 0,
        expenseCount: 0,
        monthlyIncome: 0,
        monthlyExpenses: 0,
      },
    ),
  );

  readonly totalTransactionsInSelectedMonth = computed(
    () => this.totals().incomeCount + this.totals().expenseCount,
  );

  readonly incomeCount = computed(() => this.totals().incomeCount);
  readonly expenseCount = computed(() => this.totals().expenseCount);

  readonly monthlyIncome = computed(() => this.totals().monthlyIncome);
  readonly monthlyExpenses = computed(() => this.totals().monthlyExpenses);

  readonly operatingBalance = computed(() => this.monthlyIncome() - this.monthlyExpenses());

  readonly formattedMonthlyIncome = computed(() =>
    this.currencyFormatter.format(this.monthlyIncome()),
  );

  readonly formattedMonthlyExpenses = computed(() => {
    const expenses = this.monthlyExpenses();

    return expenses === 0
      ? this.currencyFormatter.format(0)
      : `-${this.currencyFormatter.format(expenses)}`;
  });

  readonly formattedOperatingBalance = computed(() =>
    this.currencyFormatter.format(this.operatingBalance()),
  );
}
