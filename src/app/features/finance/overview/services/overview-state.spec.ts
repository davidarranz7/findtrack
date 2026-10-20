import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Observable, of, Subject, throwError } from 'rxjs';

import { AuthService } from '../../../auth/services/auth.service';
import { Budget, Category, Transaction } from '../../models';
import { BudgetService } from '../../services/budget.service';
import { CategoryService } from '../../services/category.service';
import { TransactionService } from '../../services/transaction.service';
import { OverviewStateService } from './overview-state';

describe('OverviewStateService', () => {
  const currentUser = signal<{ id: string; username: string } | null>({
    id: 'user-1',
    username: 'David',
  });

  const transaction = {
    id: 'transaction-1',
    userId: 'user-1',
    type: 'income',
    amount: 1500,
    date: '2026-10-10',
    categoryId: null,
  } as Transaction;

  const category: Category = {
    id: 'food',
    userId: 'user-1',
    name: 'Alimentación',
    icon: 'bi-basket',
    color: '#16a34a',
  };

  const budget = {
    id: 'budget-1',
    userId: 'user-1',
    categoryId: 'food',
    amount: 300,
  } as Budget;

  let failTransactions: boolean;
  let failCategories: boolean;
  let failBudgets: boolean;
  let delayBudgets: boolean;
  let budgetRequests: { userId: string; monthKey: string }[];
  let budgetResponses: Subject<Budget[]>[];

  beforeEach(() => {
    currentUser.set({ id: 'user-1', username: 'David' });
    failTransactions = false;
    failCategories = false;
    failBudgets = false;
    delayBudgets = false;
    budgetRequests = [];
    budgetResponses = [];

    TestBed.configureTestingModule({
      providers: [
        OverviewStateService,
        {
          provide: AuthService,
          useValue: { currentUser },
        },
        {
          provide: TransactionService,
          useValue: {
            getTransactions: () =>
              failTransactions
                ? throwError(() => new Error('TRANSACTIONS_ERROR'))
                : of([transaction]),
          },
        },
        {
          provide: CategoryService,
          useValue: {
            getCategories: () =>
              failCategories ? throwError(() => new Error('CATEGORIES_ERROR')) : of([category]),
          },
        },
        {
          provide: BudgetService,
          useValue: {
            getBudgets: (userId: string, monthKey: string): Observable<Budget[]> => {
              budgetRequests.push({ userId, monthKey });

              if (delayBudgets) {
                const response = new Subject<Budget[]>();
                budgetResponses.push(response);
                return response;
              }

              return failBudgets ? throwError(() => new Error('BUDGETS_ERROR')) : of([budget]);
            },
          },
        },
      ],
    });
  });

  it('should load all dashboard data', () => {
    const service = TestBed.inject(OverviewStateService);

    expect(service.transactions()).toEqual([transaction]);
    expect(service.categories()).toEqual([category]);
    expect(service.budgets()).toEqual([budget]);
    expect(service.isLoading()).toBe(false);
    expect(service.isLoadingBudgets()).toBe(false);
    expect(service.loadError()).toBeNull();
    expect(service.budgetLoadError()).toBeNull();
  });

  it('should expose the current user name', () => {
    const service = TestBed.inject(OverviewStateService);

    expect(service.userName()).toBe('David');

    currentUser.set(null);

    expect(service.userName()).toBe('Usuario');
  });

  it('should start at the current month', () => {
    const service = TestBed.inject(OverviewStateService);
    const today = new Date();

    expect(service.selectedMonth().getFullYear()).toBe(today.getFullYear());
    expect(service.selectedMonth().getMonth()).toBe(today.getMonth());
    expect(service.selectedMonth().getDate()).toBe(1);
    expect(service.canGoToNextMonth()).toBe(false);
  });

  it('should prevent navigation to future months', () => {
    const service = TestBed.inject(OverviewStateService);
    const initialKey = service.selectedMonthKey();

    service.nextMonth();

    expect(service.selectedMonthKey()).toBe(initialKey);
    expect(budgetRequests.length).toBe(1);
  });

  it('should reload budgets when navigating between months', () => {
    const service = TestBed.inject(OverviewStateService);
    const initialKey = service.selectedMonthKey();

    service.previousMonth();

    expect(service.selectedMonthKey()).not.toBe(initialKey);
    expect(service.canGoToNextMonth()).toBe(true);
    expect(budgetRequests.length).toBe(2);
    expect(budgetRequests[1].monthKey).toBe(service.selectedMonthKey());

    service.nextMonth();

    expect(service.selectedMonthKey()).toBe(initialKey);
    expect(budgetRequests.length).toBe(3);
  });

  it('should prepend a newly created transaction', () => {
    const service = TestBed.inject(OverviewStateService);
    const newTransaction = {
      ...transaction,
      id: 'transaction-2',
      amount: 250,
    };

    service.addTransaction(newTransaction);

    expect(service.transactions()).toEqual([newTransaction, transaction]);
  });

  it('should report an error when no user exists', () => {
    currentUser.set(null);

    const service = TestBed.inject(OverviewStateService);

    expect(service.transactions()).toEqual([]);
    expect(service.budgets()).toEqual([]);
    expect(service.isLoading()).toBe(false);
    expect(service.isLoadingBudgets()).toBe(false);
    expect(service.loadError()).toContain('No se ha podido identificar');
    expect(budgetRequests.length).toBe(0);
  });

  it('should report transaction loading errors', () => {
    failTransactions = true;

    const service = TestBed.inject(OverviewStateService);

    expect(service.loadError()).toBe('No se han podido cargar tus movimientos.');
    expect(service.isLoading()).toBe(false);
  });

  it('should report category loading errors', () => {
    failCategories = true;

    const service = TestBed.inject(OverviewStateService);

    expect(service.categoryLoadError()).toBe('No se han podido cargar tus categorías.');
    expect(service.loadError()).toBe('No se han podido cargar tus categorías.');
  });

  it('should clear budgets when their request fails', () => {
    failBudgets = true;

    const service = TestBed.inject(OverviewStateService);

    expect(service.budgets()).toEqual([]);
    expect(service.budgetLoadError()).toBe('No se han podido cargar tus presupuestos.');
    expect(service.isLoadingBudgets()).toBe(false);
  });

  it('should ignore outdated budget responses', () => {
    delayBudgets = true;

    const service = TestBed.inject(OverviewStateService);

    service.previousMonth();

    budgetResponses[0].next([{ ...budget, id: 'outdated-budget' }]);
    budgetResponses[0].complete();

    expect(service.budgets()).toEqual([]);
    expect(service.isLoadingBudgets()).toBe(true);

    budgetResponses[1].next([budget]);
    budgetResponses[1].complete();

    expect(service.budgets()).toEqual([budget]);
    expect(service.isLoadingBudgets()).toBe(false);
    expect(service.budgetLoadError()).toBeNull();
  });
});
