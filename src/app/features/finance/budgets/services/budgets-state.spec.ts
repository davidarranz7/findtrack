import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { AuthService } from '../../../auth/services/auth.service';
import { Budget, Category, Transaction } from '../../models';
import { BudgetService } from '../../services/budget.service';
import { CategoryService } from '../../services/category.service';
import { TransactionService } from '../../services/transaction.service';
import { BudgetsStateService } from './budgets-state';

describe('BudgetsStateService', () => {
  let service: BudgetsStateService;
  let requestedMonths: string[];
  let deleteShouldFail: boolean;
  let budgetLoadShouldFail: boolean;

  const currentUser = signal({
    id: 'user-1',
    username: 'usuario',
    email: 'usuario@example.com',
  });

  const initialBudget = {
    id: 'budget-1',
    userId: 'user-1',
    categoryId: 'food',
    amount: 500,
    month: '2026-10',
  } as Budget;

  const categories = [
    {
      id: 'food',
      name: 'Alimentación',
    } as Category,
    {
      id: 'transport',
      name: 'Transporte',
    } as Category,
  ];

  const transaction = {
    id: 'transaction-1',
    userId: 'user-1',
    type: 'expense',
    amount: 50,
    description: 'Supermercado',
    categoryId: 'food',
    categoryNameSnapshot: 'Alimentación',
    date: '2026-10-15',
    paymentMethod: 'card',
    notes: '',
  } as Transaction;

  beforeEach(() => {
    currentUser.set({
      id: 'user-1',
      username: 'usuario',
      email: 'usuario@example.com',
    });

    requestedMonths = [];
    deleteShouldFail = false;
    budgetLoadShouldFail = false;

    TestBed.configureTestingModule({
      providers: [
        BudgetsStateService,
        {
          provide: AuthService,
          useValue: {
            currentUser,
          },
        },
        {
          provide: BudgetService,
          useValue: {
            getBudgets: (_userId: string, month: string) => {
              requestedMonths.push(month);

              if (budgetLoadShouldFail) {
                return throwError(() => new Error('LOAD_FAILED'));
              }

              return of(month === '2030-05' ? [] : [initialBudget]);
            },
            createBudget: (payload: Omit<Budget, 'id'>) =>
              of({
                id: 'budget-2',
                ...payload,
              }),
            updateBudget: (budgetId: string, changes: Pick<Budget, 'amount'>) =>
              of({
                ...initialBudget,
                id: budgetId,
                amount: changes.amount,
              }),
            deleteBudget: () =>
              deleteShouldFail ? throwError(() => new Error('DELETE_FAILED')) : of(void 0),
          },
        },
        {
          provide: CategoryService,
          useValue: {
            getCategories: () => of(categories),
          },
        },
        {
          provide: TransactionService,
          useValue: {
            getTransactions: () => of([transaction]),
          },
        },
      ],
    });

    service = TestBed.inject(BudgetsStateService);
  });

  it('should create', () => {
    expect(service).toBeTruthy();
  });

  it('should load budgets, categories and transactions', () => {
    expect(service.budgets()).toEqual([initialBudget]);
    expect(service.categories()).toEqual(categories);
    expect(service.transactions()).toEqual([transaction]);

    expect(service.currentUserId()).toBe('user-1');
    expect(service.isLoading()).toBe(false);
    expect(service.loadError()).toBeNull();
  });

  it('should identify categories without a budget', () => {
    expect(service.unavailableCategoryIds()).toEqual(['food']);
    expect(service.canCreateBudget()).toBe(true);

    service.budgets.set([
      initialBudget,
      {
        ...initialBudget,
        id: 'budget-2',
        categoryId: 'transport',
      },
    ]);

    expect(service.canCreateBudget()).toBe(false);
  });

  it('should reload budgets when changing the month', () => {
    expect(requestedMonths.length).toBe(1);

    service.selectMonth('2030-05');

    expect(service.selectedMonth()).toBe('2030-05');
    expect(requestedMonths).toContain('2030-05');
    expect(requestedMonths.length).toBe(2);
    expect(service.budgets()).toEqual([]);
    expect(service.isLoading()).toBe(false);

    service.selectMonth('2030-05');

    expect(requestedMonths.length).toBe(2);
  });

  it('should create a budget and update the state', () => {
    service.createBudget('user-1', 'transport', 300).subscribe();

    expect(service.budgets().length).toBe(2);

    const createdBudget = service.budgets()[1];

    expect(createdBudget.id).toBe('budget-2');
    expect(createdBudget.categoryId).toBe('transport');
    expect(createdBudget.amount).toBe(300);
    expect(createdBudget.month).toBe(service.selectedMonth());

    expect(service.canCreateBudget()).toBe(false);
  });

  it('should update an existing budget', () => {
    service.updateBudget('budget-1', 750).subscribe();

    expect(service.budgets().length).toBe(1);
    expect(service.budgets()[0].amount).toBe(750);
    expect(service.budgets()[0].id).toBe('budget-1');
  });

  it('should delete a budget after a successful request', () => {
    service.deleteBudget('budget-1').subscribe();

    expect(service.budgets()).toEqual([]);
    expect(service.unavailableCategoryIds()).toEqual([]);
    expect(service.canCreateBudget()).toBe(true);
  });

  it('should keep the budget when deletion fails', () => {
    deleteShouldFail = true;

    let receivedError: Error | null = null;

    service.deleteBudget('budget-1').subscribe({
      error: (error: Error) => {
        receivedError = error;
      },
    });

    expect(receivedError).not.toBeNull();
    expect(service.budgets()).toEqual([initialBudget]);
  });

  it('should clear budgets and show an error if loading fails', () => {
    budgetLoadShouldFail = true;

    service.selectMonth('2030-05');

    expect(service.budgets()).toEqual([]);
    expect(service.isLoadingBudgets()).toBe(false);
    expect(service.budgetLoadError()).toBe('No se han podido cargar tus presupuestos.');
    expect(service.loadError()).toBe('No se han podido cargar tus presupuestos.');
  });
});
