import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { finalize, forkJoin } from 'rxjs';

import { PageHeader } from '../../../shared/ui/page-header/page-header';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { AuthService } from '../../auth/services/auth.service';
import {
  BalanceEvolutionChart,
  type BalanceEvolutionChartItem,
  type BalanceEvolutionChartSeries,
} from '../charts/balance-evolution-chart/balance-evolution-chart';
import {
  ExpenseDistributionChart,
  type ExpenseDistributionItem,
} from '../charts/expense-distribution-chart/expense-distribution-chart';
import {
  IncomeExpenseChart,
  type IncomeExpenseChartItem,
} from '../charts/income-expense-chart/income-expense-chart';
import { Category, Transaction } from '../models';
import { CategoryService } from '../services/category.service';
import { TransactionService } from '../services/transaction.service';

type ReportPeriod = 1 | 3 | 6 | 12;
type ComparisonDirection = 'increase' | 'decrease' | 'same';
type PaymentMethodFilter = 'all' | Transaction['paymentMethod'];

interface ReportMonth {
  key: string;
  label: string;
}

interface PercentageComparison {
  previousValue: number;
  percentage: number | null;
  direction: ComparisonDirection;
}

interface SavingsComparison {
  previousValue: number | null;
  points: number | null;
  direction: ComparisonDirection;
}

