import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

import { ConfirmDialog } from '../../../shared/ui/confirm-dialog/confirm-dialog';
import { PageHeader } from '../../../shared/ui/page-header/page-header';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { Transaction } from '../models';
import { TransactionsFiltersService } from './services/transactions-filters';
import { TransactionsStateService } from './services/transactions-state';
import { TransactionsSummaryService } from './services/transactions-summary';
import { TransactionForm } from './transaction-form/transaction-form';
import { TransactionsFilters } from './components/transactions-filters/transactions-filters';
import { TransactionsSummary } from './components/transactions-summary/transactions-summary';
import { TransactionsTable } from './components/transactions-table/transactions-table';
import { getTransactionCategoryName } from './utils/transaction-category.utils';
import { formatTransactionAmount, formatTransactionDate } from './utils/transaction-display.utils';

@Component({
  selector: 'app-transactions',
  imports: [
    PageHeader,
    TransactionsSummary,
    TransactionsFilters,
    TransactionsTable,
    TransactionForm,
    ConfirmDialog,
  ],
  providers: [TransactionsStateService, TransactionsFiltersService, TransactionsSummaryService],
  templateUrl: './transactions.html',
  styleUrl: './transactions.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Transactions {
  protected readonly state = inject(TransactionsStateService);
  protected readonly filters = inject(TransactionsFiltersService);

  private readonly toastService = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly isTransactionFormOpen = signal(false);
  protected readonly transactionToEdit = signal<Transaction | null>(null);

  protected readonly transactionToDelete = signal<Transaction | null>(null);
  protected readonly deletingTransactionId = signal<string | null>(null);
  protected readonly deleteError = signal<string | null>(null);

  protected readonly getCategoryName = getTransactionCategoryName;
  protected readonly formatTransactionDate = formatTransactionDate;
  protected readonly formatTransactionAmount = formatTransactionAmount;

  protected openTransactionForm(): void {
    this.transactionToEdit.set(null);
    this.isTransactionFormOpen.set(true);
  }

  protected openEditTransaction(transaction: Transaction): void {
    this.transactionToEdit.set(transaction);
    this.isTransactionFormOpen.set(true);
  }

  protected closeTransactionForm(): void {
    this.isTransactionFormOpen.set(false);
    this.transactionToEdit.set(null);
  }

  protected handleTransactionCreated(transaction: Transaction): void {
    this.state.addTransaction(transaction);
    this.filters.currentPage.set(1);
    this.closeTransactionForm();
  }

  protected handleTransactionUpdated(transaction: Transaction): void {
    this.state.updateTransaction(transaction);
    this.closeTransactionForm();
  }

  protected requestDeleteTransaction(transaction: Transaction): void {
    this.deleteError.set(null);
    this.transactionToDelete.set(transaction);
  }

  protected cancelDeleteTransaction(): void {
    if (this.deletingTransactionId()) {
      return;
    }

    this.transactionToDelete.set(null);
    this.deleteError.set(null);
  }

  protected confirmDeleteTransaction(): void {
    const transaction = this.transactionToDelete();

    if (!transaction || this.deletingTransactionId()) {
      return;
    }

    this.deletingTransactionId.set(transaction.id);
    this.deleteError.set(null);

    this.state
      .deleteTransaction(transaction.id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.deletingTransactionId.set(null)),
      )
      .subscribe({
        next: () => {
          this.filters.adjustCurrentPage();
          this.transactionToDelete.set(null);
          this.toastService.success('Transacción eliminada correctamente.');
        },
        error: () => {
          this.deleteError.set('No se ha podido eliminar la transacción. Inténtalo de nuevo.');
        },
      });
  }
}
