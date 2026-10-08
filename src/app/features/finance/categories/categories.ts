import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, forkJoin, map, of, switchMap } from 'rxjs';

import { ConfirmDialog } from '../../../shared/ui/confirm-dialog/confirm-dialog';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { AuthService } from '../../auth/services/auth.service';
import { Budget, Category, Transaction } from '../models';
import { BudgetService } from '../services/budget.service';
import { CategoryService } from '../services/category.service';
import { TransactionService } from '../services/transaction.service';
import { CategoryForm, CategoryFormValue } from './category-form/category-form';

@Component({
  selector: 'app-categories',
  imports: [CategoryForm, ConfirmDialog],
  templateUrl: './categories.html',
  styleUrl: './categories.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Categories {
  private readonly authService = inject(AuthService);
  private readonly categoryService = inject(CategoryService);
  private readonly transactionService = inject(TransactionService);
  private readonly budgetService = inject(BudgetService);
  private readonly toastService = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly categories = signal<Category[]>([]);
  protected readonly transactions = signal<Transaction[]>([]);
  protected readonly budgets = signal<Budget[]>([]);

  protected readonly isLoadingCategories = signal(true);
  protected readonly isLoadingTransactions = signal(true);
  protected readonly isLoadingBudgets = signal(true);

  protected readonly categoryLoadError = signal<string | null>(null);
  protected readonly transactionLoadError = signal<string | null>(null);
  protected readonly budgetLoadError = signal<string | null>(null);

  protected readonly isCategoryFormOpen = signal(false);
  protected readonly categoryToEdit = signal<Category | null>(null);
  protected readonly categoryToDelete = signal<Category | null>(null);

  protected readonly isSavingCategory = signal(false);
  protected readonly deletingCategoryId = signal<string | null>(null);

  protected readonly categoryFormError = signal<string | null>(null);
  protected readonly deleteError = signal<string | null>(null);

  protected readonly isEditingCategory = computed(() => this.categoryToEdit() !== null);

  protected readonly isLoading = computed(
    () => this.isLoadingCategories() || this.isLoadingTransactions() || this.isLoadingBudgets(),
  );

  protected readonly loadError = computed(
    () => this.categoryLoadError() ?? this.transactionLoadError() ?? this.budgetLoadError(),
  );

  protected readonly totalCategories = computed(() => this.categories().length);

  private readonly categoryIds = computed(
    () => new Set(this.categories().map((category) => category.id)),
  );

  private readonly categoryIdsWithBudget = computed(
    () => new Set(this.budgets().map((budget) => budget.categoryId)),
  );

  protected readonly categorizedTransactions = computed(
    () =>
      this.transactions().filter(
        (transaction) =>
          transaction.categoryId !== null && this.categoryIds().has(transaction.categoryId),
      ).length,
  );

  protected readonly uncategorizedTransactions = computed(
    () => this.transactions().length - this.categorizedTransactions(),
  );

  protected readonly affectedTransactions = computed(() => {
    const category = this.categoryToDelete();

    if (!category) {
      return [];
    }

    return this.transactions().filter((transaction) => transaction.categoryId === category.id);
  });

  private readonly transactionCountByCategory = computed(() => {
    const counts = new Map<string, number>();

    for (const transaction of this.transactions()) {
      if (!transaction.categoryId) {
        continue;
      }

      counts.set(transaction.categoryId, (counts.get(transaction.categoryId) ?? 0) + 1);
    }

    return counts;
  });

  constructor() {
    this.loadCategories();
    this.loadTransactions();
    this.loadBudgets();
  }

  protected openCategoryForm(): void {
    this.categoryToEdit.set(null);
    this.categoryFormError.set(null);
    this.isCategoryFormOpen.set(true);
  }

  protected openEditCategory(category: Category): void {
    this.categoryToEdit.set(category);
    this.categoryFormError.set(null);
    this.isCategoryFormOpen.set(true);
  }

  protected requestDeleteCategory(category: Category): void {
    const userId = this.authService.currentUser()?.id;

    if (!userId) {
      this.toastService.warning('No se ha podido identificar al usuario actual.');
      return;
    }

    if (category.userId !== userId) {
      this.toastService.warning('No puedes eliminar esta categoría.');
      return;
    }

    if (this.isLoadingBudgets()) {
      this.toastService.info('Espera a que termine de cargarse la información de presupuestos.');
      return;
    }

    if (this.budgetLoadError()) {
      this.toastService.warning(
        'No se puede eliminar la categoría porque no se ha podido comprobar si tiene presupuestos asociados.',
      );
      return;
    }

    if (this.hasBudget(category.id)) {
      this.toastService.warning(
        `La categoría "${category.name}" tiene un presupuesto asociado. Elimina o modifica primero ese presupuesto.`,
      );
      return;
    }

    this.deleteError.set(null);
    this.categoryToDelete.set(category);
  }

  protected cancelDeleteCategory(): void {
    if (this.deletingCategoryId()) {
      return;
    }

    this.categoryToDelete.set(null);
    this.deleteError.set(null);
  }

  protected confirmDeleteCategory(): void {
    const category = this.categoryToDelete();

    if (!category || this.deletingCategoryId()) {
      return;
    }

    const userId = this.authService.currentUser()?.id;

    if (!userId || category.userId !== userId) {
      this.deleteError.set('No puedes eliminar esta categoría.');
      return;
    }

    if (this.hasBudget(category.id)) {
      this.deleteError.set(
        'Esta categoría tiene un presupuesto asociado. Elimina o modifica primero ese presupuesto.',
      );
      return;
    }

    const affectedTransactions = this.affectedTransactions();

    this.deletingCategoryId.set(category.id);
    this.deleteError.set(null);

    const unlinkTransactionsRequest =
      affectedTransactions.length === 0
        ? of([] as Transaction[])
        : forkJoin(
            affectedTransactions.map((transaction) =>
              this.transactionService.updateTransaction(transaction.id, {
                categoryId: null,
              }),
            ),
          );

    unlinkTransactionsRequest
      .pipe(
        switchMap((updatedTransactions) =>
          this.categoryService.deleteCategory(category.id).pipe(map(() => updatedTransactions)),
        ),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.deletingCategoryId.set(null)),
      )
      .subscribe({
        next: (updatedTransactions) => {
          const updatedTransactionsById = new Map(
            updatedTransactions.map((transaction) => [transaction.id, transaction]),
          );

          this.transactions.update((transactions) =>
            transactions.map(
              (transaction) => updatedTransactionsById.get(transaction.id) ?? transaction,
            ),
          );

          this.categories.update((categories) =>
            categories.filter((currentCategory) => currentCategory.id !== category.id),
          );

          this.categoryToDelete.set(null);
          this.deleteError.set(null);

          this.toastService.success('Categoría eliminada correctamente.');
        },
        error: () => {
          this.deleteError.set(
            'No se ha podido completar la eliminación. Se volverán a cargar los datos para mantenerlos sincronizados.',
          );

          this.reloadAfterDeleteFailure();
        },
      });
  }

  protected closeCategoryForm(): void {
    if (this.isSavingCategory()) {
      return;
    }

    this.categoryToEdit.set(null);
    this.categoryFormError.set(null);
    this.isCategoryFormOpen.set(false);
  }

  protected saveCategory(formValue: CategoryFormValue): void {
    const userId = this.authService.currentUser()?.id;

    if (!userId) {
      this.categoryFormError.set('No se ha podido identificar al usuario actual.');
      return;
    }

    const normalizedName = formValue.name.trim();
    const categoryToEdit = this.categoryToEdit();

    const categoryAlreadyExists = this.categories().some(
      (category) =>
        category.id !== categoryToEdit?.id &&
        category.name.trim().toLocaleLowerCase('es-ES') ===
          normalizedName.toLocaleLowerCase('es-ES'),
    );

    if (categoryAlreadyExists) {
      this.categoryFormError.set('Ya existe una categoría con ese nombre.');
      return;
    }

    if (categoryToEdit && categoryToEdit.userId !== userId) {
      this.categoryFormError.set('No puedes editar esta categoría.');
      return;
    }

    this.isSavingCategory.set(true);
    this.categoryFormError.set(null);

    const categoryRequest = categoryToEdit
      ? this.categoryService.updateCategory(categoryToEdit.id, {
          name: normalizedName,
          icon: formValue.icon,
          color: formValue.color,
        })
      : this.categoryService.createCategory({
          userId,
          name: normalizedName,
          icon: formValue.icon,
          color: formValue.color,
        });

    categoryRequest
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isSavingCategory.set(false)),
      )
      .subscribe({
        next: (category) => {
          if (categoryToEdit) {
            this.categories.update((categories) =>
              categories.map((currentCategory) =>
                currentCategory.id === category.id ? category : currentCategory,
              ),
            );

            this.toastService.success('Categoría actualizada correctamente.');
          } else {
            this.categories.update((categories) => [...categories, category]);

            this.toastService.success('Categoría creada correctamente.');
          }

          this.categoryToEdit.set(null);
          this.isCategoryFormOpen.set(false);
        },
        error: () => {
          this.categoryFormError.set(
            categoryToEdit
              ? 'No se ha podido actualizar la categoría. Inténtalo de nuevo.'
              : 'No se ha podido crear la categoría. Inténtalo de nuevo.',
          );
        },
      });
  }

  protected getTransactionCount(categoryId: string): number {
    return this.transactionCountByCategory().get(categoryId) ?? 0;
  }

  protected hasBudget(categoryId: string): boolean {
    return this.categoryIdsWithBudget().has(categoryId);
  }

  protected getCategoryIconClass(category: Category): string {
    if (category.icon.startsWith('bi ')) {
      return category.icon;
    }

    if (category.icon.startsWith('bi-')) {
      return `bi ${category.icon}`;
    }

    return 'bi bi-tag';
  }

  private reloadAfterDeleteFailure(): void {
    this.loadCategories();
    this.loadTransactions();
  }

  private loadCategories(): void {
    const userId = this.authService.currentUser()?.id;

    if (!userId) {
      this.isLoadingCategories.set(false);
      this.categoryLoadError.set('No se ha podido identificar al usuario actual.');
      return;
    }

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
          this.categoryLoadError.set('No se han podido cargar tus categorías.');
        },
      });
  }

  private loadTransactions(): void {
    const userId = this.authService.currentUser()?.id;

    if (!userId) {
      this.isLoadingTransactions.set(false);
      this.transactionLoadError.set('No se ha podido identificar al usuario actual.');
      return;
    }

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
          this.transactionLoadError.set('No se ha podido calcular el uso de las categorías.');
        },
      });
  }

  private loadBudgets(): void {
    const userId = this.authService.currentUser()?.id;

    if (!userId) {
      this.isLoadingBudgets.set(false);
      this.budgetLoadError.set('No se ha podido identificar al usuario actual.');
      return;
    }

    this.budgetLoadError.set(null);

    this.budgetService
      .getBudgetsByUser(userId)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isLoadingBudgets.set(false)),
      )
      .subscribe({
        next: (budgets) => {
          this.budgets.set(budgets);
        },
        error: () => {
          this.budgetLoadError.set(
            'No se ha podido comprobar el uso de las categorías en tus presupuestos.',
          );
        },
      });
  }
}