@Component({
  selector: 'app-reports',
  imports: [PageHeader, IncomeExpenseChart, ExpenseDistributionChart, BalanceEvolutionChart],
  templateUrl: './reports.html',
  styleUrl: './reports.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Reports {
  private readonly authService = inject(AuthService);
  private readonly transactionService = inject(TransactionService);
  private readonly categoryService = inject(CategoryService);
  private readonly toastService = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly document = inject(DOCUMENT);

  private readonly currentDate = new Date();

  private readonly currencyFormatter = new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  });

  protected readonly transactions = signal<Transaction[]>([]);
  protected readonly categories = signal<Category[]>([]);

  protected readonly isLoading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly isExportingPdf = signal(false);

  protected readonly selectedPeriod = signal<ReportPeriod>(6);
  protected readonly selectedYear = signal(this.currentDate.getFullYear());
  // Lista vacía significa que se incluyen todas las categorías.
  protected readonly selectedCategoryIds = signal<string[]>([]);
  protected readonly selectedCategoryId = computed(() => {
    const selected = this.selectedCategoryIds();
    return selected.length === 0 ? 'all' : selected.length === 1 ? selected[0] : 'multiple';
  });
  protected readonly selectedPaymentMethod = signal<PaymentMethodFilter>('all');
  protected readonly comparisonEnabled = signal(false);

  protected readonly generatedAtLabel = new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'long',
  }).format(this.currentDate);

  protected readonly periodOptions: {
    value: ReportPeriod;
    label: string;
  }[] = [
    {
      value: 1,
      label: 'Último mes',
    },
    {
      value: 3,
      label: 'Últimos 3 meses',
    },
    {
      value: 6,
      label: 'Últimos 6 meses',
    },
    {
      value: 12,
      label: 'Últimos 12 meses',
    },
  ];

  protected readonly paymentMethodOptions: {
    value: PaymentMethodFilter;
    label: string;
  }[] = [
    {
      value: 'all',
      label: 'Todos los métodos',
    },
    {
      value: 'card',
      label: 'Tarjeta',
    },
    {
      value: 'cash',
      label: 'Efectivo',
    },
    {
      value: 'bankTransfer',
      label: 'Transferencia',
    },
  ];

  protected readonly sortedCategories = computed(() =>
    [...this.categories()].sort((firstCategory, secondCategory) =>
      firstCategory.name.localeCompare(secondCategory.name, 'es-ES'),
    ),
  );

  protected readonly availableYears = computed(() => {
    const years = new Set<number>([this.currentDate.getFullYear()]);

    for (const transaction of this.transactions()) {
      const year = Number(transaction.date.slice(0, 4));

      if (Number.isFinite(year)) {
        years.add(year);
      }
    }

    return [...years].sort((firstYear, secondYear) => secondYear - firstYear);
  });

  private readonly reportMonths = computed<ReportMonth[]>(() =>
    this.getReportMonths(this.selectedYear(), this.selectedPeriod()),
  );

  private readonly previousReportMonths = computed<ReportMonth[]>(() => {
    const months = this.reportMonths();

    if (months.length === 0) {
      return [];
    }

    const [year, month] = months[0].key.split('-').map(Number);
    const previousPeriodEnd = new Date(year, month - 2, 1);

    return this.getMonthsEndingAt(previousPeriodEnd, this.selectedPeriod());
  });

  private readonly reportMonthKeys = computed(
    () => new Set(this.reportMonths().map((month) => month.key)),
  );

  private readonly previousReportMonthKeys = computed(
    () => new Set(this.previousReportMonths().map((month) => month.key)),
  );

  private readonly currentPeriodTransactions = computed(() => {
    const monthKeys = this.reportMonthKeys();

    return this.transactions().filter((transaction) => monthKeys.has(transaction.date.slice(0, 7)));
  });

  private readonly previousPeriodTransactions = computed(() => {
    const monthKeys = this.previousReportMonthKeys();

    return this.transactions().filter((transaction) => monthKeys.has(transaction.date.slice(0, 7)));
  });

  protected readonly filteredTransactions = computed(() =>
    this.applyReportFilters(this.currentPeriodTransactions()),
  );

  private readonly previousFilteredTransactions = computed(() =>
    this.applyReportFilters(this.previousPeriodTransactions()),
  );

  protected readonly activeFilterCount = computed(() => {
    let count = 0;

    if (this.selectedCategoryIds().length > 0) {
      count++;
    }

    if (this.selectedPaymentMethod() !== 'all') {
      count++;
    }

    return count;
  });

  protected readonly selectedCategoryLabel = computed(() => {
    const selected = this.selectedCategoryIds();

    if (selected.length === 0) {
      return 'Todas las categorías';
    }

    return selected
      .map((categoryId) => {
        if (categoryId === 'uncategorized') {
          return 'Sin categoría';
        }

        return (
          this.categories().find((category) => category.id === categoryId)?.name ?? 'Sin categoría'
        );
      })
      .join(', ');
  });

  protected readonly selectedPaymentMethodLabel = computed(
    () =>
      this.paymentMethodOptions.find((option) => option.value === this.selectedPaymentMethod())
        ?.label ?? 'Todos los métodos',
  );

  protected readonly totalIncome = computed(() =>
    this.getTransactionTotal(this.filteredTransactions(), 'income'),
  );

  protected readonly totalExpenses = computed(() =>
    this.getTransactionTotal(this.filteredTransactions(), 'expense'),
  );

  protected readonly netBalance = computed(() => this.totalIncome() - this.totalExpenses());

  protected readonly savingsRate = computed<number | null>(() => {
    const income = this.totalIncome();

    if (income === 0) {
      return null;
    }

    return (this.netBalance() / income) * 100;
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

    if (income === 0) {
      return null;
    }

    return (this.previousBalance() / income) * 100;
  });

  protected readonly incomeComparison = computed(() =>
    this.getPercentageComparison(this.totalIncome(), this.previousIncome()),
  );

  protected readonly expenseComparison = computed(() =>
    this.getPercentageComparison(this.totalExpenses(), this.previousExpenses()),
  );

  protected readonly balanceComparison = computed(() =>
    this.getPercentageComparison(this.netBalance(), this.previousBalance()),
  );

  protected readonly savingsRateComparison = computed<SavingsComparison>(() => {
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

  protected readonly formattedIncome = computed(() =>
    this.currencyFormatter.format(this.totalIncome()),
  );

  protected readonly formattedExpenses = computed(() =>
    this.currencyFormatter.format(this.totalExpenses()),
  );

  protected readonly formattedBalance = computed(() =>
    this.currencyFormatter.format(this.netBalance()),
  );

  protected readonly formattedSavingsRate = computed(() => {
    const savingsRate = this.savingsRate();

    if (savingsRate === null) {
      return '—';
    }

    return `${new Intl.NumberFormat('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(savingsRate)} %`;
  });

  protected readonly averageMonthlyExpenses = computed(() => {
    const monthCount = this.reportMonths().length;

    if (monthCount === 0) {
      return 0;
    }

    return this.totalExpenses() / monthCount;
  });

  protected readonly formattedAverageMonthlyExpenses = computed(() =>
    this.currencyFormatter.format(this.averageMonthlyExpenses()),
  );

  protected readonly incomeExpenseHistory = computed<IncomeExpenseChartItem[]>(() => {
    const totalsByMonth = new Map<
      string,
      {
        income: number;
        expense: number;
      }
    >();

    for (const transaction of this.filteredTransactions()) {
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

    return this.reportMonths().map((month) => {
      const totals = totalsByMonth.get(month.key);

      return {
        label: month.label,
        income: totals?.income ?? 0,
        expense: totals?.expense ?? 0,
      };
    });
  });

  protected readonly highestExpenseMonth = computed(() => {
    const months = this.incomeExpenseHistory();

    if (months.length === 0) {
      return null;
    }

    const highest = months.reduce((currentHighest, currentMonth) =>
      currentMonth.expense > currentHighest.expense ? currentMonth : currentHighest,
    );

    return highest.expense > 0 ? highest : null;
  });

  // Los gráficos obedecen a todos los filtros activos.
  protected readonly expenseDistribution = computed<ExpenseDistributionItem[]>(() =>
    this.getExpenseDistribution(this.filteredTransactions()),
  );

  // El ranking debe seguir visible cuando se filtra una categoría, para poder añadir otra.
  // Respeta el periodo y el método de pago, pero no la selección de categorías.
  private readonly rankingExpenseDistribution = computed<ExpenseDistributionItem[]>(() =>
    this.getExpenseDistribution(this.applyPaymentMethodFilter(this.currentPeriodTransactions())),
  );

  protected readonly topExpenseCategories = computed(() =>
    this.rankingExpenseDistribution().slice(0, 5),
  );

  // El resumen del informe sí debe reflejar la categoría más importante de la selección.
  protected readonly topExpenseCategory = computed(() => this.expenseDistribution()[0] ?? null);

  protected readonly balanceEvolution = computed<BalanceEvolutionChartItem[]>(() => {
    let accumulatedBalance = 0;

    const totalsByMonth = new Map<
      string,
      {
        income: number;
        expense: number;
      }
    >();

    for (const transaction of this.filteredTransactions()) {
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

    return this.reportMonths().map((month) => {
      const totals = totalsByMonth.get(month.key);

      accumulatedBalance += (totals?.income ?? 0) - (totals?.expense ?? 0);

      return {
        label: month.label,
        balance: accumulatedBalance,
      };
    });
  });

  // Mostrar el balance total por sí solo cuando no hay comparación de categorías.
  // Con dos o más categorías, cada serie mantiene su propio acumulado mensual.
  protected readonly balanceCategorySeries = computed<BalanceEvolutionChartSeries[]>(() => {
    const selectedIds = this.selectedCategoryIds();

    if (selectedIds.length < 2) {
      return [];
    }

    const months = this.reportMonths();
    const transactions = this.filteredTransactions();

    return selectedIds.map((categoryId) => {
      const category = this.categories().find((item) => item.id === categoryId);
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

  protected readonly hasReportData = computed(() => this.filteredTransactions().length > 0);

  protected readonly reportRangeLabel = computed(() => this.formatRangeLabel(this.reportMonths()));

  protected readonly previousReportRangeLabel = computed(() =>
    this.formatRangeLabel(this.previousReportMonths()),
  );

  constructor() {
    this.loadReportData();
  }

  protected changePeriod(event: Event): void {
    const period = Number((event.target as HTMLSelectElement).value);

    if (period === 1 || period === 3 || period === 6 || period === 12) {
      this.selectedPeriod.set(period);
    }
  }

  protected changeYear(event: Event): void {
    const year = Number((event.target as HTMLSelectElement).value);

    if (!Number.isFinite(year)) {
      return;
    }

    this.selectedYear.set(year);
  }

  protected changeCategory(event: Event): void {
    const categoryId = (event.target as HTMLSelectElement).value;

    // El selector superior sigue siendo de selección única. El ranking admite varias.
    if (categoryId !== 'multiple') {
      this.selectedCategoryIds.set(categoryId === 'all' ? [] : [categoryId]);
    }
  }

  protected changePaymentMethod(event: Event): void {
    const paymentMethod = (event.target as HTMLSelectElement).value as PaymentMethodFilter;

    if (
      paymentMethod !== 'all' &&
      paymentMethod !== 'card' &&
      paymentMethod !== 'cash' &&
      paymentMethod !== 'bankTransfer'
    ) {
      return;
    }

    this.selectedPaymentMethod.set(paymentMethod);
  }

  protected toggleComparison(event: Event): void {
    this.comparisonEnabled.set((event.target as HTMLInputElement).checked);
  }

  protected clearAnalysisFilters(): void {
    this.selectedCategoryIds.set([]);
    this.selectedPaymentMethod.set('all');
  }

  protected clearRankingCategorySelection(): void {
    this.selectedCategoryIds.set([]);
  }

  protected isCategorySelected(categoryId: string): boolean {
    return this.selectedCategoryIds().includes(categoryId);
  }

  protected toggleRankingCategory(categoryId: string): void {
    this.selectedCategoryIds.update((selected) =>
      selected.includes(categoryId)
        ? selected.filter((id) => id !== categoryId)
        : [...selected, categoryId],
    );
  }

  protected formatCurrency(amount: number): string {
    return this.currencyFormatter.format(amount);
  }

  protected formatMoneyComparison(comparison: PercentageComparison): string {
    if (comparison.percentage === null) {
      return `Anterior (${this.previousReportRangeLabel()}): ${this.currencyFormatter.format(
        comparison.previousValue,
      )}`;
    }

    if (comparison.direction === 'same') {
      return `Sin cambios vs ${this.previousReportRangeLabel()}`;
    }

    return `${comparison.percentage.toFixed(1)} % vs ${this.previousReportRangeLabel()}`;
  }

  protected formatSavingsComparison(comparison: SavingsComparison): string {
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

  protected exportReportCsv(): void {
    if (!isPlatformBrowser(this.platformId) || !this.hasReportData()) {
      return;
    }

    const savingsRate = this.savingsRate();

    const rows: (string | number)[][] = [
      ['Finora - Informe financiero'],
      ['Periodo', this.reportRangeLabel()],
      ['Categoría', this.selectedCategoryLabel()],
      ['Método de pago', this.selectedPaymentMethodLabel()],
      ['Ingresos', this.totalIncome().toFixed(2)],
      ['Gastos', this.totalExpenses().toFixed(2)],
      ['Balance', this.netBalance().toFixed(2)],
      ['Tasa de ahorro', savingsRate === null ? 'No calculable' : `${savingsRate.toFixed(1)} %`],
      [],
      ['Fecha', 'Descripción', 'Tipo', 'Categoría', 'Método de pago', 'Importe', 'Notas'],
      ...this.filteredTransactions().map((transaction) => [
        transaction.date,
        transaction.description,
        transaction.type === 'income' ? 'Ingreso' : 'Gasto',
        this.getCategoryName(transaction.categoryId, transaction.categoryNameSnapshot),
        this.getPaymentMethodLabel(transaction.paymentMethod),
        transaction.amount.toFixed(2).replace('.', ','),
        transaction.notes ?? '',
      ]),
    ];

    const csv = rows
      .map((row) => row.map((value) => this.escapeCsvValue(value)).join(';'))
      .join('\r\n');

    const blob = new Blob([`\uFEFF${csv}`], {
      type: 'text/csv;charset=utf-8;',
    });

    const url = URL.createObjectURL(blob);
    const link = this.document.createElement('a');

    link.href = url;
    link.download = this.getExportFileName('csv');

    this.document.body.appendChild(link);

    link.click();
    link.remove();

    URL.revokeObjectURL(url);

    this.toastService.success('Informe CSV exportado correctamente.');
  }

  protected async exportReportPdf(): Promise<void> {
    if (!isPlatformBrowser(this.platformId) || !this.hasReportData() || this.isExportingPdf()) {
      return;
    }

    const reportElement = this.document.querySelector<HTMLElement>('.reports-page');

    if (!reportElement) {
      this.toastService.error('No se ha podido preparar el informe PDF.');
      return;
    }

    this.isExportingPdf.set(true);
    reportElement.classList.add('is-exporting');

    try {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 100);
      });

      const canvas = await html2canvas(reportElement, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      pdf.setProperties({
        title: `Finora - Informe ${this.reportRangeLabel()}`,
        subject: 'Informe financiero generado desde Finora',
        author: 'Finora',
      });

      const margin = 10;

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      const printableWidth = pageWidth - margin * 2;
      const printableHeight = pageHeight - margin * 2;

      const pixelsPerMillimeter = canvas.width / printableWidth;
      const pageHeightInPixels = Math.floor(printableHeight * pixelsPerMillimeter);

      let currentOffset = 0;
      let pageIndex = 0;

      while (currentOffset < canvas.height) {
        const sliceHeight = Math.min(pageHeightInPixels, canvas.height - currentOffset);

        const pageCanvas = this.document.createElement('canvas');

        pageCanvas.width = canvas.width;
        pageCanvas.height = sliceHeight;

        const context = pageCanvas.getContext('2d');

        if (!context) {
          throw new Error('No se ha podido generar el lienzo del PDF.');
        }

        context.drawImage(
          canvas,
          0,
          currentOffset,
          canvas.width,
          sliceHeight,
          0,
          0,
          canvas.width,
          sliceHeight,
        );

        if (pageIndex > 0) {
          pdf.addPage();
        }

        const imageHeight = sliceHeight / pixelsPerMillimeter;

        pdf.addImage(
          pageCanvas.toDataURL('image/png'),
          'PNG',
          margin,
          margin,
          printableWidth,
          imageHeight,
          undefined,
          'FAST',
        );

        currentOffset += sliceHeight;
        pageIndex++;
      }

      pdf.save(this.getExportFileName('pdf'));

      this.toastService.success('Informe PDF exportado correctamente.');
    } catch {
      this.toastService.error('No se ha podido generar el informe PDF.');
    } finally {
      reportElement.classList.remove('is-exporting');
      this.isExportingPdf.set(false);
    }
  }

  private loadReportData(): void {
    const userId = this.authService.currentUser()?.id;

    if (!userId) {
      this.isLoading.set(false);
      this.loadError.set('No se ha podido identificar al usuario actual.');
      return;
    }

    this.isLoading.set(true);
    this.loadError.set(null);

    forkJoin({
      transactions: this.transactionService.getTransactions(userId),
      categories: this.categoryService.getCategories(userId),
    })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isLoading.set(false)),
      )
      .subscribe({
        next: ({ transactions, categories }) => {
          this.transactions.set(transactions);
          this.categories.set(categories);
        },
        error: () => {
          this.loadError.set('No se han podido cargar los datos de tus informes.');
        },
      });
  }

  private applyReportFilters(transactions: Transaction[]): Transaction[] {
    const selectedIds = this.selectedCategoryIds();

    return this.applyPaymentMethodFilter(transactions).filter(
      (transaction) =>
        selectedIds.length === 0 || selectedIds.includes(transaction.categoryId ?? 'uncategorized'),
    );
  }

  private applyPaymentMethodFilter(transactions: Transaction[]): Transaction[] {
    const paymentMethod = this.selectedPaymentMethod();

    return paymentMethod === 'all'
      ? transactions
      : transactions.filter((transaction) => transaction.paymentMethod === paymentMethod);
  }

  private getExpenseDistribution(transactions: Transaction[]): ExpenseDistributionItem[] {
    const expenses = transactions.filter((transaction) => transaction.type === 'expense');
    const totalExpenses = this.getTransactionTotal(expenses, 'expense');

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
          : this.categories().find((currentCategory) => currentCategory.id === categoryId);

      return {
        categoryId: categoryId ?? 'uncategorized',
        categoryName: category?.name ?? 'Sin categoría',
        amount,
        percentage: (amount / totalExpenses) * 100,
        color: category?.color ?? '#6c757d',
      };
    }).sort((firstCategory, secondCategory) => secondCategory.amount - firstCategory.amount);
  }

  private getTransactionTotal(transactions: Transaction[], type: Transaction['type']): number {
    return transactions
      .filter((transaction) => transaction.type === type)
      .reduce((total, transaction) => total + transaction.amount, 0);
  }

  private getPercentageComparison(
    currentValue: number,
    previousValue: number,
  ): PercentageComparison {
    const direction: ComparisonDirection =
      currentValue > previousValue
        ? 'increase'
        : currentValue < previousValue
          ? 'decrease'
          : 'same';

    if (previousValue === 0) {
      return {
        previousValue,
        percentage: null,
        direction,
      };
    }

    const percentage = Math.abs(((currentValue - previousValue) / Math.abs(previousValue)) * 100);

    return {
      previousValue,
      percentage,
      direction,
    };
  }

  private getReportMonths(year: number, count: ReportPeriod): ReportMonth[] {
    const isCurrentYear = year === this.currentDate.getFullYear();
    const endMonth = isCurrentYear ? this.currentDate.getMonth() : 11;

    return this.getMonthsEndingAt(new Date(year, endMonth, 1), count);
  }

  private getMonthsEndingAt(referenceDate: Date, count: ReportPeriod): ReportMonth[] {
    const monthFormatter = new Intl.DateTimeFormat('es-ES', {
      month: 'short',
    });

    return Array.from({ length: count }, (_, index) => {
      const monthsAgo = count - 1 - index;
      const date = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - monthsAgo, 1);

      const month = monthFormatter.format(date).replace('.', '');
      const formattedMonth = month.charAt(0).toUpperCase() + month.slice(1);

      return {
        key: this.getMonthKey(date),
        label: formattedMonth,
      };
    });
  }

  private formatRangeLabel(months: ReportMonth[]): string {
    if (months.length === 0) {
      return '';
    }

    const firstMonth = months[0];
    const lastMonth = months[months.length - 1];

    const firstYear = firstMonth.key.slice(0, 4);
    const lastYear = lastMonth.key.slice(0, 4);

    if (months.length === 1) {
      return `${firstMonth.label} ${firstYear}`;
    }

    if (firstYear === lastYear) {
      return `${firstMonth.label} - ${lastMonth.label} ${lastYear}`;
    }

    return `${firstMonth.label} ${firstYear} - ${lastMonth.label} ${lastYear}`;
  }

  private getMonthKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  private getCategoryName(categoryId: string | null, snapshot?: string | null): string {
    const category = this.categories().find((item) => item.id === categoryId);
    if (category) return category.name;
    return snapshot?.trim() ? `${snapshot} (eliminada)` : 'Sin categoría';
  }

  private getPaymentMethodLabel(paymentMethod: Transaction['paymentMethod']): string {
    switch (paymentMethod) {
      case 'card':
        return 'Tarjeta';
      case 'cash':
        return 'Efectivo';
      case 'bankTransfer':
        return 'Transferencia';
    }
  }

  private escapeCsvValue(value: string | number): string {
    return `"${String(value).replace(/"/g, '""')}"`;
  }

  private getExportFileName(extension: 'csv' | 'pdf'): string {
    const months = this.reportMonths();

    const start = months[0]?.key ?? 'inicio';
    const end = months[months.length - 1]?.key ?? 'fin';

    return `finora-informe-${start}-${end}.${extension}`;
  }
}
