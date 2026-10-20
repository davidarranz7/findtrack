import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, Observable, tap } from 'rxjs';

import { AuthService } from '../../../auth/services/auth.service';
import { Budget, Category, Transaction } from '../../models';
import { BudgetService } from '../../services/budget.service';
import { CategoryService } from '../../services/category.service';
import { TransactionService } from '../../services/transaction.service';

@Injectable()
export class BudgetsStateService {
  private readonly authService = inject(AuthService);
  private readonly budgetService = inject(BudgetService);
  private readonly categoryService = inject(CategoryService);
  private readonly transactionService = inject(TransactionService);
  private readonly destroyRef = inject(DestroyRef);

  readonly budgets = signal<Budget[]>([]);
  readonly categories = signal<Category[]>([]);
  readonly transactions = signal<Transaction[]>([]);

  readonly isLoadingBudgets = signal(true);
  readonly isLoadingCategories = signal(true);
  readonly isLoadingTransactions = signal(true);

  readonly budgetLoadError = signal<string | null>(null);
  readonly categoryLoadError = signal<string | null>(null);
  readonly transactionLoadError = signal<string | null>(null);

  readonly selectedMonth = signal(this.getMonthKey(new Date()));

  readonly currentUserId = computed(() => this.authService.currentUser()?.id ?? null);

  readonly isLoading = computed(
    () => this.isLoadingBudgets() || this.isLoadingCategories() || this.isLoadingTransactions(),
  );

  readonly loadError = computed(
    () => this.budgetLoadError() ?? this.categoryLoadError() ?? this.transactionLoadError(),
  );

  readonly unavailableCategoryIds = computed(() =>
    this.budgets().map((budget) => budget.categoryId),
  );

  readonly canCreateBudget = computed(() =>
    this.categories().some((category) => !this.unavailableCategoryIds().includes(category.id)),
  );

  constructor() {
    const userId = this.currentUserId();

    if (!userId) {
      this.isLoadingBudgets.set(false);
      this.isLoadingCategories.set(false);
      this.isLoadingTransactions.set(false);
      this.budgetLoadError.set('No se ha podido identificar al usuario actual.');
      return;
    }

    this.loadBudgets(userId);
    this.loadCategories(userId);
    this.loadTransactions(userId);
  }

  selectMonth(month: string): void {
    if (!month || month === this.selectedMonth()) {
      return;
    }

    this.selectedMonth.set(month);

    const userId = this.currentUserId();

    if (!userId) {
      this.budgetLoadError.set('No se ha podido identificar al usuario actual.');
      return;
    }

    this.loadBudgets(userId);
  }

  createBudget(userId: string, categoryId: string, amount: number): Observable<Budget> {
    return this.budgetService
      .createBudget({
        userId,
        categoryId,
        amount,
        month: this.selectedMonth(),
      })
      .pipe(
        tap((createdBudget) => {
          this.budgets.update((budgets) => [...budgets, createdBudget]);
        }),
      );
  }

  updateBudget(budgetId: string, amount: number): Observable<Budget> {
    return this.budgetService.updateBudget(budgetId, { amount }).pipe(
      tap((updatedBudget) => {
        this.budgets.update((budgets) =>
          budgets.map((budget) => (budget.id === updatedBudget.id ? updatedBudget : budget)),
        );
      }),
    );
  }

  deleteBudget(budgetId: string): Observable<void> {
    return this.budgetService.deleteBudget(budgetId).pipe(
      tap(() => {
        this.budgets.update((budgets) => budgets.filter((budget) => budget.id !== budgetId));
      }),
    );
  }

  private loadBudgets(userId: string): void {
    this.isLoadingBudgets.set(true);
    this.budgetLoadError.set(null);

    this.budgetService
      .getBudgets(userId, this.selectedMonth())
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

  private loadCategories(userId: string): void {
    this.isLoadingCategories.set(true);
    this.categoryLoadError.set(null);

    this.categoryService
      .getCategories(userId)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isLoadingCategories.set(false)),
      )
      .subscribe({
        next: (categories) => {
          this.categories.set(categories);
        },
        error: () => {
          this.categories.set([]);
          this.categoryLoadError.set('No se han podido cargar tus categorías.');
        },
      });
  }

  private loadTransactions(userId: string): void {
    this.isLoadingTransactions.set(true);
    this.transactionLoadError.set(null);

    this.transactionService
      .getTransactions(userId)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isLoadingTransactions.set(false)),
      )
      .subscribe({
        next: (transactions) => {
          this.transactions.set(transactions);
        },
        error: () => {
          this.transactions.set([]);
          this.transactionLoadError.set('No se han podido cargar tus transacciones.');
        },
      });
  }

  private getMonthKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');

    return `${year}-${month}`;
  }
}
