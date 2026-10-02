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
import { Category, PaymentMethod, Tag, Transaction, TransactionType } from '../models';
import { CategoryService } from '../services/category.service';
import { TagService } from '../services/tag.service';
import { TransactionService } from '../services/transaction.service';
import { TransactionForm } from './transaction-form/transaction-form';

type TransactionTypeFilter = 'all' | TransactionType;
type PaymentMethodFilter = 'all' | PaymentMethod;

@Component({
  selector: 'app-transactions',
  imports: [TransactionForm],
  templateUrl: './transactions.html',
  styleUrl: './transactions.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Transactions {
  private readonly authService = inject(AuthService);
  private readonly transactionService = inject(TransactionService);
  private readonly categoryService = inject(CategoryService);
  private readonly tagService = inject(TagService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly currentDate = new Date();

  private readonly currencyFormatter = new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  });

  private readonly dateFormatter = new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  protected readonly transactions = signal<Transaction[]>([]);
  protected readonly categories = signal<Category[]>([]);
  protected readonly tags = signal<Tag[]>([]);

  protected readonly isLoading = signal(true);
  protected readonly isLoadingCategories = signal(true);
  protected readonly isLoadingTags = signal(true);

  protected readonly loadError = signal<string | null>(null);
  protected readonly categoryLoadError = signal<string | null>(null);
  protected readonly tagLoadError = signal<string | null>(null);

  protected readonly isTransactionFormOpen = signal(false);

  protected readonly transactionToDelete = signal<Transaction | null>(null);

  protected readonly deletingTransactionId = signal<string | null>(null);

  protected readonly deleteError = signal<string | null>(null);

  protected readonly searchTerm = signal('');
  protected readonly selectedType = signal<TransactionTypeFilter>('all');
  protected readonly selectedCategoryId = signal('all');
  protected readonly selectedPaymentMethod = signal<PaymentMethodFilter>('all');

  protected readonly selectedMonth = signal(this.getMonthKey(this.currentDate));

  protected readonly currentPage = signal(1);
  protected readonly pageSize = signal(10);

  protected readonly pageSizeOptions = [5, 10, 20];

  protected readonly currentMonthLabel = computed(() => this.getMonthLabel(this.selectedMonth()));

  protected readonly transactionsInSelectedMonth = computed(() =>
    this.transactions().filter((transaction) => transaction.date.startsWith(this.selectedMonth())),
  );

  protected readonly totalTransactions = computed(() => this.transactions().length);

  protected readonly totalTransactionsInSelectedMonth = computed(
    () => this.transactionsInSelectedMonth().length,
  );

  protected readonly incomeCount = computed(
    () =>
      this.transactionsInSelectedMonth().filter((transaction) => transaction.type === 'income')
        .length,
  );

  protected readonly expenseCount = computed(
    () =>
      this.transactionsInSelectedMonth().filter((transaction) => transaction.type === 'expense')
        .length,
  );

  protected readonly monthlyIncome = computed(() =>
    this.transactionsInSelectedMonth()
      .filter((transaction) => transaction.type === 'income')
      .reduce((total, transaction) => total + transaction.amount, 0),
  );

  protected readonly monthlyExpenses = computed(() =>
    this.transactionsInSelectedMonth()
      .filter((transaction) => transaction.type === 'expense')
      .reduce((total, transaction) => total + transaction.amount, 0),
  );

  protected readonly operatingBalance = computed(
    () => this.monthlyIncome() - this.monthlyExpenses(),
  );

  protected readonly formattedMonthlyIncome = computed(() =>
    this.currencyFormatter.format(this.monthlyIncome()),
  );

  protected readonly formattedMonthlyExpenses = computed(() => {
    const expenses = this.monthlyExpenses();

    if (expenses === 0) {
      return this.currencyFormatter.format(0);
    }

    return `-${this.currencyFormatter.format(expenses)}`;
  });

  protected readonly formattedOperatingBalance = computed(() =>
    this.currencyFormatter.format(this.operatingBalance()),
  );

  protected readonly filteredTransactions = computed(() => {
    const search = this.searchTerm().trim().toLowerCase();
    const type = this.selectedType();
    const categoryId = this.selectedCategoryId();
    const paymentMethod = this.selectedPaymentMethod();

    return this.transactionsInSelectedMonth()
      .filter((transaction) => {
        if (type !== 'all' && transaction.type !== type) {
          return false;
        }

        if (categoryId !== 'all' && transaction.categoryId !== categoryId) {
          return false;
        }

        if (paymentMethod !== 'all' && transaction.paymentMethod !== paymentMethod) {
          return false;
        }

        if (!search) {
          return true;
        }

        const categoryName = this.getCategoryName(transaction.categoryId).toLowerCase();

        const tagNames = transaction.tagIds
          .map((tagId) => this.getTagName(tagId))
          .join(' ')
          .toLowerCase();

        return (
          transaction.description.toLowerCase().includes(search) ||
          transaction.notes.toLowerCase().includes(search) ||
          categoryName.includes(search) ||
          tagNames.includes(search)
        );
      })
      .sort((firstTransaction, secondTransaction) =>
        secondTransaction.date.localeCompare(firstTransaction.date),
      );
  });

  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredTransactions().length / this.pageSize())),
  );

  protected readonly paginatedTransactions = computed(() => {
    const startIndex = (this.currentPage() - 1) * this.pageSize();

    const endIndex = startIndex + this.pageSize();

    return this.filteredTransactions().slice(startIndex, endIndex);
  });

  protected readonly firstVisibleTransaction = computed(() => {
    if (this.filteredTransactions().length === 0) {
      return 0;
    }

    return (this.currentPage() - 1) * this.pageSize() + 1;
  });

  protected readonly lastVisibleTransaction = computed(() =>
    Math.min(this.currentPage() * this.pageSize(), this.filteredTransactions().length),
  );

  protected readonly visiblePages = computed(() => {
    const totalPages = this.totalPages();
    const currentPage = this.currentPage();

    const startPage = Math.max(1, currentPage - 2);

    const endPage = Math.min(totalPages, startPage + 4);

    const adjustedStartPage = Math.max(1, endPage - 4);

    return Array.from(
      {
        length: endPage - adjustedStartPage + 1,
      },
      (_, index) => adjustedStartPage + index,
    );
  });

  protected readonly hasPreviousPage = computed(() => this.currentPage() > 1);

  protected readonly hasNextPage = computed(() => this.currentPage() < this.totalPages());

  protected readonly hasActiveFilters = computed(
    () =>
      this.searchTerm().trim() !== '' ||
      this.selectedType() !== 'all' ||
      this.selectedCategoryId() !== 'all' ||
      this.selectedPaymentMethod() !== 'all',
  );

  constructor() {
    this.loadTransactions();
    this.loadCategories();
    this.loadTags();
  }

  protected openTransactionForm(): void {
    this.isTransactionFormOpen.set(true);
  }

  protected closeTransactionForm(): void {
    this.isTransactionFormOpen.set(false);
  }

  protected handleTransactionCreated(transaction: Transaction): void {
    this.transactions.update((transactions) => [transaction, ...transactions]);

    this.currentPage.set(1);
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

    this.transactionService
      .deleteTransaction(transaction.id)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.deletingTransactionId.set(null)),
      )
      .subscribe({
        next: () => {
          this.transactions.update((transactions) =>
            transactions.filter((currentTransaction) => currentTransaction.id !== transaction.id),
          );

          if (this.currentPage() > this.totalPages()) {
            this.currentPage.set(this.totalPages());
          }

          this.transactionToDelete.set(null);
        },
        error: () => {
          this.deleteError.set('No se ha podido eliminar la transacción. Inténtalo de nuevo.');
        },
      });
  }

  protected updateSearchTerm(value: string): void {
    this.searchTerm.set(value);
    this.currentPage.set(1);
  }

  protected selectType(type: TransactionTypeFilter): void {
    this.selectedType.set(type);
    this.currentPage.set(1);
  }

  protected selectCategory(categoryId: string): void {
    this.selectedCategoryId.set(categoryId);
    this.currentPage.set(1);
  }

  protected selectPaymentMethod(paymentMethod: string): void {
    this.selectedPaymentMethod.set(paymentMethod as PaymentMethodFilter);

    this.currentPage.set(1);
  }

  protected selectMonth(month: string): void {
    if (!month) {
      return;
    }

    this.selectedMonth.set(month);
    this.currentPage.set(1);
  }

  protected clearFilters(): void {
    this.searchTerm.set('');
    this.selectedType.set('all');
    this.selectedCategoryId.set('all');
    this.selectedPaymentMethod.set('all');
    this.currentPage.set(1);
  }

  protected changePageSize(value: string): void {
    this.pageSize.set(Number(value));
    this.currentPage.set(1);
  }

  protected goToPage(page: number): void {
    if (page < 1 || page > this.totalPages() || page === this.currentPage()) {
      return;
    }

    this.currentPage.set(page);
  }

  protected previousPage(): void {
    if (!this.hasPreviousPage()) {
      return;
    }

    this.currentPage.update((page) => page - 1);
  }

  protected nextPage(): void {
    if (!this.hasNextPage()) {
      return;
    }

    this.currentPage.update((page) => page + 1);
  }

  protected getCategoryName(categoryId: string): string {
    return (
      this.categories().find((category) => category.id === categoryId)?.name ?? 'Sin categoría'
    );
  }

  protected getTagName(tagId: string): string {
    return this.tags().find((tag) => tag.id === tagId)?.name ?? 'Etiqueta';
  }

  protected getPaymentMethodLabel(paymentMethod: PaymentMethod): string {
    const labels: Record<PaymentMethod, string> = {
      cash: 'Efectivo',
      card: 'Tarjeta',
      bankTransfer: 'Transferencia',
    };

    return labels[paymentMethod];
  }

  protected getPaymentMethodIcon(paymentMethod: PaymentMethod): string {
    const icons: Record<PaymentMethod, string> = {
      cash: 'bi-cash',
      card: 'bi-credit-card',
      bankTransfer: 'bi-bank',
    };

    return icons[paymentMethod];
  }

  protected formatTransactionDate(date: string): string {
    const [year, month, day] = date.split('-').map(Number);

    return this.dateFormatter.format(new Date(year, month - 1, day));
  }

  protected formatTransactionAmount(transaction: Transaction): string {
    const formattedAmount = this.currencyFormatter.format(transaction.amount);

    return transaction.type === 'income' ? `+${formattedAmount}` : `-${formattedAmount}`;
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

  private loadTags(): void {
    const userId = this.authService.currentUser()?.id;

    if (!userId) {
      this.isLoadingTags.set(false);

      this.tagLoadError.set('No se han podido cargar las etiquetas.');

      return;
    }

    this.tagService
      .getTags(userId)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isLoadingTags.set(false)),
      )
      .subscribe({
        next: (tags) => {
          this.tags.set(tags);
        },
        error: () => {
          this.tagLoadError.set('No se han podido cargar las etiquetas.');
        },
      });
  }

  private getMonthKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  private getMonthLabel(monthKey: string): string {
    const [year, month] = monthKey.split('-').map(Number);

    const date = new Date(year, month - 1, 1);

    const monthName = new Intl.DateTimeFormat('es-ES', {
      month: 'long',
    }).format(date);

    const formattedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);

    return `${formattedMonth} ${year}`;
  }
}
