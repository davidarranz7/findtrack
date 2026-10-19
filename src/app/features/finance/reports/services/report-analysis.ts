import { computed, inject, Injectable } from '@angular/core';

import { Transaction } from '../../models';
import {
  getPercentageComparison,
  type ComparisonDirection,
  type PercentageComparison,
} from '../utils/report-comparison.utils';
import { formatRangeLabel, getMonthsEndingAt } from '../utils/report-period.utils';
import { ReportStateService } from './report-state';

export type { ComparisonDirection, PercentageComparison } from '../utils/report-comparison.utils';
export type { ReportMonth } from '../utils/report-period.utils';

export interface SavingsComparison {
  previousValue: number | null;
  points: number | null;
  direction: ComparisonDirection;
}

@Injectable()
export class ReportAnalysisService {
  private readonly state = inject(ReportStateService);
  private readonly currentDate = new Date();

  private readonly currencyFormatter = new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  });

  readonly reportMonths = computed(() => {
    const year = this.state.selectedYear();
    const endMonth = year === this.currentDate.getFullYear() ? this.currentDate.getMonth() : 11;

    return getMonthsEndingAt(new Date(year, endMonth, 1), this.state.selectedPeriod());
  });

  readonly previousReportMonths = computed(() => {
    const months = this.reportMonths();

    if (months.length === 0) {
      return [];
    }

    const [year, month] = months[0].key.split('-').map(Number);

    return getMonthsEndingAt(new Date(year, month - 2, 1), this.state.selectedPeriod());
  });

  readonly currentPeriodTransactions = computed(() => {
    const monthKeys = new Set(this.reportMonths().map((month) => month.key));

    return this.state.transactions().filter((item) => monthKeys.has(item.date.slice(0, 7)));
  });

  private readonly previousPeriodTransactions = computed(() => {
    const monthKeys = new Set(this.previousReportMonths().map((month) => month.key));

    return this.state.transactions().filter((item) => monthKeys.has(item.date.slice(0, 7)));
  });

  readonly paymentFilteredTransactions = computed(() =>
    this.applyPaymentMethodFilter(this.currentPeriodTransactions()),
  );

  readonly filteredTransactions = computed(() =>
    this.applyReportFilters(this.currentPeriodTransactions()),
  );

  private readonly previousFilteredTransactions = computed(() =>
    this.applyReportFilters(this.previousPeriodTransactions()),
  );

  readonly totalIncome = computed(() =>
    this.getTransactionTotal(this.filteredTransactions(), 'income'),
  );

  readonly totalExpenses = computed(() =>
    this.getTransactionTotal(this.filteredTransactions(), 'expense'),
  );

  readonly netBalance = computed(() => this.totalIncome() - this.totalExpenses());

  readonly savingsRate = computed<number | null>(() => {
    const income = this.totalIncome();

    return income === 0 ? null : (this.netBalance() / income) * 100;
  });

  private readonly previousIncome = computed(() =>
    this.getTransactionTotal(this.previousFilteredTransactions(), 'income'),
  );

  private readonly previousExpenses = computed(() =>
    this.getTransactionTotal(this.previousFilteredTransactions(), 'expense'),
  );

  private readonly previousBalance = computed(
    () => this.previousIncome() - this.previousExpenses(),
  );

  private readonly previousSavingsRate = computed<number | null>(() => {
    const income = this.previousIncome();

    return income === 0 ? null : (this.previousBalance() / income) * 100;
  });

  readonly incomeComparison = computed(() =>
    getPercentageComparison(this.totalIncome(), this.previousIncome()),
  );

  readonly expenseComparison = computed(() =>
    getPercentageComparison(this.totalExpenses(), this.previousExpenses()),
  );

  readonly balanceComparison = computed(() =>
    getPercentageComparison(this.netBalance(), this.previousBalance()),
  );

  readonly savingsRateComparison = computed<SavingsComparison>(() => {
    const currentRate = this.savingsRate();
    const previousRate = this.previousSavingsRate();

    if (currentRate === null || previousRate === null) {
      return {
        previousValue: previousRate,
        points: null,
        direction: 'same',
      };
    }

    const difference = currentRate - previousRate;

    return {
      previousValue: previousRate,
      points: Math.abs(difference),
      direction: difference > 0 ? 'increase' : difference < 0 ? 'decrease' : 'same',
    };
  });

  readonly formattedIncome = computed(() => this.formatCurrency(this.totalIncome()));
  readonly formattedExpenses = computed(() => this.formatCurrency(this.totalExpenses()));
  readonly formattedBalance = computed(() => this.formatCurrency(this.netBalance()));

  readonly formattedSavingsRate = computed(() => {
    const rate = this.savingsRate();

    return rate === null
      ? '—'
      : `${new Intl.NumberFormat('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(rate)} %`;
  });

  readonly averageMonthlyExpenses = computed(() => {
    const monthCount = this.reportMonths().length;

    return monthCount === 0 ? 0 : this.totalExpenses() / monthCount;
  });

  readonly formattedAverageMonthlyExpenses = computed(() =>
    this.formatCurrency(this.averageMonthlyExpenses()),
  );

  readonly hasReportData = computed(() => this.filteredTransactions().length > 0);
  readonly reportRangeLabel = computed(() => formatRangeLabel(this.reportMonths()));
  readonly previousReportRangeLabel = computed(() => formatRangeLabel(this.previousReportMonths()));

  formatCurrency(amount: number): string {
    return this.currencyFormatter.format(amount);
  }

  formatMoneyComparison(comparison: PercentageComparison): string {
    if (comparison.percentage === null) {
      return `Anterior (${this.previousReportRangeLabel()}): ${this.currencyFormatter.format(comparison.previousValue)}`;
    }

    if (comparison.direction === 'same') {
      return `Sin cambios vs ${this.previousReportRangeLabel()}`;
    }

    return `${comparison.percentage.toFixed(1)} % vs ${this.previousReportRangeLabel()}`;
  }

  formatSavingsComparison(comparison: SavingsComparison): string {
    if (this.savingsRate() === null) {
      return 'Sin ingresos en este periodo';
    }

    if (comparison.previousValue === null || comparison.points === null) {
      return `Sin ingresos en ${this.previousReportRangeLabel()}`;
    }

    if (comparison.direction === 'same') {
      return `Sin cambios vs ${this.previousReportRangeLabel()}`;
    }

    return `${comparison.points.toFixed(1)} puntos vs ${this.previousReportRangeLabel()}`;
  }

  private applyReportFilters(transactions: Transaction[]): Transaction[] {
    const selectedIds = this.state.selectedCategoryIds();

    return this.applyPaymentMethodFilter(transactions).filter(
      (item) =>
        selectedIds.length === 0 || selectedIds.includes(item.categoryId ?? 'uncategorized'),
    );
  }

  private applyPaymentMethodFilter(transactions: Transaction[]): Transaction[] {
    const method = this.state.selectedPaymentMethod();

    return method === 'all'
      ? transactions
      : transactions.filter((item) => item.paymentMethod === method);
  }

  private getTransactionTotal(transactions: Transaction[], type: Transaction['type']): number {
    return transactions
      .filter((item) => item.type === type)
      .reduce((total, item) => total + item.amount, 0);
  }
}
