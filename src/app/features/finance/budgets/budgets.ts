import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, Observable } from 'rxjs';

import { ConfirmDialog } from '../../../shared/ui/confirm-dialog/confirm-dialog';
import { PageHeader } from '../../../shared/ui/page-header/page-header';
import { Budget } from '../models';
import { BudgetForm, BudgetFormValue } from './budget-form/budget-form';
import { BudgetsList } from './budgets-list/budgets-list';
import { BudgetsStateService } from './services/budgets-state';
import { BudgetsSummary } from './budgets-summary/budgets-summary';
import { formatBudgetMonth } from './utils/budget-format.utils';

@Component({
  selector: 'app-budgets',
  imports: [PageHeader, BudgetForm, BudgetsSummary, BudgetsList, ConfirmDialog],
  providers: [BudgetsStateService],
  templateUrl: './budgets.html',
  styleUrl: './budgets.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Budgets {
  protected readonly state = inject(BudgetsStateService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly isBudgetFormOpen = signal(false);
  protected readonly selectedBudget = signal<Budget | null>(null);
  protected readonly isSavingBudget = signal(false);
  protected readonly budgetFormError = signal<string | null>(null);

  protected readonly budgetToDelete = signal<Budget | null>(null);
  protected readonly isDeletingBudget = signal(false);
  protected readonly budgetDeleteError = signal<string | null>(null);

  protected readonly selectedMonthLabel = computed(() =>
    formatBudgetMonth(this.state.selectedMonth()),
  );

  protected readonly budgetToDeleteCategoryName = computed(() => {
    const budget = this.budgetToDelete();

    if (!budget) {
      return '';
    }

    return (
      this.state.categories().find((category) => category.id === budget.categoryId)?.name ??
      'esta categoría'
    );
  });

  protected selectMonth(month: string): void {
    if (!month || month === this.state.selectedMonth()) {
      return;
    }

    this.closeBudgetForm();
    this.closeDeleteBudgetDialog();
    this.state.selectMonth(month);
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

    const userId = this.state.currentUserId();

    if (!userId) {
      this.budgetFormError.set('No se ha podido identificar al usuario actual.');
      return;
    }

    const selectedBudget = this.selectedBudget();

    if (selectedBudget) {
      this.submitBudget(
        this.state.updateBudget(selectedBudget.id, formValue.amount),
        'No se ha podido actualizar el presupuesto. Inténtalo de nuevo.',
      );
      return;
    }

    const categoryAlreadyHasBudget = this.state
      .budgets()
      .some((budget) => budget.categoryId === formValue.categoryId);

    if (categoryAlreadyHasBudget) {
      this.budgetFormError.set('Esta categoría ya tiene un presupuesto para el mes seleccionado.');
      return;
    }

    this.submitBudget(
      this.state.createBudget(userId, formValue.categoryId, formValue.amount),
      'No se ha podido crear el presupuesto. Inténtalo de nuevo.',
    );
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

    this.state
      .deleteBudget(budget.id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isDeletingBudget.set(false)),
      )
      .subscribe({
        next: () => {
          this.budgetToDelete.set(null);
        },
        error: () => {
          this.budgetDeleteError.set(
            'No se ha podido eliminar el presupuesto. Inténtalo de nuevo.',
          );
        },
      });
  }

  private submitBudget(request: Observable<Budget>, errorMessage: string): void {
    this.isSavingBudget.set(true);
    this.budgetFormError.set(null);

    request
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isSavingBudget.set(false)),
      )
      .subscribe({
        next: () => {
          this.isBudgetFormOpen.set(false);
          this.selectedBudget.set(null);
        },
        error: () => {
          this.budgetFormError.set(errorMessage);
        },
      });
  }
}
