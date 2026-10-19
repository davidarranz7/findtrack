import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, forkJoin } from 'rxjs';

import { AuthService } from '../../../auth/services/auth.service';
import { Category, Transaction } from '../../models';
import { CategoryService } from '../../services/category.service';
import { TransactionService } from '../../services/transaction.service';

export type ReportPeriod = 1 | 3 | 6 | 12;
export type PaymentMethodFilter = 'all' | Transaction['paymentMethod'];

@Injectable()
export class ReportStateService {
  private readonly authService = inject(AuthService);
  private readonly transactionService = inject(TransactionService);
  private readonly categoryService = inject(CategoryService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly currentDate = new Date();

  readonly transactions = signal<Transaction[]>([]);
  readonly categories = signal<Category[]>([]);

  readonly isLoading = signal(true);
  readonly loadError = signal<string | null>(null);

  readonly selectedPeriod = signal<ReportPeriod>(6);
  readonly selectedYear = signal(this.currentDate.getFullYear());
  readonly selectedCategoryIds = signal<string[]>([]);
  readonly selectedPaymentMethod = signal<PaymentMethodFilter>('all');
  readonly comparisonEnabled = signal(false);

  readonly generatedAtLabel = new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'long',
  }).format(this.currentDate);

  readonly periodOptions: { value: ReportPeriod; label: string }[] = [
    { value: 1, label: 'Último mes' },
    { value: 3, label: 'Últimos 3 meses' },
    { value: 6, label: 'Últimos 6 meses' },
    { value: 12, label: 'Últimos 12 meses' },
  ];

  readonly paymentMethodOptions: {
    value: PaymentMethodFilter;
    label: string;
  }[] = [
    { value: 'all', label: 'Todos los métodos' },
    { value: 'card', label: 'Tarjeta' },
    { value: 'cash', label: 'Efectivo' },
    { value: 'bankTransfer', label: 'Transferencia' },
  ];

  readonly sortedCategories = computed(() =>
    [...this.categories()].sort((first, second) => first.name.localeCompare(second.name, 'es-ES')),
  );

  readonly availableYears = computed(() => {
    const years = new Set<number>([this.currentDate.getFullYear()]);

    for (const transaction of this.transactions()) {
      const year = Number(transaction.date.slice(0, 4));

      if (Number.isFinite(year)) {
        years.add(year);
      }
    }

    return [...years].sort((first, second) => second - first);
  });

  readonly selectedCategoryId = computed(() => {
    const selected = this.selectedCategoryIds();

    return selected.length === 0 ? 'all' : selected.length === 1 ? selected[0] : 'multiple';
  });

  readonly activeFilterCount = computed(() => {
    let count = 0;

    if (this.selectedCategoryIds().length > 0) {
      count++;
    }

    if (this.selectedPaymentMethod() !== 'all') {
      count++;
    }

    return count;
  });

  readonly selectedCategoryLabel = computed(() => {
    const selected = this.selectedCategoryIds();

    if (selected.length === 0) {
      return 'Todas las categorías';
    }

    return selected
      .map((categoryId) => {
        if (categoryId === 'uncategorized') {
          return 'Sin categoría';
        }

        return (
          this.categories().find((category) => category.id === categoryId)?.name ?? 'Sin categoría'
        );
      })
      .join(', ');
  });

  readonly selectedPaymentMethodLabel = computed(
    () =>
      this.paymentMethodOptions.find((option) => option.value === this.selectedPaymentMethod())
        ?.label ?? 'Todos los métodos',
  );

  constructor() {
    this.loadReportData();
  }

  changePeriod(period: number): void {
    if (period === 1 || period === 3 || period === 6 || period === 12) {
      this.selectedPeriod.set(period);
    }
  }

  changeYear(year: number): void {
    if (Number.isFinite(year)) {
      this.selectedYear.set(year);
    }
  }

  changeCategory(categoryId: string): void {
    if (categoryId !== 'multiple') {
      this.selectedCategoryIds.set(categoryId === 'all' ? [] : [categoryId]);
    }
  }

  changePaymentMethod(paymentMethod: string): void {
    if (
      paymentMethod === 'all' ||
      paymentMethod === 'card' ||
      paymentMethod === 'cash' ||
      paymentMethod === 'bankTransfer'
    ) {
      this.selectedPaymentMethod.set(paymentMethod);
    }
  }

  toggleComparison(enabled: boolean): void {
    this.comparisonEnabled.set(enabled);
  }

  clearAnalysisFilters(): void {
    this.selectedCategoryIds.set([]);
    this.selectedPaymentMethod.set('all');
  }

  clearRankingCategorySelection(): void {
    this.selectedCategoryIds.set([]);
  }

  isCategorySelected(categoryId: string): boolean {
    return this.selectedCategoryIds().includes(categoryId);
  }

  toggleRankingCategory(categoryId: string): void {
    this.selectedCategoryIds.update((selected) =>
      selected.includes(categoryId)
        ? selected.filter((id) => id !== categoryId)
        : [...selected, categoryId],
    );
  }

  private loadReportData(): void {
    const userId = this.authService.currentUser()?.id;

    if (!userId) {
      this.isLoading.set(false);
      this.loadError.set('No se ha podido identificar al usuario actual.');
      return;
    }

    this.isLoading.set(true);
    this.loadError.set(null);

    forkJoin({
      transactions: this.transactionService.getTransactions(userId),
      categories: this.categoryService.getCategories(userId),
    })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isLoading.set(false)),
      )
      .subscribe({
        next: ({ transactions, categories }) => {
          this.transactions.set(transactions);
          this.categories.set(categories);
        },
        error: () => {
          this.loadError.set('No se han podido cargar los datos de tus informes.');
        },
      });
  }
}
