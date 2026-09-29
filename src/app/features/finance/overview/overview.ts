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
import { Transaction } from '../models';
import { TransactionService } from '../services/transaction.service';
import { TransactionForm } from '../transactions/transaction-form/transaction-form';

@Component({
  selector: 'app-overview',
  imports: [TransactionForm],
  templateUrl: './overview.html',
  styleUrl: './overview.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Overview {
  private readonly authService = inject(AuthService);
  private readonly transactionService = inject(TransactionService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly currentDate = new Date();

  private readonly currentMonthKey = `${this.currentDate.getFullYear()}-${String(
    this.currentDate.getMonth() + 1,
  ).padStart(2, '0')}`;

  private readonly currencyFormatter = new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  });

  protected readonly currentUser = this.authService.currentUser;

  protected readonly transactions = signal<Transaction[]>([]);

  protected readonly isLoading = signal(true);

  protected readonly loadError = signal<string | null>(null);

  protected readonly isTransactionFormOpen = signal(false);

  protected readonly userName = computed(() => this.currentUser()?.username ?? 'Usuario');

  protected readonly currentMonthLabel = this.getCurrentMonthLabel();

  protected readonly monthlyTransactions = computed(() =>
    this.transactions().filter((transaction) => transaction.date.startsWith(this.currentMonthKey)),
  );

  protected readonly availableBalance = computed(() =>
    this.transactions().reduce((balance, transaction) => {
      return transaction.type === 'income'
        ? balance + transaction.amount
        : balance - transaction.amount;
    }, 0),
  );

  protected readonly monthlyIncome = computed(() =>
    this.monthlyTransactions()
      .filter((transaction) => transaction.type === 'income')
      .reduce((total, transaction) => total + transaction.amount, 0),
  );

  protected readonly monthlyExpenses = computed(() =>
    this.monthlyTransactions()
      .filter((transaction) => transaction.type === 'expense')
      .reduce((total, transaction) => total + transaction.amount, 0),
  );

  protected readonly monthlySavings = computed(() => this.monthlyIncome() - this.monthlyExpenses());

  protected readonly formattedBalance = computed(() =>
    this.currencyFormatter.format(this.availableBalance()),
  );

  protected readonly formattedIncome = computed(() =>
    this.currencyFormatter.format(this.monthlyIncome()),
  );

  protected readonly formattedExpenses = computed(() =>
    this.currencyFormatter.format(this.monthlyExpenses()),
  );

  protected readonly formattedSavings = computed(() =>
    this.currencyFormatter.format(this.monthlySavings()),
  );

  constructor() {
    this.loadTransactions();
  }

  protected openTransactionForm(): void {
    this.isTransactionFormOpen.set(true);
  }

  protected closeTransactionForm(): void {
    this.isTransactionFormOpen.set(false);
  }

  protected handleTransactionCreated(transaction: Transaction): void {
    this.transactions.update((transactions) => [transaction, ...transactions]);

    this.closeTransactionForm();
  }

  private loadTransactions(): void {
    const userId = this.currentUser()?.id;

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
          this.loadError.set('No se han podido cargar tus movimientos.');
        },
      });
  }

  private getCurrentMonthLabel(): string {
    const month = new Intl.DateTimeFormat('es-ES', {
      month: 'long',
    }).format(this.currentDate);

    const formattedMonth = month.charAt(0).toUpperCase() + month.slice(1);

    return `${formattedMonth} ${this.currentDate.getFullYear()}`;
  }
}
