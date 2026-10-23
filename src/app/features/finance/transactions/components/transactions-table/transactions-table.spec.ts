import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Category, Transaction } from '../../../models';
import { TransactionsFiltersService } from '../../services/transactions-filters';
import { TransactionsStateService } from '../../services/transactions-state';
import { TransactionsTable } from './transactions-table';

describe('TransactionsTable', () => {
  let fixture: ComponentFixture<TransactionsTable>;

  const expense = {
    id: 'transaction-1',
    userId: 'user-1',
    type: 'expense',
    amount: 25,
    description: 'Compra supermercado',
    categoryId: 'food',
    categoryNameSnapshot: 'Alimentación',
    date: '2026-10-15',
    paymentMethod: 'card',
    notes: 'Compra semanal',
  } as Transaction;

  const income = {
    ...expense,
    id: 'transaction-2',
    type: 'income',
    amount: 1500,
    description: 'Nómina',
    categoryId: null,
    categoryNameSnapshot: 'Trabajo',
    date: '2026-10-18',
    paymentMethod: 'bankTransfer',
    notes: '',
  } as Transaction;

  const categories = signal<Category[]>([{ id: 'food', name: 'Alimentación' } as Category]);

  const isLoading = signal(false);
  const loadError = signal<string | null>(null);
  const currentMonthLabel = signal('Octubre 2026');

  const filteredTransactions = signal<Transaction[]>([]);
  const currentPage = signal(1);
  const pageSize = signal(10);
  const hasActiveFilters = signal(false);

  const totalPages = computed(() =>
    Math.max(1, Math.ceil(filteredTransactions().length / pageSize())),
  );

  const paginatedTransactions = computed(() => {
    const start = (currentPage() - 1) * pageSize();

    return filteredTransactions().slice(start, start + pageSize());
  });

  const firstVisibleTransaction = computed(() =>
    filteredTransactions().length === 0 ? 0 : (currentPage() - 1) * pageSize() + 1,
  );

  const lastVisibleTransaction = computed(() =>
    Math.min(currentPage() * pageSize(), filteredTransactions().length),
  );

  const visiblePages = computed(() =>
    Array.from({ length: totalPages() }, (_, index) => index + 1),
  );

  const hasPreviousPage = computed(() => currentPage() > 1);
  const hasNextPage = computed(() => currentPage() < totalPages());

  beforeEach(async () => {
    isLoading.set(false);
    loadError.set(null);
    currentMonthLabel.set('Octubre 2026');
    filteredTransactions.set([income, expense]);
    currentPage.set(1);
    pageSize.set(10);
    hasActiveFilters.set(false);

    await TestBed.configureTestingModule({
      imports: [TransactionsTable],
      providers: [
        {
          provide: TransactionsStateService,
          useValue: {
            categories,
            isLoading,
            loadError,
          },
        },
        {
          provide: TransactionsFiltersService,
          useValue: {
            currentMonthLabel,
            filteredTransactions,
            paginatedTransactions,
            currentPage,
            pageSize,
            pageSizeOptions: [5, 10, 20],
            firstVisibleTransaction,
            lastVisibleTransaction,
            visiblePages,
            hasPreviousPage,
            hasNextPage,
            hasActiveFilters,
            clearFilters: () => hasActiveFilters.set(false),
            changePageSize: (value: string) => {
              pageSize.set(Number(value));
              currentPage.set(1);
            },
            goToPage: (page: number) => currentPage.set(page),
            previousPage: () => currentPage.update((page) => page - 1),
            nextPage: () => currentPage.update((page) => page + 1),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TransactionsTable);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should display the transaction rows', () => {
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelectorAll('tbody tr').length).toBe(2);
    expect(element.textContent).toContain('Compra supermercado');
    expect(element.textContent).toContain('Nómina');
    expect(element.textContent).toContain('Octubre 2026');
  });

  it('should display current and deleted category names', () => {
    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain('Alimentación');
    expect(element.textContent).toContain('Trabajo (eliminada)');
  });

  it('should display payment methods and formatted amounts', () => {
    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain('Tarjeta');
    expect(element.textContent).toContain('Transferencia');

    const amounts = element.querySelectorAll('.transaction-amount');

    expect(amounts.length).toBe(2);
    expect(amounts[0].textContent).toContain('+');
    expect(amounts[0].classList.contains('transaction-amount-income')).toBe(true);
    expect(amounts[1].textContent).toContain('-');
    expect(amounts[1].classList.contains('transaction-amount-expense')).toBe(true);
  });

  it('should emit the selected transaction when editing', () => {
    let selectedTransaction: Transaction | null = null;

    fixture.componentInstance.editRequested.subscribe((transaction) => {
      selectedTransaction = transaction;
    });

    const editButton = fixture.nativeElement.querySelector(
      'tbody tr:first-child button[aria-label="Editar transacción"]',
    ) as HTMLButtonElement;

    editButton.click();

    expect(selectedTransaction).toEqual(income);
  });

  it('should emit the selected transaction when deleting', () => {
    let selectedTransaction: Transaction | null = null;

    fixture.componentInstance.deleteRequested.subscribe((transaction) => {
      selectedTransaction = transaction;
    });

    const deleteButton = fixture.nativeElement.querySelector(
      'tbody tr:first-child button[aria-label="Eliminar transacción"]',
    ) as HTMLButtonElement;

    deleteButton.click();

    expect(selectedTransaction).toEqual(income);
  });

  it('should disable the delete button while processing', () => {
    fixture.componentRef.setInput('deletingTransactionId', 'transaction-1');
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll(
      'button[aria-label="Eliminar transacción"]',
    ) as NodeListOf<HTMLButtonElement>;

    expect(buttons[0].disabled).toBe(false);
    expect(buttons[1].disabled).toBe(true);
    expect(buttons[1].querySelector('.spinner-border')).not.toBeNull();
  });

  it('should display the loading state', () => {
    isLoading.set(true);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain('Cargando tus movimientos...');
    expect(element.querySelector('.transactions-table')).toBeNull();
    expect(element.querySelector('.spinner-border')).not.toBeNull();
  });

  it('should display an empty state when there are no results', () => {
    filteredTransactions.set([]);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain('No se han encontrado transacciones');

    expect(element.querySelector('.transactions-table')).toBeNull();
  });

  it('should allow clearing filters from the empty state', () => {
    filteredTransactions.set([]);
    hasActiveFilters.set(true);
    fixture.detectChanges();

    const clearButton = fixture.nativeElement.querySelector(
      '.transactions-placeholder button',
    ) as HTMLButtonElement;

    expect(clearButton).not.toBeNull();

    clearButton.click();

    expect(hasActiveFilters()).toBe(false);
  });

  it('should hide the table content when loading fails', () => {
    loadError.set('No se han podido cargar tus transacciones.');
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('.transactions-table')).toBeNull();
    expect(element.querySelector('.transactions-placeholder')).toBeNull();
  });

  it('should support changing page size and navigating pages', () => {
    filteredTransactions.set(
      Array.from({ length: 12 }, (_, index) => ({
        ...expense,
        id: `transaction-${index + 1}`,
      })),
    );

    fixture.detectChanges();

    const select = fixture.nativeElement.querySelector('.page-size-select') as HTMLSelectElement;

    select.value = '5';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(pageSize()).toBe(5);
    expect(fixture.nativeElement.querySelectorAll('tbody tr').length).toBe(5);

    const nextButton = fixture.nativeElement.querySelector(
      'button[aria-label="Página siguiente"]',
    ) as HTMLButtonElement;

    nextButton.click();
    fixture.detectChanges();

    expect(currentPage()).toBe(2);
    expect(firstVisibleTransaction()).toBe(6);
    expect(lastVisibleTransaction()).toBe(10);

    const previousButton = fixture.nativeElement.querySelector(
      'button[aria-label="Página anterior"]',
    ) as HTMLButtonElement;

    previousButton.click();

    expect(currentPage()).toBe(1);
  });
});
