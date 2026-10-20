import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { Category, Transaction } from '../../models';
import { CategoryService } from '../../services/category.service';
import { TransactionService } from '../../services/transaction.service';
import { CategoriesStateService } from './categories-state';
import { CategoryDeletionService } from './category-deletion';

describe('CategoryDeletionService', () => {
  let service: CategoryDeletionService;
  let failTransactionUpdate: boolean;
  let failCategoryDelete: boolean;
  let reloadCount: number;
  let updatedIds: string[];
  let deletedIds: string[];

  const category: Category = {
    id: 'food',
    userId: 'user-1',
    name: 'Alimentación',
    icon: 'bi-basket',
    color: '#16a34a',
  };

  const transaction = {
    id: 'transaction-1',
    userId: 'user-1',
    categoryId: 'food',
    categoryNameSnapshot: 'Alimentación',
    type: 'expense',
    amount: 50,
    date: '2026-10-10',
  } as Transaction;

  const currentUserId = signal<string | null>('user-1');
  const categories = signal<Category[]>([]);
  const transactions = signal<Transaction[]>([]);
  const budgetedCategoryIds = signal<string[]>([]);
  const isLoadingBudgets = signal(false);
  const budgetLoadError = signal<string | null>(null);

  beforeEach(() => {
    currentUserId.set('user-1');
    categories.set([category]);
    transactions.set([transaction]);
    budgetedCategoryIds.set([]);
    isLoadingBudgets.set(false);
    budgetLoadError.set(null);

    failTransactionUpdate = false;
    failCategoryDelete = false;
    reloadCount = 0;
    updatedIds = [];
    deletedIds = [];

    TestBed.configureTestingModule({
      providers: [
        CategoryDeletionService,
        {
          provide: CategoriesStateService,
          useValue: {
            currentUserId,
            categories,
            transactions,
            isLoadingBudgets,
            budgetLoadError,
            hasBudget: (categoryId: string) => budgetedCategoryIds().includes(categoryId),
            applyDeletedCategory: (categoryId: string, updatedTransactions: Transaction[]) => {
              const updatedById = new Map(updatedTransactions.map((item) => [item.id, item]));

              transactions.update((items) => items.map((item) => updatedById.get(item.id) ?? item));

              categories.update((items) => items.filter((item) => item.id !== categoryId));
            },
            reloadAfterDeleteFailure: () => {
              reloadCount++;
            },
          },
        },
        {
          provide: CategoryService,
          useValue: {
            deleteCategory: (categoryId: string) => {
              deletedIds.push(categoryId);

              return failCategoryDelete ? throwError(() => new Error('DELETE_FAILED')) : of(void 0);
            },
          },
        },
        {
          provide: TransactionService,
          useValue: {
            updateTransaction: (
              transactionId: string,
              changes: Pick<Transaction, 'categoryId' | 'categoryNameSnapshot'>,
            ) => {
              updatedIds.push(transactionId);

              return failTransactionUpdate
                ? throwError(() => new Error('UPDATE_FAILED'))
                : of({
                    ...transaction,
                    id: transactionId,
                    ...changes,
                  } as Transaction);
            },
          },
        },
      ],
    });

    service = TestBed.inject(CategoryDeletionService);
  });

  it('should create', () => {
    expect(service).toBeTruthy();
  });

  it('should identify affected transactions', () => {
    transactions.set([
      transaction,
      {
        ...transaction,
        id: 'transaction-2',
        categoryId: 'transport',
      },
    ]);

    expect(service.getAffectedTransactions(category)).toEqual([transaction]);
  });

  it('should block deletion without an authenticated user', () => {
    currentUserId.set(null);

    expect(service.getDeletionBlock(category)?.message).toBe(
      'No se ha podido identificar al usuario actual.',
    );
  });

  it('should block deletion of another user category', () => {
    const otherCategory = {
      ...category,
      userId: 'user-2',
    };

    expect(service.getDeletionBlock(otherCategory)?.message).toBe(
      'No puedes eliminar esta categoría.',
    );
  });

  it('should wait until budgets finish loading', () => {
    isLoadingBudgets.set(true);

    expect(service.getDeletionBlock(category)?.notification).toBe('info');
  });

  it('should block deletion when budget loading failed', () => {
    budgetLoadError.set('Error cargando presupuestos');

    expect(service.getDeletionBlock(category)?.message).toContain('no se ha podido comprobar');
  });

  it('should block deletion when a budget exists', () => {
    budgetedCategoryIds.set(['food']);

    expect(service.getDeletionBlock(category)?.message).toContain('tiene un presupuesto asociado');
  });

  it('should not execute deletion if validation fails', () => {
    budgetedCategoryIds.set(['food']);

    let errorMessage = '';

    service.deleteCategory(category).subscribe({
      error: (error: Error) => {
        errorMessage = error.message;
      },
    });

    expect(errorMessage).toContain('presupuesto asociado');
    expect(updatedIds).toEqual([]);
    expect(deletedIds).toEqual([]);
    expect(categories()).toEqual([category]);
  });

  it('should unlink transactions before deleting the category', () => {
    service.deleteCategory(category).subscribe();

    expect(updatedIds).toEqual(['transaction-1']);
    expect(deletedIds).toEqual(['food']);
    expect(categories()).toEqual([]);
    expect(transactions()[0].categoryId).toBeNull();
    expect(transactions()[0].categoryNameSnapshot).toBe('Alimentación');
    expect(reloadCount).toBe(0);
  });

  it('should delete a category without associated transactions', () => {
    transactions.set([]);

    service.deleteCategory(category).subscribe();

    expect(updatedIds).toEqual([]);
    expect(deletedIds).toEqual(['food']);
    expect(categories()).toEqual([]);
  });

  it('should reload data if unlinking a transaction fails', () => {
    failTransactionUpdate = true;

    let errorMessage = '';

    service.deleteCategory(category).subscribe({
      error: (error: Error) => {
        errorMessage = error.message;
      },
    });

    expect(errorMessage).toBe('UPDATE_FAILED');
    expect(deletedIds).toEqual([]);
    expect(categories()).toEqual([category]);
    expect(reloadCount).toBe(1);
  });

  it('should reload data if deleting the category fails', () => {
    failCategoryDelete = true;

    let errorMessage = '';

    service.deleteCategory(category).subscribe({
      error: (error: Error) => {
        errorMessage = error.message;
      },
    });

    expect(errorMessage).toBe('DELETE_FAILED');
    expect(updatedIds).toEqual(['transaction-1']);
    expect(deletedIds).toEqual(['food']);
    expect(categories()).toEqual([category]);
    expect(reloadCount).toBe(1);
  });
});
