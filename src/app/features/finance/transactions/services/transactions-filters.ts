import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';

import { PaymentMethod, TransactionType } from '../../models';
import { getTransactionCategoryName } from '../utils/transaction-category.utils';
import { TransactionsStateService } from './transactions-state';

type TransactionTypeFilter = 'all' | TransactionType;
type PaymentMethodFilter = 'all' | PaymentMethod;

@Injectable()
export class TransactionsFiltersService {
  private readonly route = inject(ActivatedRoute);
  private readonly state = inject(TransactionsStateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly currentDate = new Date();

  readonly searchTerm = signal('');
  readonly selectedType = signal<TransactionTypeFilter>('all');
  readonly selectedCategoryId = signal('all');
  readonly selectedPaymentMethod = signal<PaymentMethodFilter>('all');
  readonly selectedMonth = signal(this.getMonthKey(this.currentDate));

  readonly currentPage = signal(1);
  readonly pageSize = signal(10);
  readonly pageSizeOptions = [5, 10, 20];

  readonly currentMonthLabel = computed(() => this.getMonthLabel(this.selectedMonth()));

  readonly transactionsInSelectedMonth = computed(() =>
    this.state
      .transactions()
      .filter((transaction) => transaction.date.startsWith(this.selectedMonth())),
  );

  readonly filteredTransactions = computed(() => {
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

        const categoryName = getTransactionCategoryName(
          transaction,
          this.state.categories(),
        ).toLowerCase();

        return (
          transaction.description.toLowerCase().includes(search) ||
          transaction.notes.toLowerCase().includes(search) ||
          categoryName.includes(search)
        );
      })
      .sort((first, second) => second.date.localeCompare(first.date));
  });

  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredTransactions().length / this.pageSize())),
  );

  readonly paginatedTransactions = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize();

    return this.filteredTransactions().slice(start, start + this.pageSize());
  });

  readonly firstVisibleTransaction = computed(() =>
    this.filteredTransactions().length === 0 ? 0 : (this.currentPage() - 1) * this.pageSize() + 1,
  );

  readonly lastVisibleTransaction = computed(() =>
    Math.min(this.currentPage() * this.pageSize(), this.filteredTransactions().length),
  );

  readonly visiblePages = computed(() => {
    const totalPages = this.totalPages();
    const start = Math.max(1, this.currentPage() - 2);
    const end = Math.min(totalPages, start + 4);
    const adjustedStart = Math.max(1, end - 4);

    return Array.from({ length: end - adjustedStart + 1 }, (_, index) => adjustedStart + index);
  });

  readonly hasPreviousPage = computed(() => this.currentPage() > 1);
  readonly hasNextPage = computed(() => this.currentPage() < this.totalPages());

  readonly hasActiveFilters = computed(
    () =>
      this.searchTerm().trim() !== '' ||
      this.selectedType() !== 'all' ||
      this.selectedCategoryId() !== 'all' ||
      this.selectedPaymentMethod() !== 'all',
  );

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const search = params.get('search');
      const month = params.get('month');

      if (search === null && month === null) {
        return;
      }

      this.searchTerm.set(search ?? '');

      if (month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
        this.selectedMonth.set(month);
      }

      this.selectedType.set('all');
      this.selectedCategoryId.set('all');
      this.selectedPaymentMethod.set('all');
      this.currentPage.set(1);
    });
  }

  updateSearchTerm(value: string): void {
    this.searchTerm.set(value);
    this.currentPage.set(1);
  }

  selectType(type: TransactionTypeFilter): void {
    this.selectedType.set(type);
    this.currentPage.set(1);
  }

  selectCategory(categoryId: string): void {
    this.selectedCategoryId.set(categoryId);
    this.currentPage.set(1);
  }

  selectPaymentMethod(paymentMethod: string): void {
    this.selectedPaymentMethod.set(paymentMethod as PaymentMethodFilter);
    this.currentPage.set(1);
  }

  selectMonth(month: string): void {
    if (!month) {
      return;
    }

    this.selectedMonth.set(month);
    this.currentPage.set(1);
  }

  clearFilters(): void {
    this.searchTerm.set('');
    this.selectedType.set('all');
    this.selectedCategoryId.set('all');
    this.selectedPaymentMethod.set('all');
    this.currentPage.set(1);
  }

  changePageSize(value: string): void {
    this.pageSize.set(Number(value));
    this.currentPage.set(1);
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages() || page === this.currentPage()) {
      return;
    }

    this.currentPage.set(page);
  }

  previousPage(): void {
    if (!this.hasPreviousPage()) {
      return;
    }

    this.currentPage.update((page) => page - 1);
  }

  nextPage(): void {
    if (!this.hasNextPage()) {
      return;
    }

    this.currentPage.update((page) => page + 1);
  }

  adjustCurrentPage(): void {
    if (this.currentPage() > this.totalPages()) {
      this.currentPage.set(this.totalPages());
    }
  }

  private getMonthKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  private getMonthLabel(monthKey: string): string {
    const [year, month] = monthKey.split('-').map(Number);

    const monthName = new Intl.DateTimeFormat('es-ES', {
      month: 'long',
    }).format(new Date(year, month - 1, 1));

    return `${monthName.charAt(0).toUpperCase()}${monthName.slice(1)} ${year}`;
  }
}
