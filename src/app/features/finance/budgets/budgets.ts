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
import { ConfirmDialog } from '../../../shared/ui/confirm-dialog/confirm-dialog';
import { Budget, Category, Transaction } from '../models';
import { BudgetService } from '../services/budget.service';
import { CategoryService } from '../services/category.service';
import { TransactionService } from '../services/transaction.service';
import { BudgetForm, BudgetFormValue } from './budget-form/budget-form';

type BudgetStatus = 'normal' | 'warning' | 'exceeded';

interface BudgetItem {
  budget: Budget;
  category: Category | null;
  spent: number;
  remaining: number;
  percentage: number;
  progressBarPercentage: number;
  status: BudgetStatus;
}

@Component({
  selector: 'app-budgets',
  imports: [BudgetForm, ConfirmDialog],
  templateUrl: './budgets.html',
  styleUrl: './budgets.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Budgets {
  private readonly authService = inject(AuthService);
  private readonly budgetService = inject(BudgetService);
  private readonly categoryService = inject(CategoryService);
  private readonly transactionService = inject(TransactionService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly currentDate = new Date();

  private readonly currencyFormatter = new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  });

  protected readonly budgets = signal<Budget[]>([]);
  protected readonly categories = signal<Category[]>([]);
  protected readonly transactions = signal<Transaction[]>([]);

  protected readonly isLoadingBudgets = signal(true);
  protected readonly isLoadingCategories = signal(true);
  protected readonly isLoadingTransactions = signal(true);

  protected readonly budgetLoadError = signal<string | null>(null);
  protected readonly categoryLoadError = signal<string | null>(null);
  protected readonly transactionLoadError = signal<string | null>(null);

  protected readonly selectedMonth = signal(this.getMonthKey(this.currentDate));

  protected readonly isBudgetFormOpen = signal(false);
  protected readonly selectedBudget = signal<Budget | null>(null);
  protected readonly isSavingBudget = signal(false);
  protected readonly budgetFormError = signal<string | null>(null);

  protected readonly budgetToDelete = signal<Budget | null>(null);
  protected readonly isDeletingBudget = signal(false);
  protected readonly budgetDeleteError = signal<string | null>(null);

  protected readonly isLoading = computed(
    () => this.isLoadingBudgets() || this.isLoadingCategories() || this.isLoadingTransactions(),
  );

  protected readonly loadError = computed(
    () => this.budgetLoadError() ?? this.categoryLoadError() ?? this.transactionLoadError(),
  );

  protected readonly selectedMonthLabel = computed(() => this.getMonthLabel(this.selectedMonth()));

  protected readonly unavailableCategoryIds = computed(() =>
    this.budgets().map((budget) => budget.categoryId),
  );

  protected readonly canCreateBudget = computed(() =>
    this.categories().some((category) => !this.unavailableCategoryIds().includes(category.id)),
  );

  protected readonly budgetToDeleteCategoryName = computed(() => {
    const budget = this.budgetToDelete();

    if (!budget) {
      return '';
    }

    return (
      this.categories().find((category) => category.id === budget.categoryId)?.name ??
      'esta categoría'
    );
  });

  protected readonly monthlyExpenses = computed(() =>
    this.transactions().filter(
      (transaction) =>
        transaction.type === 'expense' && transaction.date.startsWith(this.selectedMonth()),
    ),
  );

  protected readonly budgetItems = computed<BudgetItem[]>(() =>
    this.budgets().map((budget) => {
      const category =
        this.categories().find((currentCategory) => currentCategory.id === budget.categoryId) ??
        null;

      const spent = this.monthlyExpenses()
        .filter((transaction) => transaction.categoryId === budget.categoryId)
        .reduce((total, transaction) => total + transaction.amount, 0);

      const remaining = budget.amount - spent;
      const percentage = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;

      return {
        budget,
        category,
        spent,
        remaining,
        percentage,
        progressBarPercentage: Math.min(percentage, 100),
        status: this.getBudgetStatus(percentage),
      };
    }),
  );

  protected readonly totalBudget = computed(() =>
    this.budgets().reduce((total, budget) => total + budget.amount, 0),
  );

  protected readonly totalSpent = computed(() =>
    this.budgetItems().reduce((total, item) => total + item.spent, 0),
  );

  protected readonly totalRemaining = computed(() => this.totalBudget() - this.totalSpent());

  protected readonly totalPercentage = computed(() => {
    const totalBudget = this.totalBudget();

    if (totalBudget <= 0) {
      return 0;
    }

    return (this.totalSpent() / totalBudget) * 100;
  });

  constructor() {
    const currentUser = this.authService.currentUser();

    if (!currentUser) {
      this.isLoadingBudgets.set(false);
      this.isLoadingCategories.set(false);
      this.isLoadingTransactions.set(false);

      this.budgetLoadError.set('No se ha podido identificar al usuario actual.');

      return;
    }

    this.loadBudgets(currentUser.id);
    this.loadCategories(currentUser.id);
    this.loadTransactions(currentUser.id);
  }

  protected selectMonth(month: string): void {
    if (!month || month === this.selectedMonth()) {
      return;
    }

    this.closeBudgetForm();
    this.closeDeleteBudgetDialog();
    this.selectedMonth.set(month);

    const currentUser = this.authService.currentUser();

    if (!currentUser) {
      this.budgetLoadError.set('No se ha podido identificar al usuario actual.');

      return;
    }

    this.loadBudgets(currentUser.id);
  }

  protected openCreateBudgetForm(): void {
    this.selectedBudget.set(null);
    this.budgetFormError.set(null);
    this.isBudgetFormOpen.set(true);
  }

  protected openEditBudgetForm(budget: Budget): void {
    this.selectedBudget.set(budget);
    this.budgetFormError.set(null);
    this.isBudgetFormOpen.set(true);
  }

  protected closeBudgetForm(): void {
    if (this.isSavingBudget()) {
      return;
    }

    this.isBudgetFormOpen.set(false);
    this.selectedBudget.set(null);
    this.budgetFormError.set(null);
  }

  protected saveBudget(formValue: BudgetFormValue): void {
    if (this.isSavingBudget()) {
      return;
    }

    const currentUser = this.authService.currentUser();

    if (!currentUser) {
      this.budgetFormError.set('No se ha podido identificar al usuario actual.');

      return;
    }

    const budget = this.selectedBudget();

    if (budget) {
      this.updateBudget(budget, formValue.amount);
      return;
    }

    const categoryAlreadyHasBudget = this.budgets().some(
      (currentBudget) => currentBudget.categoryId === formValue.categoryId,
    );

    if (categoryAlreadyHasBudget) {
      this.budgetFormError.set('Esta categoría ya tiene un presupuesto para el mes seleccionado.');

      return;
    }

    this.createBudget(currentUser.id, formValue);
  }

  protected openDeleteBudgetDialog(budget: Budget): void {
    this.budgetToDelete.set(budget);
    this.budgetDeleteError.set(null);
  }

  protected closeDeleteBudgetDialog(): void {
    if (this.isDeletingBudget()) {
      return;
    }

    this.budgetToDelete.set(null);
    this.budgetDeleteError.set(null);
  }

  protected confirmDeleteBudget(): void {
    const budget = this.budgetToDelete();

    if (!budget || this.isDeletingBudget()) {
      return;
    }

    this.isDeletingBudget.set(true);
    this.budgetDeleteError.set(null);

    this.budgetService
      .deleteBudget(budget.id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isDeletingBudget.set(false)),
      )
      .subscribe({
        next: () => {
          this.budgets.update((budgets) =>
            budgets.filter((currentBudget) => currentBudget.id !== budget.id),
          );

          this.budgetToDelete.set(null);
        },
        error: () => {
          this.budgetDeleteError.set(
            'No se ha podido eliminar el presupuesto. Inténtalo de nuevo.',
          );
        },
      });
  }

  protected formatCurrency(amount: number): string {
    return this.currencyFormatter.format(amount);
  }

  protected formatPercentage(percentage: number): string {
    return `${Math.round(percentage)} %`;
  }

  private createBudget(userId: string, formValue: BudgetFormValue): void {
    this.isSavingBudget.set(true);
    this.budgetFormError.set(null);

    this.budgetService
      .createBudget({
        userId,
        categoryId: formValue.categoryId,
        amount: formValue.amount,
        month: this.selectedMonth(),
      })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isSavingBudget.set(false)),
      )
      .subscribe({
        next: (createdBudget) => {
          this.budgets.update((budgets) => [...budgets, createdBudget]);
          this.isBudgetFormOpen.set(false);
          this.selectedBudget.set(null);
        },
        error: () => {
          this.budgetFormError.set('No se ha podido crear el presupuesto. Inténtalo de nuevo.');
        },
      });
  }

  private updateBudget(budget: Budget, amount: number): void {
    this.isSavingBudget.set(true);
    this.budgetFormError.set(null);

    this.budgetService
      .updateBudget(budget.id, {
        amount,
      })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isSavingBudget.set(false)),
      )
      .subscribe({
        next: (updatedBudget) => {
          this.budgets.update((budgets) =>
            budgets.map((currentBudget) =>
              currentBudget.id === updatedBudget.id ? updatedBudget : currentBudget,
            ),
          );

          this.isBudgetFormOpen.set(false);
          this.selectedBudget.set(null);
        },
        error: () => {
          this.budgetFormError.set(
            'No se ha podido actualizar el presupuesto. Inténtalo de nuevo.',
          );
        },
      });
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

  private getBudgetStatus(percentage: number): BudgetStatus {
    if (percentage > 100) {
      return 'exceeded';
    }

    if (percentage >= 80) {
      return 'warning';
    }

    return 'normal';
  }

  private getMonthKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');

    return `${year}-${month}`;
  }

  private getMonthLabel(month: string): string {
    const [year, monthNumber] = month.split('-').map(Number);
    const date = new Date(year, monthNumber - 1, 1);

    const label = new Intl.DateTimeFormat('es-ES', {
      month: 'long',
      year: 'numeric',
    }).format(date);

    return label.charAt(0).toUpperCase() + label.slice(1);
  }
}
