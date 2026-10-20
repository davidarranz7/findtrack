import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { AuthService } from '../../../auth/services/auth.service';
import { Category, Transaction } from '../../models';
import { CategoryService } from '../../services/category.service';
import { TransactionService } from '../../services/transaction.service';
import { TransactionsStateService } from './transactions-state';

describe('TransactionsStateService', () => {
  let service: TransactionsStateService;
  let deletedIds: string[];
  let deleteFails: boolean;

  const currentUser = signal({
    id: 'user-1',
    username: 'usuario',
    email: 'usuario@example.com',
  });

  const category = {
    id: 'category-1',
    name: 'Alimentación',
  } as Category;

  const transaction = {
    id: 'transaction-1',
    userId: 'user-1',
    type: 'expense',
    amount: 25,
    description: 'Compra',
    categoryId: 'category-1',
    categoryNameSnapshot: 'Alimentación',
    date: '2026-10-19',
    paymentMethod: 'card',
    notes: '',
  } as Transaction;

  beforeEach(() => {
    deletedIds = [];
    deleteFails = false;

    TestBed.configureTestingModule({
      providers: [
        TransactionsStateService,
        {
          provide: AuthService,
          useValue: {
            currentUser,
          },
        },
        {
          provide: TransactionService,
          useValue: {
            getTransactions: () => of([{ ...transaction }]),
            deleteTransaction: (id: string) => {
              deletedIds.push(id);

              return deleteFails ? throwError(() => new Error('DELETE_FAILED')) : of(undefined);
            },
          },
        },
        {
          provide: CategoryService,
          useValue: {
            getCategories: () => of([{ ...category }]),
          },
        },
      ],
    });

    service = TestBed.inject(TransactionsStateService);
  });

  it('should create', () => {
    expect(service).toBeTruthy();
  });

  it('should load transactions and categories', () => {
    expect(service.transactions()).toEqual([transaction]);
    expect(service.categories()).toEqual([category]);
    expect(service.totalTransactions()).toBe(1);
    expect(service.isLoading()).toBe(false);
    expect(service.isLoadingCategories()).toBe(false);
  });

  it('should add a transaction', () => {
    const newTransaction = {
      ...transaction,
      id: 'transaction-2',
      amount: 50,
    };

    service.addTransaction(newTransaction);

    expect(service.totalTransactions()).toBe(2);
    expect(service.transactions()[0]).toEqual(newTransaction);
  });

  it('should update an existing transaction', () => {
    const updatedTransaction = {
      ...transaction,
      amount: 80,
      description: 'Compra actualizada',
    };

    service.updateTransaction(updatedTransaction);

    expect(service.totalTransactions()).toBe(1);
    expect(service.transactions()[0]).toEqual(updatedTransaction);
  });

  it('should remove a transaction after successful deletion', () => {
    service.deleteTransaction('transaction-1').subscribe();

    expect(deletedIds).toEqual(['transaction-1']);
    expect(service.transactions()).toEqual([]);
    expect(service.totalTransactions()).toBe(0);
  });

  it('should preserve the transaction when deletion fails', () => {
    deleteFails = true;
    let receivedError: Error | null = null;

    service.deleteTransaction('transaction-1').subscribe({
      error: (error: Error) => {
        receivedError = error;
      },
    });

    expect(receivedError).not.toBeNull();
    expect(service.transactions()).toEqual([transaction]);
    expect(service.totalTransactions()).toBe(1);
  });
});
