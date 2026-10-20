import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, Observable, tap } from 'rxjs';

import { AuthService } from '../../../auth/services/auth.service';
import { Budget, Category, Transaction } from '../../models';
import { BudgetService } from '../../services/budget.service';
import { CategoryService } from '../../services/category.service';
import { TransactionService } from '../../services/transaction.service';

type CategoryValues = Pick<Category, 'name' | 'icon' | 'color'>;

@Injectable()
export class CategoriesStateService {
  private readonly authService = inject(AuthService);
  private readonly categoryService = inject(CategoryService);
  private readonly transactionService = inject(TransactionService);
  private readonly budgetService = inject(BudgetService);
  private readonly destroyRef = inject(DestroyRef);

  readonly categories = signal<Category[]>([]);
  readonly transactions = signal<Transaction[]>([]);
  readonly budgets = signal<Budget[]>([]);

  readonly isLoadingCategories = signal(true);
  readonly isLoadingTransactions = signal(true);
  readonly isLoadingBudgets = signal(true);

  readonly categoryLoadError = signal<string | null>(null);
  readonly transactionLoadError = signal<string | null>(null);
  readonly budgetLoadError = signal<string | null>(null);

  readonly currentUserId = computed(() => this.authService.currentUser()?.id ?? null);

  readonly isLoading = computed(
    () => this.isLoadingCategories() || this.isLoadingTransactions() || this.isLoadingBudgets(),
  );

  readonly loadError = computed(
    () => this.categoryLoadError() ?? this.transactionLoadError() ?? this.budgetLoadError(),
  );

  readonly totalCategories = computed(() => this.categories().length);

  private readonly categoryIds = computed(
    () => new Set(this.categories().map((category) => category.id)),
  );

  private readonly categoryIdsWithBudget = computed(
    () => new Set(this.budgets().map((budget) => budget.categoryId)),
  );

  readonly categorizedTransactions = computed(
    () =>
      this.transactions().filter(
        (transaction) =>
          transaction.categoryId !== null && this.categoryIds().has(transaction.categoryId),
      ).length,
  );

  readonly uncategorizedTransactions = computed(
    () => this.transactions().length - this.categorizedTransactions(),
  );

  private readonly transactionCounts = computed(() => {
    const counts = new Map<string, number>();

    for (const transaction of this.transactions()) {
      if (transaction.categoryId) {
        counts.set(transaction.categoryId, (counts.get(transaction.categoryId) ?? 0) + 1);
      }
    }

    return counts;
  });

  constructor() {
    const userId = this.currentUserId();

    if (!userId) {
      this.isLoadingCategories.set(false);
      this.isLoadingTransactions.set(false);
      this.isLoadingBudgets.set(false);

      this.categoryLoadError.set('No se ha podido identificar al usuario actual.');
      return;
    }

    this.loadCategories(userId);
    this.loadTransactions(userId);
    this.loadBudgets(userId);
  }

  getTransactionCount(categoryId: string): number {
    return this.transactionCounts().get(categoryId) ?? 0;
  }

  hasBudget(categoryId: string): boolean {
    return this.categoryIdsWithBudget().has(categoryId);
  }

  hasDuplicateName(name: string, excludedId?: string): boolean {
    const normalizedName = name.trim().toLocaleLowerCase('es-ES');

    return this.categories().some(
      (category) =>
        category.id !== excludedId &&
        category.name.trim().toLocaleLowerCase('es-ES') === normalizedName,
    );
  }

  createCategory(userId: string, values: CategoryValues): Observable<Category> {
    return this.categoryService.createCategory({ userId, ...values }).pipe(
      tap((category) => {
        this.categories.update((categories) => [...categories, category]);
      }),
    );
  }

  updateCategory(categoryId: string, values: CategoryValues): Observable<Category> {
    return this.categoryService.updateCategory(categoryId, values).pipe(
      tap((updatedCategory) => {
        this.categories.update((categories) =>
          categories.map((category) =>
            category.id === updatedCategory.id ? updatedCategory : category,
          ),
        );
      }),
    );
  }

  applyDeletedCategory(categoryId: string, updatedTransactions: Transaction[]): void {
    const updatedById = new Map(
      updatedTransactions.map((transaction) => [transaction.id, transaction]),
    );

    this.transactions.update((transactions) =>
      transactions.map((transaction) => updatedById.get(transaction.id) ?? transaction),
    );

    this.categories.update((categories) =>
      categories.filter((category) => category.id !== categoryId),
    );
  }

  reloadAfterDeleteFailure(): void {
    const userId = this.currentUserId();

    if (!userId) {
      return;
    }

    this.loadCategories(userId);
    this.loadTransactions(userId);
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
        next: (categories) => this.categories.set(categories),
        error: () => this.categoryLoadError.set('No se han podido cargar tus categorías.'),
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
        next: (transactions) => this.transactions.set(transactions),
        error: () =>
          this.transactionLoadError.set('No se ha podido calcular el uso de las categorías.'),
      });
  }

  private loadBudgets(userId: string): void {
    this.isLoadingBudgets.set(true);
    this.budgetLoadError.set(null);

    this.budgetService
      .getBudgetsByUser(userId)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isLoadingBudgets.set(false)),
      )
      .subscribe({
        next: (budgets) => this.budgets.set(budgets),
        error: () =>
          this.budgetLoadError.set(
            'No se ha podido comprobar el uso de las categorías en tus presupuestos.',
          ),
      });
  }
}
