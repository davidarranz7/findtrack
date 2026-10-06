import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';

import { ToastService } from '../../../../shared/ui/toast/toast.service';
import { AuthService } from '../../../auth/services/auth.service';
import { Category, PaymentMethod, Transaction, TransactionType } from '../../models';
import { CategoryService } from '../../services/category.service';
import { TransactionService } from '../../services/transaction.service';

@Component({
  selector: 'app-transaction-form',
  imports: [ReactiveFormsModule],
  templateUrl: './transaction-form.html',
  styleUrl: './transaction-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TransactionForm {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly categoryService = inject(CategoryService);
  private readonly transactionService = inject(TransactionService);
  private readonly toastService = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  readonly transaction = input<Transaction | null>(null);

  readonly closed = output<void>();
  readonly created = output<Transaction>();
  readonly updated = output<Transaction>();

  protected readonly isEditMode = computed(() => this.transaction() !== null);

  protected readonly isSubmitting = signal(false);
  protected readonly submitError = signal<string | null>(null);

  protected readonly transactionForm = this.formBuilder.nonNullable.group({
    type: ['expense' as TransactionType, Validators.required],
    amount: [0, [Validators.required, Validators.min(0.01)]],
    description: ['', [Validators.required, Validators.maxLength(120)]],
    categoryId: ['', Validators.required],
    date: [this.getTodayDate(), Validators.required],
    paymentMethod: ['card' as PaymentMethod, Validators.required],
    notes: ['', Validators.maxLength(500)],
  });

  protected readonly categories = signal<Category[]>([]);

  protected readonly isLoadingCategories = signal(true);

  protected readonly categoryLoadError = signal<string | null>(null);

  constructor() {
    this.loadCategories();

    effect(() => {
      const transaction = this.transaction();

      if (!transaction) {
        return;
      }

      this.transactionForm.reset({
        type: transaction.type,
        amount: transaction.amount,
        description: transaction.description,
        categoryId: transaction.categoryId ?? '',
        date: transaction.date,
        paymentMethod: transaction.paymentMethod,
        notes: transaction.notes,
      });
    });
  }

  protected close(): void {
    if (this.isSubmitting()) {
      return;
    }

    this.closed.emit();
  }

  protected selectType(type: TransactionType): void {
    if (this.transactionForm.controls.type.value === type) {
      return;
    }

    this.transactionForm.controls.type.setValue(type);
  }

  protected selectPaymentMethod(paymentMethod: PaymentMethod): void {
    this.transactionForm.controls.paymentMethod.setValue(paymentMethod);
  }

  protected onSubmit(): void {
    if (this.transactionForm.invalid) {
      this.transactionForm.markAllAsTouched();
      return;
    }

    const currentUser = this.authService.currentUser();

    if (!currentUser) {
      this.submitError.set('No se ha podido identificar al usuario actual.');

      return;
    }

    const { type, amount, description, categoryId, date, paymentMethod, notes } =
      this.transactionForm.getRawValue();

    const payload = {
      userId: currentUser.id,
      type,
      amount,
      description: description.trim(),
      categoryId,
      date,
      paymentMethod,
      notes: notes.trim(),
    };

    this.isSubmitting.set(true);
    this.submitError.set(null);

    const transaction = this.transaction();

    if (transaction) {
      this.transactionService
        .updateTransaction(transaction.id, payload)
        .pipe(
          takeUntilDestroyed(this.destroyRef),
          finalize(() => this.isSubmitting.set(false)),
        )
        .subscribe({
          next: (updatedTransaction) => {
            this.toastService.success('Transacción actualizada correctamente.');

            this.updated.emit(updatedTransaction);
          },
          error: () => {
            this.submitError.set('No se ha podido actualizar la transacción. Inténtalo de nuevo.');
          },
        });

      return;
    }

    this.transactionService
      .createTransaction(payload)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isSubmitting.set(false)),
      )
      .subscribe({
        next: (createdTransaction) => {
          this.toastService.success('Transacción creada correctamente.');

          this.created.emit(createdTransaction);
        },
        error: () => {
          this.submitError.set('No se ha podido guardar la transacción. Inténtalo de nuevo.');
        },
      });
  }

  private loadCategories(): void {
    const userId = this.authService.currentUser()?.id;

    if (!userId) {
      this.isLoadingCategories.set(false);

      this.categoryLoadError.set('No se han podido cargar las categorías.');

      return;
    }

    this.categoryService
      .getCategories(userId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (categories) => {
          this.categories.set(categories);
          this.isLoadingCategories.set(false);
        },
        error: () => {
          this.isLoadingCategories.set(false);

          this.categoryLoadError.set('No se han podido cargar las categorías.');
        },
      });
  }

  private getTodayDate(): string {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }
}
