import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { Budget, Category } from '../../models';

export interface BudgetFormValue {
  categoryId: string;
  amount: number;
}

@Component({
  selector: 'app-budget-form',
  imports: [ReactiveFormsModule],
  templateUrl: './budget-form.html',
  styleUrl: './budget-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BudgetForm {
  private readonly formBuilder = inject(FormBuilder);

  readonly budget = input<Budget | null>(null);
  readonly categories = input<Category[]>([]);
  readonly selectedMonth = input.required<string>();
  readonly unavailableCategoryIds = input<string[]>([]);

  readonly isSaving = input(false);
  readonly errorMessage = input<string | null>(null);

  readonly submitted = output<BudgetFormValue>();
  readonly cancelled = output<void>();

  protected readonly isEditMode = computed(() => this.budget() !== null);

  protected readonly selectedMonthLabel = computed(() => {
    const [year, month] = this.selectedMonth().split('-').map(Number);

    if (!year || !month) {
      return this.selectedMonth();
    }

    const label = new Intl.DateTimeFormat('es-ES', {
      month: 'long',
      year: 'numeric',
    }).format(new Date(year, month - 1, 1));

    return label.charAt(0).toUpperCase() + label.slice(1);
  });

  protected readonly availableCategories = computed(() => {
    const currentBudget = this.budget();
    const unavailableCategoryIds = this.unavailableCategoryIds();

    return this.categories().filter(
      (category) =>
        category.id === currentBudget?.categoryId || !unavailableCategoryIds.includes(category.id),
    );
  });

  protected readonly budgetForm = this.formBuilder.nonNullable.group({
    categoryId: ['', Validators.required],
    amount: [0, [Validators.required, Validators.min(0.01)]],
  });

  constructor() {
    effect(() => {
      const budget = this.budget();

      if (budget) {
        this.budgetForm.reset({
          categoryId: budget.categoryId,
          amount: budget.amount,
        });

        this.budgetForm.controls.categoryId.disable({
          emitEvent: false,
        });

        return;
      }

      this.reset();
    });
  }

  public reset(): void {
    this.budgetForm.reset({
      categoryId: '',
      amount: 0,
    });

    this.budgetForm.controls.categoryId.enable({
      emitEvent: false,
    });
  }

  protected cancel(): void {
    if (this.isSaving()) {
      return;
    }

    this.cancelled.emit();
  }

  protected submit(): void {
    if (this.isSaving()) {
      return;
    }

    if (this.budgetForm.invalid) {
      this.budgetForm.markAllAsTouched();

      return;
    }

    const formValue = this.budgetForm.getRawValue();

    if (!Number.isFinite(formValue.amount) || formValue.amount <= 0) {
      this.budgetForm.controls.amount.setErrors({
        min: true,
      });

      this.budgetForm.controls.amount.markAsTouched();

      return;
    }

    this.submitted.emit({
      categoryId: formValue.categoryId,
      amount: formValue.amount,
    });
  }
}
