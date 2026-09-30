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
import { Category, Transaction } from '../models';
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
  private readonly destroyRef = inject(DestroyRef);

  private readonly currentDate = new Date();

  private readonly currentMonthKey = `${this.currentDate.getFullYear()}-${String(
    this.currentDate.getMonth() + 1,
  ).padStart(2, '0')}`;

  private readonly recentMonths = this.getRecentMonths(6);

  private readonly recentMonthKeys = new Set(this.recentMonths.map((month) => month.key));

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

  protected readonly isLoading = signal(true);

  protected readonly loadError = signal<string | null>(null);

  protected readonly isTransactionFormOpen = signal(false);

  protected readonly userName = computed(() => this.currentUser()?.username ?? 'Usuario');

  protected readonly currentMonthLabel = this.getCurrentMonthLabel();

  protected readonly monthlyTransactions = computed(() =>
    this.transactions().filter((transaction) => transaction.date.startsWith(this.currentMonthKey)),
  );

  protected readonly latestTransactions = computed(() =>
    [...this.transactions()]
      .sort((firstTransaction, secondTransaction) =>
        secondTransaction.date.localeCompare(firstTransaction.date),
      )
      .slice(0, 5),
  );

  protected readonly availableBalance = computed(() =>
    this.transactions().reduce((balance, transaction) => {
      return transaction.type === 'income'
        ? balance + transaction.amount
        : balance - transaction.amount;
    }, 0),
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

    for (const transaction of this.transactions()) {
      const monthKey = transaction.date.slice(0, 7);

      if (!this.recentMonthKeys.has(monthKey)) {
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

    return this.recentMonths.map((month) => {
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

    const amountsByCategory = new Map<string, number>();

    for (const transaction of expenses) {
      const currentAmount = amountsByCategory.get(transaction.categoryId) ?? 0;

      amountsByCategory.set(transaction.categoryId, currentAmount + transaction.amount);
    }

    return Array.from(amountsByCategory.entries(), ([categoryId, amount]) => {
      const category = this.categories().find(
        (currentCategory) => currentCategory.id === categoryId,
      );

      return {
        categoryId,
        categoryName: category?.name ?? 'Sin categoría',
        amount,
        percentage: (amount / totalExpenses) * 100,
        color: category?.color ?? '#6c757d',
      };
    }).sort((firstCategory, secondCategory) => secondCategory.amount - firstCategory.amount);
  });

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

  protected getCategoryName(categoryId: string): string {
    return (
      this.categories().find((category) => category.id === categoryId)?.name ?? 'Sin categoría'
    );
  }

  protected formatTransactionAmount(transaction: Transaction): string {
    const amount = this.currencyFormatter.format(transaction.amount);

    return transaction.type === 'income' ? `+${amount}` : `-${amount}`;
  }

  protected formatTransactionDate(date: string): string {
    if (date === this.getTodayDate()) {
      return 'Hoy';
    }

    const [year, month, day] = date.split('-').map(Number);

    return this.dateFormatter.format(new Date(year, month - 1, day));
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

  private getRecentMonths(count: number): {
    key: string;
    label: string;
  }[] {
    const monthFormatter = new Intl.DateTimeFormat('es-ES', {
      month: 'short',
    });

    return Array.from({ length: count }, (_, index) => {
      const monthsAgo = count - 1 - index;

      const date = new Date(
        this.currentDate.getFullYear(),
        this.currentDate.getMonth() - monthsAgo,
        1,
      );

      const month = monthFormatter.format(date).replace('.', '');

      const label = month.charAt(0).toUpperCase() + month.slice(1);

      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      return {
        key,
        label,
      };
    });
  }

  private getCurrentMonthLabel(): string {
    const month = new Intl.DateTimeFormat('es-ES', {
      month: 'long',
    }).format(this.currentDate);

    const formattedMonth = month.charAt(0).toUpperCase() + month.slice(1);

    return `${formattedMonth} ${this.currentDate.getFullYear()}`;
  }

  private getTodayDate(): string {
    const year = this.currentDate.getFullYear();

    const month = String(this.currentDate.getMonth() + 1).padStart(2, '0');

    const day = String(this.currentDate.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }
}
