import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

import { AuthService } from '../../../auth/services/auth.service';
import { Budget, Category, Transaction } from '../../models';
import { BudgetService } from '../../services/budget.service';
import { CategoryService } from '../../services/category.service';
import { TransactionService } from '../../services/transaction.service';

@Injectable()
export class OverviewStateService {
  private readonly authService = inject(AuthService);
  private readonly transactionService = inject(TransactionService);
  private readonly categoryService = inject(CategoryService);
  private readonly budgetService = inject(BudgetService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly currentDate = new Date();
  private readonly monthFormatter = new Intl.DateTimeFormat('es-ES', {
    month: 'long',
  });

  private budgetRequestVersion = 0;

  readonly currentUser = this.authService.currentUser;

  readonly userName = computed(() => this.currentUser()?.username ?? 'Usuario');

  readonly selectedMonth = signal(
    new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), 1),
  );

  readonly selectedMonthKey = computed(() => {
    const date = this.selectedMonth();

    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  });

  readonly currentMonthLabel = computed(() => {
    const date = this.selectedMonth();
    const month = this.monthFormatter.format(date);
    const formattedMonth = month.charAt(0).toUpperCase() + month.slice(1);

    return `${formattedMonth} ${date.getFullYear()}`;
  });

  readonly canGoToNextMonth = computed(() => {
    const lastAllowedMonth = new Date(
      this.currentDate.getFullYear(),
      this.currentDate.getMonth(),
      1,
    );

    return this.selectedMonth().getTime() < lastAllowedMonth.getTime();
  });

  readonly transactions = signal<Transaction[]>([]);
  readonly categories = signal<Category[]>([]);
  readonly budgets = signal<Budget[]>([]);

  readonly isLoading = signal(true);
  readonly isLoadingBudgets = signal(true);

  readonly transactionLoadError = signal<string | null>(null);
  readonly categoryLoadError = signal<string | null>(null);
  readonly budgetLoadError = signal<string | null>(null);

  readonly loadError = computed(() => this.transactionLoadError() ?? this.categoryLoadError());

  constructor() {
    const userId = this.currentUser()?.id;

    if (!userId) {
      this.isLoading.set(false);
      this.isLoadingBudgets.set(false);
      this.transactionLoadError.set('No se ha podido identificar al usuario actual.');
      this.budgetLoadError.set('No se ha podido identificar al usuario actual.');
      return;
    }

    this.loadTransactions(userId);
    this.loadCategories(userId);
    this.loadBudgets();
  }

  previousMonth(): void {
    this.changeMonth(-1);
  }

  nextMonth(): void {
    if (!this.canGoToNextMonth()) {
      return;
    }

    this.changeMonth(1);
  }

  addTransaction(transaction: Transaction): void {
    this.transactions.update((transactions) => [transaction, ...transactions]);
  }

  private changeMonth(offset: number): void {
    const date = this.selectedMonth();

    this.selectedMonth.set(new Date(date.getFullYear(), date.getMonth() + offset, 1));

    this.loadBudgets();
  }

  private loadTransactions(userId: string): void {
    this.isLoading.set(true);
    this.transactionLoadError.set(null);

    this.transactionService
      .getTransactions(userId)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isLoading.set(false)),
      )
      .subscribe({
        next: (transactions) => this.transactions.set(transactions),
        error: () => {
          this.transactionLoadError.set('No se han podido cargar tus movimientos.');
        },
      });
  }

  private loadCategories(userId: string): void {
    this.categoryLoadError.set(null);

    this.categoryService
      .getCategories(userId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (categories) => this.categories.set(categories),
        error: () => {
          this.categoryLoadError.set('No se han podido cargar tus categorías.');
        },
      });
  }

  private loadBudgets(): void {
    const requestVersion = ++this.budgetRequestVersion;
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
        finalize(() => {
          if (requestVersion === this.budgetRequestVersion) {
            this.isLoadingBudgets.set(false);
          }
        }),
      )
      .subscribe({
        next: (budgets) => {
          if (requestVersion === this.budgetRequestVersion) {
            this.budgets.set(budgets);
          }
        },
        error: () => {
          if (requestVersion === this.budgetRequestVersion) {
            this.budgets.set([]);
            this.budgetLoadError.set('No se han podido cargar tus presupuestos.');
          }
        },
      });
  }
}
