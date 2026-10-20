import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, tap } from 'rxjs';

import { AuthService } from '../../../auth/services/auth.service';
import { Category, Transaction } from '../../models';
import { CategoryService } from '../../services/category.service';
import { TransactionService } from '../../services/transaction.service';

@Injectable()
export class TransactionsStateService {
  private readonly authService = inject(AuthService);
  private readonly transactionService = inject(TransactionService);
  private readonly categoryService = inject(CategoryService);
  private readonly destroyRef = inject(DestroyRef);

  readonly transactions = signal<Transaction[]>([]);
  readonly categories = signal<Category[]>([]);

  readonly isLoading = signal(true);
  readonly isLoadingCategories = signal(true);

  readonly loadError = signal<string | null>(null);
  readonly categoryLoadError = signal<string | null>(null);

  readonly totalTransactions = computed(() => this.transactions().length);

  constructor() {
    this.loadTransactions();
    this.loadCategories();
  }

  addTransaction(transaction: Transaction): void {
    this.transactions.update((transactions) => [transaction, ...transactions]);
  }

  updateTransaction(updatedTransaction: Transaction): void {
    this.transactions.update((transactions) =>
      transactions.map((transaction) =>
        transaction.id === updatedTransaction.id ? updatedTransaction : transaction,
      ),
    );
  }

  deleteTransaction(transactionId: string) {
    return this.transactionService.deleteTransaction(transactionId).pipe(
      tap(() => {
        this.transactions.update((transactions) =>
          transactions.filter((transaction) => transaction.id !== transactionId),
        );
      }),
    );
  }

  private loadTransactions(): void {
    const userId = this.authService.currentUser()?.id;

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
          this.loadError.set('No se han podido cargar tus transacciones.');
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
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isLoadingCategories.set(false)),
      )
      .subscribe({
        next: (categories) => {
          this.categories.set(categories);
        },
        error: () => {
          this.categoryLoadError.set('No se han podido cargar las categorías.');
        },
      });
  }
}
