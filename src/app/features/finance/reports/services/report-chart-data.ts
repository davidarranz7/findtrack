import { computed, inject, Injectable } from '@angular/core';

import type {
  BalanceEvolutionChartItem,
  BalanceEvolutionChartSeries,
} from '../../charts/balance-evolution-chart/balance-evolution-chart';
import type { ExpenseDistributionItem } from '../../charts/expense-distribution-chart/expense-distribution-chart';
import type { IncomeExpenseChartItem } from '../../charts/income-expense-chart/income-expense-chart';
import type { Transaction } from '../../models';
import { ReportAnalysisService } from './report-analysis';
import { ReportStateService } from './report-state';

@Injectable()
export class ReportChartDataService {
  private readonly state = inject(ReportStateService);
  private readonly analysis = inject(ReportAnalysisService);

  readonly incomeExpenseHistory = computed<IncomeExpenseChartItem[]>(() => {
    const totalsByMonth = new Map<string, { income: number; expense: number }>();

    for (const transaction of this.analysis.filteredTransactions()) {
      const monthKey = transaction.date.slice(0, 7);

      const totals = totalsByMonth.get(monthKey) ?? {
        income: 0,
        expense: 0,
      };

      if (transaction.type === 'income') {
        totals.income += transaction.amount;
      } else {
        totals.expense += transaction.amount;
      }

      totalsByMonth.set(monthKey, totals);
    }

    return this.analysis.reportMonths().map((month) => {
      const totals = totalsByMonth.get(month.key);

      return {
        label: month.label,
        income: totals?.income ?? 0,
        expense: totals?.expense ?? 0,
      };
    });
  });

  readonly highestExpenseMonth = computed(() => {
    const months = this.incomeExpenseHistory();

    if (months.length === 0) {
      return null;
    }

    const highest = months.reduce((currentHighest, currentMonth) =>
      currentMonth.expense > currentHighest.expense ? currentMonth : currentHighest,
    );

    return highest.expense > 0 ? highest : null;
  });

  readonly expenseDistribution = computed<ExpenseDistributionItem[]>(() =>
    this.getExpenseDistribution(this.analysis.filteredTransactions()),
  );

  private readonly rankingExpenseDistribution = computed<ExpenseDistributionItem[]>(() =>
    this.getExpenseDistribution(this.analysis.paymentFilteredTransactions()),
  );

  readonly topExpenseCategories = computed(() => this.rankingExpenseDistribution().slice(0, 5));

  readonly topExpenseCategory = computed<ExpenseDistributionItem | null>(
    () => this.expenseDistribution()[0] ?? null,
  );

  readonly balanceEvolution = computed<BalanceEvolutionChartItem[]>(() => {
    let accumulatedBalance = 0;

    const totalsByMonth = new Map<string, { income: number; expense: number }>();

    for (const transaction of this.analysis.filteredTransactions()) {
      const monthKey = transaction.date.slice(0, 7);

      const totals = totalsByMonth.get(monthKey) ?? {
        income: 0,
        expense: 0,
      };

      if (transaction.type === 'income') {
        totals.income += transaction.amount;
      } else {
        totals.expense += transaction.amount;
      }

      totalsByMonth.set(monthKey, totals);
    }

    return this.analysis.reportMonths().map((month) => {
      const totals = totalsByMonth.get(month.key);

      accumulatedBalance += (totals?.income ?? 0) - (totals?.expense ?? 0);

      return {
        label: month.label,
        balance: accumulatedBalance,
      };
    });
  });

  readonly balanceCategorySeries = computed<BalanceEvolutionChartSeries[]>(() => {
    const selectedIds = this.state.selectedCategoryIds();

    if (selectedIds.length < 2) {
      return [];
    }

    const months = this.analysis.reportMonths();
    const transactions = this.analysis.filteredTransactions();

    return selectedIds.map((categoryId) => {
      const category = this.state.categories().find((item) => item.id === categoryId);

      const categoryTransactions = transactions.filter(
        (transaction) => (transaction.categoryId ?? 'uncategorized') === categoryId,
      );

      const totalsByMonth = new Map<string, number>();

      for (const transaction of categoryTransactions) {
        const monthKey = transaction.date.slice(0, 7);

        const signedAmount =
          transaction.type === 'income' ? transaction.amount : -transaction.amount;

        totalsByMonth.set(monthKey, (totalsByMonth.get(monthKey) ?? 0) + signedAmount);
      }

      let accumulatedBalance = 0;

      const balances = months.map((month) => {
        accumulatedBalance += totalsByMonth.get(month.key) ?? 0;
        return accumulatedBalance;
      });

      return {
        id: categoryId,
        label:
          categoryId === 'uncategorized'
            ? 'Sin categoría'
            : (category?.name ??
              this.getCategoryName(categoryId, categoryTransactions[0]?.categoryNameSnapshot)),
        color: category?.color ?? '#6c757d',
        balances,
      };
    });
  });

  private getExpenseDistribution(transactions: Transaction[]): ExpenseDistributionItem[] {
    const expenses = transactions.filter((transaction) => transaction.type === 'expense');

    const totalExpenses = expenses.reduce((total, transaction) => total + transaction.amount, 0);

    if (totalExpenses === 0) {
      return [];
    }

    const amountsByCategory = new Map<string | null, number>();

    for (const transaction of expenses) {
      const currentAmount = amountsByCategory.get(transaction.categoryId) ?? 0;

      amountsByCategory.set(transaction.categoryId, currentAmount + transaction.amount);
    }

    return Array.from(amountsByCategory.entries(), ([categoryId, amount]) => {
      const category =
        categoryId === null
          ? undefined
          : this.state.categories().find((currentCategory) => currentCategory.id === categoryId);

      return {
        categoryId: categoryId ?? 'uncategorized',
        categoryName: category?.name ?? 'Sin categoría',
        amount,
        percentage: (amount / totalExpenses) * 100,
        color: category?.color ?? '#6c757d',
      };
    }).sort((firstCategory, secondCategory) => secondCategory.amount - firstCategory.amount);
  }

  private getCategoryName(categoryId: string | null, snapshot?: string | null): string {
    const category = this.state.categories().find((item) => item.id === categoryId);

    if (category) {
      return category.name;
    }

    return snapshot?.trim() ? `${snapshot} (eliminada)` : 'Sin categoría';
  }
}
