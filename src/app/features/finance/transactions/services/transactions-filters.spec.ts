import { signal, WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, ParamMap } from '@angular/router';
import { BehaviorSubject } from 'rxjs';

import { Category, Transaction } from '../../models';
import { TransactionsFiltersService } from './transactions-filters';
import { TransactionsStateService } from './transactions-state';

describe('TransactionsFiltersService', () => {
  let service: TransactionsFiltersService;
  let routeParams: BehaviorSubject<ParamMap>;
  let transactions: WritableSignal<Transaction[]>;

  const categories = signal<Category[]>([
    { id: 'food', name: 'Alimentación' } as Category,
    { id: 'work', name: 'Trabajo' } as Category,
  ]);

  const octoberExpense = {
    id: 'transaction-1',
    userId: 'user-1',
    type: 'expense',
    amount: 25,
    description: 'Compra supermercado',
    categoryId: 'food',
    categoryNameSnapshot: 'Alimentación',
    date: '2026-10-15',
    paymentMethod: 'card',
    notes: 'Leche',
  } as Transaction;

  const octoberIncome = {
    ...octoberExpense,
    id: 'transaction-2',
    type: 'income',
    amount: 1500,
    description: 'Nómina',
    categoryId: 'work',
    categoryNameSnapshot: 'Trabajo',
    date: '2026-10-18',
    paymentMethod: 'bankTransfer',
    notes: '',
  } as Transaction;

  const deletedCategoryTransaction = {
    ...octoberExpense,
    id: 'transaction-3',
    description: 'Recibo',
    categoryId: null,
    categoryNameSnapshot: 'Servicios',
    date: '2026-10-03',
    paymentMethod: 'cash',
    notes: '',
  } as Transaction;

  const septemberExpense = {
    ...octoberExpense,
    id: 'transaction-4',
    description: 'Gasolina',
    date: '2026-09-28',
    paymentMethod: 'cash',
    notes: '',
  } as Transaction;

  beforeEach(() => {
    routeParams = new BehaviorSubject<ParamMap>(convertToParamMap({}));

    transactions = signal<Transaction[]>([
      octoberExpense,
      octoberIncome,
      deletedCategoryTransaction,
      septemberExpense,
    ]);

    TestBed.configureTestingModule({
      providers: [
        TransactionsFiltersService,
        {
          provide: TransactionsStateService,
          useValue: {
            transactions,
            categories,
          },
        },
        {
          provide: ActivatedRoute,
          useValue: {
            queryParamMap: routeParams.asObservable(),
          },
        },
      ],
    });

    service = TestBed.inject(TransactionsFiltersService);
    service.selectMonth('2026-10');
  });

  it('should create', () => {
    expect(service).toBeTruthy();
  });

  it('should filter transactions by selected month', () => {
    expect(service.transactionsInSelectedMonth().length).toBe(3);
    expect(service.currentMonthLabel()).toBe('Octubre 2026');

    service.selectMonth('2026-09');

    expect(service.transactionsInSelectedMonth()).toEqual([septemberExpense]);
  });

  it('should filter by transaction type', () => {
    service.selectType('income');

    expect(service.filteredTransactions()).toEqual([octoberIncome]);

    service.selectType('expense');

    expect(service.filteredTransactions().length).toBe(2);
  });

  it('should filter by category and payment method', () => {
    service.selectCategory('food');

    expect(service.filteredTransactions()).toEqual([octoberExpense]);

    service.selectPaymentMethod('cash');

    expect(service.filteredTransactions()).toEqual([]);
  });

  it('should search by description, notes and category', () => {
    service.updateSearchTerm('supermercado');

    expect(service.filteredTransactions()).toEqual([octoberExpense]);

    service.updateSearchTerm('leche');

    expect(service.filteredTransactions()).toEqual([octoberExpense]);

    service.updateSearchTerm('trabajo');

    expect(service.filteredTransactions()).toEqual([octoberIncome]);
  });

  it('should search using historical category names', () => {
    service.updateSearchTerm('servicios');

    expect(service.filteredTransactions()).toEqual([deletedCategoryTransaction]);
  });

  it('should clear filters without changing the month', () => {
    service.updateSearchTerm('compra');
    service.selectType('expense');
    service.selectCategory('food');

    expect(service.hasActiveFilters()).toBe(true);

    service.clearFilters();

    expect(service.searchTerm()).toBe('');
    expect(service.selectedType()).toBe('all');
    expect(service.selectedCategoryId()).toBe('all');
    expect(service.selectedPaymentMethod()).toBe('all');
    expect(service.selectedMonth()).toBe('2026-10');
    expect(service.hasActiveFilters()).toBe(false);
  });

  it('should paginate transactions', () => {
    transactions.set(
      Array.from({ length: 12 }, (_, index) => ({
        ...octoberExpense,
        id: `transaction-${index}`,
      })),
    );

    service.changePageSize('5');

    expect(service.totalPages()).toBe(3);
    expect(service.paginatedTransactions().length).toBe(5);

    service.goToPage(3);

    expect(service.currentPage()).toBe(3);
    expect(service.firstVisibleTransaction()).toBe(11);
    expect(service.lastVisibleTransaction()).toBe(12);

    service.previousPage();

    expect(service.currentPage()).toBe(2);

    service.nextPage();

    expect(service.currentPage()).toBe(3);
  });

  it('should adjust pagination after removing transactions', () => {
    transactions.set(
      Array.from({ length: 11 }, (_, index) => ({
        ...octoberExpense,
        id: `transaction-${index}`,
      })),
    );

    service.changePageSize('5');
    service.goToPage(3);

    transactions.set(transactions().slice(0, 6));

    service.adjustCurrentPage();

    expect(service.currentPage()).toBe(2);
    expect(service.totalPages()).toBe(2);
    expect(service.lastVisibleTransaction()).toBe(6);
  });

  it('should read search and month from URL parameters', () => {
    service.selectType('income');
    service.selectCategory('work');

    routeParams.next(
      convertToParamMap({
        search: 'gasolina',
        month: '2026-09',
      }),
    );

    expect(service.searchTerm()).toBe('gasolina');
    expect(service.selectedMonth()).toBe('2026-09');
    expect(service.selectedType()).toBe('all');
    expect(service.selectedCategoryId()).toBe('all');
    expect(service.currentPage()).toBe(1);

    expect(service.filteredTransactions()).toEqual([septemberExpense]);
  });

  it('should ignore invalid months from the URL', () => {
    routeParams.next(
      convertToParamMap({
        search: 'compra',
        month: '2026-15',
      }),
    );

    expect(service.selectedMonth()).toBe('2026-10');
    expect(service.searchTerm()).toBe('compra');
  });
});
