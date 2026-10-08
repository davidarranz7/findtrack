import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

import { AuthService } from '../../auth/services/auth.service';
import {
  ExpenseDistributionChart,
  type ExpenseDistributionItem,
} from '../charts/expense-distribution-chart/expense-distribution-chart';
import {
  IncomeExpenseChart,
  type IncomeExpenseChartItem,
} from '../charts/income-expense-chart/income-expense-chart';
import { Budget, Category, Transaction } from '../models';
import { BudgetAnalysisService } from '../services/budget-analysis.service';
import { BudgetService } from '../services/budget.service';
import { CategoryService } from '../services/category.service';
import { TransactionService } from '../services/transaction.service';
import { TransactionForm } from '../transactions/transaction-form/transaction-form';

@Component({
  selector: 'app-overview',
  imports: [TransactionForm, ExpenseDistributionChart, IncomeExpenseChart],
  templateUrl: './overview.html',
  styleUrl: './overview.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Overview {
  private readonly authService = inject(AuthService);
  private readonly transactionService = inject(TransactionService);
  private readonly categoryService = inject(CategoryService);
  private readonly budgetService = inject(BudgetService);
  private readonly budgetAnalysisService = inject(BudgetAnalysisService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly currentDate = new Date();

  private readonly selectedMonth = signal(
    new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), 1),
  );

  private readonly selectedMonthKey = computed(() => this.getMonthKey(this.selectedMonth()));

  private readonly recentMonths = computed(() => this.getRecentMonths(this.selectedMonth(), 6));

  private readonly recentMonthKeys = computed(
    () => new Set(this.recentMonths().map((month) => month.key)),
  );

  private readonly currencyFormatter = new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  });

  private readonly dateFormatter = new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'short',
  });

  protected readonly currentUser = this.authService.currentUser;

  protected readonly transactions = signal<Transaction[]>([]);

  protected readonly categories = signal<Category[]>([]);

  protected readonly budgets = signal<Budget[]>([]);

  protected readonly isLoading = signal(true);

  protected readonly isLoadingBudgets = signal(true);

  protected readonly loadError = signal<string | null>(null);

  protected readonly budgetLoadError = signal<string | null>(null);

  protected readonly isTransactionFormOpen = signal(false);

  protected readonly userName = computed(() => this.currentUser()?.username ?? 'Usuario');

  protected get currentMonthLabel(): string {
    return this.getMonthLabel(this.selectedMonth());
  }

  protected readonly monthlyTransactions = computed(() =>
    this.transactions().filter((transaction) =>
      transaction.date.startsWith(this.selectedMonthKey()),
    ),
  );

  protected readonly transactionsUpToSelectedMonth = computed(() =>
    this.transactions().filter(
      (transaction) => transaction.date.slice(0, 7) <= this.selectedMonthKey(),
    ),
  );

  protected readonly latestTransactions = computed(() =>
    [...this.monthlyTransactions()]
      .sort((firstTransaction, secondTransaction) =>
        secondTransaction.date.localeCompare(firstTransaction.date),
      )
      .slice(0, 5),
  );

  protected readonly availableBalance = computed(() =>
    this.transactionsUpToSelectedMonth().reduce(
      (balance, transaction) =>
        transaction.type === 'income' ? balance + transaction.amount : balance - transaction.amount,
      0,
    ),
  );

  protected readonly monthlyIncome = computed(() =>
    this.monthlyTransactions()
      .filter((transaction) => transaction.type === 'income')
      .reduce((total, transaction) => total + transaction.amount, 0),
  );

  protected readonly monthlyExpenses = computed(() =>
    this.monthlyTransactions()
      .filter((transaction) => transaction.type === 'expense')
      .reduce((total, transaction) => total + transaction.amount, 0),
  );

  protected readonly monthlySavings = computed(() => this.monthlyIncome() - this.monthlyExpenses());

  protected readonly incomeExpenseHistory = computed<IncomeExpenseChartItem[]>(() => {
    const totalsByMonth = new Map<
      string,
      {
        income: number;
        expense: number;
      }
    >();

    const recentMonthKeys = this.recentMonthKeys();

    for (const transaction of this.transactions()) {
      const monthKey = transaction.date.slice(0, 7);

      if (!recentMonthKeys.has(monthKey)) {
        continue;
      }

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

    return this.recentMonths().map((month) => {
      const totals = totalsByMonth.get(month.key);

      return {
        label: month.label,
        income: totals?.income ?? 0,
        expense: totals?.expense ?? 0,
      };
    });
  });

  protected readonly hasIncomeExpenseData = computed(() =>
    this.incomeExpenseHistory().some((month) => month.income > 0 || month.expense > 0),
  );

  protected readonly expenseDistribution = computed<ExpenseDistributionItem[]>(() => {
    const expenses = this.monthlyTransactions().filter(
      (transaction) => transaction.type === 'expense',
    );

    const totalExpenses = this.monthlyExpenses();

    if (expenses.length === 0 || totalExpenses === 0) {
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
  });

  protected readonly budgetProgress = computed(() =>
    this.budgetAnalysisService.getBudgetProgress(
      this.budgets(),
      this.transactions(),
      this.categories(),
      this.selectedMonthKey(),
    ),
  );

  protected readonly budgetAlert = computed(() =>
    this.budgetAnalysisService.getBudgetAlert(this.budgetProgress()),
  );

  protected readonly formattedBalance = computed(() =>
    this.currencyFormatter.format(this.availableBalance()),
  );

  protected readonly formattedIncome = computed(() =>
    this.currencyFormatter.format(this.monthlyIncome()),
  );

  protected readonly formattedExpenses = computed(() =>
    this.currencyFormatter.format(this.monthlyExpenses()),
  );

  protected readonly formattedSavings = computed(() =>
    this.currencyFormatter.format(this.monthlySavings()),
  );

  constructor() {
    this.loadTransactions();
    this.loadCategories();
    this.loadBudgets();
  }

  protected previousMonth(): void {
    this.changeMonth(-1);
  }

  protected canGoToNextMonth(): boolean {
    const selectedMonth = this.selectedMonth();

    return (
      selectedMonth.getFullYear() < this.currentDate.getFullYear() ||
      (selectedMonth.getFullYear() === this.currentDate.getFullYear() &&
        selectedMonth.getMonth() < this.currentDate.getMonth())
    );
  }

  protected nextMonth(): void {
    if (!this.canGoToNextMonth()) {
      return;
    }

    this.changeMonth(1);
  }

  protected openTransactionForm(): void {
    this.isTransactionFormOpen.set(true);
  }

  protected closeTransactionForm(): void {
    this.isTransactionFormOpen.set(false);
  }

  protected handleTransactionCreated(transaction: Transaction): void {
    this.transactions.update((transactions) => [transaction, ...transactions]);

    this.closeTransactionForm();
  }

  protected getCategoryName(categoryId: string | null): string {
    if (!categoryId) {
      return 'Sin categoría';
    }

    return (
      this.categories().find((category) => category.id === categoryId)?.name ?? 'Sin categoría'
    );
  }

  protected formatTransactionAmount(transaction: Transaction): string {
    const amount = this.currencyFormatter.format(transaction.amount);

    return transaction.type === 'income' ? `+${amount}` : `-${amount}`;
  }

  protected formatCurrency(amount: number): string {
    return this.currencyFormatter.format(amount);
  }

  protected formatTransactionDate(date: string): string {
    if (date === this.getTodayDate()) {
      return 'Hoy';
    }

    const [year, month, day] = date.split('-').map(Number);

    return this.dateFormatter.format(new Date(year, month - 1, day));
  }

  private changeMonth(offset: number): void {
    const currentMonth = this.selectedMonth();

    this.selectedMonth.set(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + offset, 1),
    );

    this.loadBudgets();
  }

  private loadTransactions(): void {
    const userId = this.currentUser()?.id;

    if (!userId) {
      this.isLoading.set(false);

      this.loadError.set('No se ha podido identificar al usuario actual.');

      return;
    }

    this.transactionService
      .getTransactions(userId)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isLoading.set(false)),
      )
      .subscribe({
        next: (transactions) => {
          this.transactions.set(transactions);
        },
        error: () => {
          this.loadError.set('No se han podido cargar tus movimientos.');
        },
      });
  }

  private loadCategories(): void {
    const userId = this.currentUser()?.id;

    if (!userId) {
      return;
    }

    this.categoryService
      .getCategories(userId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (categories) => {
          this.categories.set(categories);
        },
      });
  }

  private loadBudgets(): void {
    const userId = this.currentUser()?.id;

    if (!userId) {
      this.isLoadingBudgets.set(false);

      this.budgetLoadError.set('No se ha podido identificar al usuario actual.');

      return;
    }

    this.isLoadingBudgets.set(true);
    this.budgetLoadError.set(null);

    this.budgetService
      .getBudgets(userId, this.selectedMonthKey())
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isLoadingBudgets.set(false)),
      )
      .subscribe({
        next: (budgets) => {
          this.budgets.set(budgets);
        },
        error: () => {
          this.budgets.set([]);

          this.budgetLoadError.set('No se han podido cargar tus presupuestos.');
        },
      });
  }

  private getRecentMonths(
    referenceDate: Date,
    count: number,
  ): {
    key: string;
    label: string;
  }[] {
    const monthFormatter = new Intl.DateTimeFormat('es-ES', {
      month: 'short',
    });

    return Array.from({ length: count }, (_, index) => {
      const monthsAgo = count - 1 - index;

      const date = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - monthsAgo, 1);

      const month = monthFormatter.format(date).replace('.', '');

      const label = month.charAt(0).toUpperCase() + month.slice(1);

      return {
        key: this.getMonthKey(date),
        label,
      };
    });
  }

  private getMonthKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  private getMonthLabel(date: Date): string {
    const month = new Intl.DateTimeFormat('es-ES', {
      month: 'long',
    }).format(date);

    const formattedMonth = month.charAt(0).toUpperCase() + month.slice(1);

    return `${formattedMonth} ${date.getFullYear()}`;
  }

  private getTodayDate(): string {
    const year = this.currentDate.getFullYear();

    const month = String(this.currentDate.getMonth() + 1).padStart(2, '0');

    const day = String(this.currentDate.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }
}
