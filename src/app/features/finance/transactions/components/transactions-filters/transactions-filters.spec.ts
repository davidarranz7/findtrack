import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Category, Transaction } from '../../../models';
import { TransactionsFiltersService } from '../../services/transactions-filters';
import { TransactionsStateService } from '../../services/transactions-state';
import { TransactionsSummaryService } from '../../services/transactions-summary';
import { TransactionsFilters } from './transactions-filters';

describe('TransactionsFilters', () => {
  let fixture: ComponentFixture<TransactionsFilters>;

  const categories = signal<Category[]>([
    { id: 'food', name: 'Alimentación' } as Category,
    { id: 'work', name: 'Trabajo' } as Category,
  ]);

  const isLoadingCategories = signal(false);
  const categoryLoadError = signal<string | null>(null);

  const searchTerm = signal('');
  const selectedMonth = signal('2026-10');
  const selectedType = signal<'all' | 'income' | 'expense'>('all');
  const selectedCategoryId = signal('all');
  const selectedPaymentMethod = signal('all');

  const filteredTransactions = signal<Transaction[]>([
    { id: 'transaction-1' } as Transaction,
    { id: 'transaction-2' } as Transaction,
  ]);

  const totalTransactionsInSelectedMonth = signal(3);
  const incomeCount = signal(1);
  const expenseCount = signal(2);

  const hasActiveFilters = computed(
    () =>
      searchTerm().trim() !== '' ||
      selectedType() !== 'all' ||
      selectedCategoryId() !== 'all' ||
      selectedPaymentMethod() !== 'all',
  );

  beforeEach(async () => {
    isLoadingCategories.set(false);
    categoryLoadError.set(null);
    searchTerm.set('');
    selectedMonth.set('2026-10');
    selectedType.set('all');
    selectedCategoryId.set('all');
    selectedPaymentMethod.set('all');
    filteredTransactions.set([
      { id: 'transaction-1' } as Transaction,
      { id: 'transaction-2' } as Transaction,
    ]);

    await TestBed.configureTestingModule({
      imports: [TransactionsFilters],
      providers: [
        {
          provide: TransactionsStateService,
          useValue: {
            categories,
            isLoadingCategories,
            categoryLoadError,
          },
        },
        {
          provide: TransactionsFiltersService,
          useValue: {
            searchTerm,
            selectedMonth,
            selectedType,
            selectedCategoryId,
            selectedPaymentMethod,
            filteredTransactions,
            hasActiveFilters,
            updateSearchTerm: (value: string) => searchTerm.set(value),
            selectMonth: (value: string) => selectedMonth.set(value),
            selectType: (value: 'all' | 'income' | 'expense') => selectedType.set(value),
            selectCategory: (value: string) => selectedCategoryId.set(value),
            selectPaymentMethod: (value: string) => selectedPaymentMethod.set(value),
            clearFilters: () => {
              searchTerm.set('');
              selectedType.set('all');
              selectedCategoryId.set('all');
              selectedPaymentMethod.set('all');
            },
          },
        },
        {
          provide: TransactionsSummaryService,
          useValue: {
            totalTransactionsInSelectedMonth,
            incomeCount,
            expenseCount,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TransactionsFilters);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render the search, month and type filters', () => {
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('.transaction-search-input')).not.toBeNull();
    expect(element.querySelector('.month-filter-input')).not.toBeNull();
    expect(element.querySelectorAll('.transaction-type-filter-button').length).toBe(3);

    expect(element.textContent).toContain('Ingresos');
    expect(element.textContent).toContain('Gastos');
  });

  it('should display categories and monthly counters', () => {
    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain('Alimentación');
    expect(element.textContent).toContain('Trabajo');

    const counters = element.querySelectorAll('.filter-count');

    expect(counters[0].textContent?.trim()).toBe('3');
    expect(counters[1].textContent?.trim()).toBe('1');
    expect(counters[2].textContent?.trim()).toBe('2');
  });

  it('should update the search term', () => {
    const input = fixture.nativeElement.querySelector(
      '.transaction-search-input',
    ) as HTMLInputElement;

    input.value = 'supermercado';
    input.dispatchEvent(new Event('input'));

    expect(searchTerm()).toBe('supermercado');
  });

  it('should update the selected month and transaction type', () => {
    const element = fixture.nativeElement as HTMLElement;

    const monthInput = element.querySelector('.month-filter-input') as HTMLInputElement;

    monthInput.value = '2026-09';
    monthInput.dispatchEvent(new Event('change'));

    const incomeButton = element.querySelectorAll(
      '.transaction-type-filter-button',
    )[1] as HTMLButtonElement;

    incomeButton.click();
    fixture.detectChanges();

    expect(selectedMonth()).toBe('2026-09');
    expect(selectedType()).toBe('income');
    expect(incomeButton.classList.contains('active')).toBe(true);
  });

  it('should update the selected category and payment method', () => {
    const selects = fixture.nativeElement.querySelectorAll(
      '.filter-select',
    ) as NodeListOf<HTMLSelectElement>;

    selects[0].value = 'food';
    selects[0].dispatchEvent(new Event('change'));

    selects[1].value = 'card';
    selects[1].dispatchEvent(new Event('change'));

    expect(selectedCategoryId()).toBe('food');
    expect(selectedPaymentMethod()).toBe('card');
  });

  it('should clear active filters without resetting the month', () => {
    searchTerm.set('compra');
    selectedType.set('expense');
    selectedMonth.set('2026-09');

    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector(
      '.clear-filters-button',
    ) as HTMLButtonElement;

    expect(button.disabled).toBe(false);

    button.click();
    fixture.detectChanges();

    expect(searchTerm()).toBe('');
    expect(selectedType()).toBe('all');
    expect(selectedMonth()).toBe('2026-09');
    expect(button.disabled).toBe(true);
  });

  it('should show category loading and error states', () => {
    isLoadingCategories.set(true);
    categoryLoadError.set('No se han podido cargar las categorías.');

    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const categorySelect = element.querySelector('.filter-select') as HTMLSelectElement;

    expect(categorySelect.disabled).toBe(true);
    expect(element.querySelector('.filters-error')?.textContent).toContain(
      'No se han podido cargar las categorías.',
    );
  });

  it('should show the number of filtered results', () => {
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('.filters-result')?.textContent).toContain('2');
    expect(element.querySelector('.filters-result')?.textContent).toContain('resultados');

    filteredTransactions.set([{ id: 'transaction-1' } as Transaction]);
    fixture.detectChanges();

    expect(element.querySelector('.filters-result')?.textContent).toContain('1');
    expect(element.querySelector('.filters-result')?.textContent).toContain('resultado');
  });
});
