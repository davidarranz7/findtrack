import { computed, inject, Injectable } from '@angular/core';

import { type ExpenseDistributionItem } from '../../charts/expense-distribution-chart/expense-distribution-chart';
import { type IncomeExpenseChartItem } from '../../charts/income-expense-chart/income-expense-chart';
import { Transaction } from '../../models';
import { BudgetAnalysisService } from '../../services/budget-analysis.service';
import { OverviewStateService } from './overview-state';

interface OverviewMonth {
  key: string;
  label: string;
}

@Injectable()
export class OverviewAnalysisService {
  private readonly state = inject(OverviewStateService);
  private readonly budgetAnalysisService = inject(BudgetAnalysisService);
  private readonly today = new Date();

  private readonly currencyFormatter = new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  });

  private readonly dateFormatter = new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'short',
  });

  private readonly monthFormatter = new Intl.DateTimeFormat('es-ES', {
    month: 'short',
  });

  private readonly recentMonths = computed(() => this.getRecentMonths(this.state.selectedMonth()));

  readonly monthlyTransactions = computed(() =>
    this.state
      .transactions()
      .filter((transaction) => transaction.date.startsWith(this.state.selectedMonthKey())),
  );

  readonly latestTransactions = computed(() =>
    [...this.monthlyTransactions()]
      .sort((first, second) => second.date.localeCompare(first.date))
      .slice(0, 5),
  );

  readonly availableBalance = computed(() =>
    this.state.transactions().reduce((balance, transaction) => {
      if (transaction.date.slice(0, 7) > this.state.selectedMonthKey()) {
        return balance;
      }

      return transaction.type === 'income'
        ? balance + transaction.amount
        : balance - transaction.amount;
    }, 0),
  );

  private readonly monthlyTotals = computed(() =>
    this.monthlyTransactions().reduce(
      (totals, transaction) => {
        if (transaction.type === 'income') {
          totals.income += transaction.amount;
        } else {
          totals.expenses += transaction.amount;
        }

        return totals;
      },
      { income: 0, expenses: 0 },
    ),
  );

  readonly monthlyIncome = computed(() => this.monthlyTotals().income);
  readonly monthlyExpenses = computed(() => this.monthlyTotals().expenses);

  readonly monthlySavings = computed(() => this.monthlyIncome() - this.monthlyExpenses());

  readonly incomeExpenseHistory = computed<IncomeExpenseChartItem[]>(() => {
    const months = this.recentMonths();
    const monthKeys = new Set(months.map((month) => month.key));
    const totals = new Map<string, { income: number; expense: number }>();

    for (const transaction of this.state.transactions()) {
      const key = transaction.date.slice(0, 7);

      if (!monthKeys.has(key)) {
        continue;
      }

      const month = totals.get(key) ?? { income: 0, expense: 0 };

      if (transaction.type === 'income') {
        month.income += transaction.amount;
      } else {
        month.expense += transaction.amount;
      }

      totals.set(key, month);
    }

    return months.map(({ key, label }) => ({
      label,
      income: totals.get(key)?.income ?? 0,
      expense: totals.get(key)?.expense ?? 0,
    }));
  });

  readonly hasIncomeExpenseData = computed(() =>
    this.incomeExpenseHistory().some((month) => month.income > 0 || month.expense > 0),
  );

  readonly expenseDistribution = computed<ExpenseDistributionItem[]>(() => {
    const expenses = this.monthlyTransactions().filter(
      (transaction) => transaction.type === 'expense',
    );

    const totalExpenses = this.monthlyExpenses();

    if (expenses.length === 0 || totalExpenses === 0) {
      return [];
    }

    const amounts = new Map<string | null, number>();

    for (const transaction of expenses) {
      amounts.set(
        transaction.categoryId,
        (amounts.get(transaction.categoryId) ?? 0) + transaction.amount,
      );
    }

    return Array.from(amounts, ([categoryId, amount]) => {
      const category = this.state.categories().find((item) => item.id === categoryId);

      return {
        categoryId: categoryId ?? 'uncategorized',
        categoryName: category?.name ?? 'Sin categoría',
        amount,
        percentage: (amount / totalExpenses) * 100,
        color: category?.color ?? '#6c757d',
      };
    }).sort((first, second) => second.amount - first.amount);
  });

  readonly budgetProgress = computed(() =>
    this.budgetAnalysisService.getBudgetProgress(
      this.state.budgets(),
      this.state.transactions(),
      this.state.categories(),
      this.state.selectedMonthKey(),
    ),
  );

  readonly budgetAlert = computed(() =>
    this.budgetAnalysisService.getBudgetAlert(this.budgetProgress()),
  );

  readonly formattedBalance = computed(() => this.formatCurrency(this.availableBalance()));

  readonly formattedIncome = computed(() => this.formatCurrency(this.monthlyIncome()));

  readonly formattedExpenses = computed(() => this.formatCurrency(this.monthlyExpenses()));

  readonly formattedSavings = computed(() => this.formatCurrency(this.monthlySavings()));

  getCategoryName(categoryId: string | null, snapshot?: string | null): string {
    const category = this.state.categories().find((item) => item.id === categoryId);

    if (category) {
      return category.name;
    }

    return snapshot?.trim() ? `${snapshot} (eliminada)` : 'Sin categoría';
  }

  formatCurrency(amount: number): string {
    return this.currencyFormatter.format(amount);
  }

  formatTransactionAmount(transaction: Transaction): string {
    const amount = this.formatCurrency(transaction.amount);

    return transaction.type === 'income' ? `+${amount}` : `-${amount}`;
  }

  formatTransactionDate(date: string): string {
    if (date === this.getDateKey(this.today)) {
      return 'Hoy';
    }

    const [year, month, day] = date.split('-').map(Number);

    return this.dateFormatter.format(new Date(year, month - 1, day));
  }

  private getRecentMonths(reference: Date): OverviewMonth[] {
    return Array.from({ length: 6 }, (_, index) => {
      const date = new Date(reference.getFullYear(), reference.getMonth() - 5 + index, 1);

      const month = this.monthFormatter.format(date).replace('.', '');

      return {
        key: this.getMonthKey(date),
        label: month.charAt(0).toUpperCase() + month.slice(1),
      };
    });
  }

  private getMonthKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  private getDateKey(date: Date): string {
    return `${this.getMonthKey(date)}-${String(date.getDate()).padStart(2, '0')}`;
  }
}
