import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { AuthService } from '../../../auth/services/auth.service';
import { Budget, Category, Transaction } from '../../models';
import { BudgetService } from '../../services/budget.service';
import { CategoryService } from '../../services/category.service';
import { TransactionService } from '../../services/transaction.service';
import { CategoriesStateService } from './categories-state';

describe('CategoriesStateService', () => {
  let service: CategoriesStateService;
  let storedCategories: Category[];
  let categoryRequests: number;
  let transactionRequests: number;
  let failCategoryLoad: boolean;
  let failCreate: boolean;

  const currentUser = signal<{ id: string } | null>({ id: 'user-1' });

  const foodCategory = {
    id: 'food',
    userId: 'user-1',
    name: 'Alimentación',
    icon: 'bi-basket',
    color: '#16a34a',
  } as Category;

  const transaction = {
    id: 'transaction-1',
    userId: 'user-1',
    categoryId: 'food',
    type: 'expense',
    amount: 50,
    date: '2026-10-10',
  } as Transaction;

  const budget = {
    id: 'budget-1',
    userId: 'user-1',
    categoryId: 'food',
    amount: 300,
    month: '2026-10',
  } as Budget;

  beforeEach(() => {
    currentUser.set({ id: 'user-1' });
    storedCategories = [{ ...foodCategory }];
    categoryRequests = 0;
    transactionRequests = 0;
    failCategoryLoad = false;
    failCreate = false;

    TestBed.configureTestingModule({
      providers: [
        CategoriesStateService,
        {
          provide: AuthService,
          useValue: { currentUser },
        },
        {
          provide: CategoryService,
          useValue: {
            getCategories: () => {
              categoryRequests++;

              return failCategoryLoad
                ? throwError(() => new Error('LOAD_FAILED'))
                : of([...storedCategories]);
            },
            createCategory: (values: Omit<Category, 'id'>) => {
              if (failCreate) {
                return throwError(() => new Error('CREATE_FAILED'));
              }

              const created = { ...values, id: 'transport' } as Category;
              storedCategories.push(created);
              return of(created);
            },
            updateCategory: (
              categoryId: string,
              changes: Pick<Category, 'name' | 'icon' | 'color'>,
            ) => {
              const updated = {
                ...foodCategory,
                ...changes,
                id: categoryId,
              };

              storedCategories = storedCategories.map((category) =>
                category.id === categoryId ? updated : category,
              );

              return of(updated);
            },
          },
        },
        {
          provide: TransactionService,
          useValue: {
            getTransactions: () => {
              transactionRequests++;
              return of([transaction]);
            },
          },
        },
        {
          provide: BudgetService,
          useValue: {
            getBudgetsByUser: () => of([budget]),
          },
        },
      ],
    });

    service = TestBed.inject(CategoriesStateService);
  });

  it('should create and load the initial data', () => {
    expect(service).toBeTruthy();
    expect(service.categories()).toEqual([foodCategory]);
    expect(service.transactions()).toEqual([transaction]);
    expect(service.budgets()).toEqual([budget]);
    expect(service.isLoading()).toBe(false);
    expect(service.loadError()).toBeNull();
  });

  it('should calculate category statistics', () => {
    expect(service.totalCategories()).toBe(1);
    expect(service.categorizedTransactions()).toBe(1);
    expect(service.uncategorizedTransactions()).toBe(0);
    expect(service.getTransactionCount('food')).toBe(1);
    expect(service.getTransactionCount('other')).toBe(0);
  });

  it('should count transactions without a valid category', () => {
    service.transactions.set([
      transaction,
      { ...transaction, id: 'transaction-2', categoryId: null },
      { ...transaction, id: 'transaction-3', categoryId: 'missing' },
    ]);

    expect(service.categorizedTransactions()).toBe(1);
    expect(service.uncategorizedTransactions()).toBe(2);
  });

  it('should detect categories linked to budgets', () => {
    expect(service.hasBudget('food')).toBe(true);
    expect(service.hasBudget('transport')).toBe(false);
  });

  it('should detect duplicate names ignoring case and spaces', () => {
    expect(service.hasDuplicateName(' alimentación ')).toBe(true);
    expect(service.hasDuplicateName('ALIMENTACIÓN')).toBe(true);
    expect(service.hasDuplicateName('Transporte')).toBe(false);
    expect(service.hasDuplicateName('Alimentación', 'food')).toBe(false);
  });

  it('should create a category and update the state', () => {
    service
      .createCategory('user-1', {
        name: 'Transporte',
        icon: 'bi-bus-front',
        color: '#2563eb',
      })
      .subscribe();

    expect(service.totalCategories()).toBe(2);
    expect(service.categories()[1].name).toBe('Transporte');
    expect(service.categories()[1].userId).toBe('user-1');
  });

  it('should update an existing category', () => {
    service
      .updateCategory('food', {
        name: 'Comida',
        icon: 'bi-cart',
        color: '#dc2626',
      })
      .subscribe();

    expect(service.totalCategories()).toBe(1);
    expect(service.categories()[0].name).toBe('Comida');
    expect(service.categories()[0].icon).toBe('bi-cart');
  });

  it('should not update the state when creation fails', () => {
    failCreate = true;

    let failed = false;

    service
      .createCategory('user-1', {
        name: 'Transporte',
        icon: 'bi-bus-front',
        color: '#2563eb',
      })
      .subscribe({
        error: () => {
          failed = true;
        },
      });

    expect(failed).toBe(true);
    expect(service.totalCategories()).toBe(1);
  });

  it('should apply a completed category deletion', () => {
    service.applyDeletedCategory('food', [
      {
        ...transaction,
        categoryId: null,
        categoryNameSnapshot: 'Alimentación',
      },
    ]);

    expect(service.categories()).toEqual([]);
    expect(service.transactions()[0].categoryId).toBeNull();
    expect(service.transactions()[0].categoryNameSnapshot).toBe('Alimentación');
    expect(service.uncategorizedTransactions()).toBe(1);
  });

  it('should reload categories and transactions after a deletion error', () => {
    service.reloadAfterDeleteFailure();

    expect(categoryRequests).toBe(2);
    expect(transactionRequests).toBe(2);
  });

  it('should expose loading errors', () => {
    failCategoryLoad = true;

    service.reloadAfterDeleteFailure();

    expect(service.categoryLoadError()).toBe('No se han podido cargar tus categorías.');
    expect(service.loadError()).toBe('No se han podido cargar tus categorías.');
  });
});
