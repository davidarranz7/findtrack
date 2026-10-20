import { signal, WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { Transaction } from '../../models';
import { TransactionsFiltersService } from './transactions-filters';
import { TransactionsSummaryService } from './transactions-summary';

describe('TransactionsSummaryService', () => {
  let service: TransactionsSummaryService;
  let monthlyTransactions: WritableSignal<Transaction[]>;

  const income = {
    id: 'income-1',
    userId: 'user-1',
    type: 'income',
    amount: 1500,
    description: 'Nómina',
    categoryId: 'category-1',
    categoryNameSnapshot: 'Trabajo',
    date: '2026-10-15',
    paymentMethod: 'bankTransfer',
    notes: '',
  } as Transaction;

  const expense = {
    ...income,
    id: 'expense-1',
    type: 'expense',
    amount: 350,
    description: 'Alquiler',
    categoryId: 'category-2',
    categoryNameSnapshot: 'Vivienda',
  } as Transaction;

  beforeEach(() => {
    monthlyTransactions = signal<Transaction[]>([]);

    TestBed.configureTestingModule({
      providers: [
        TransactionsSummaryService,
        {
          provide: TransactionsFiltersService,
          useValue: {
            transactionsInSelectedMonth: monthlyTransactions,
          },
        },
      ],
    });

    service = TestBed.inject(TransactionsSummaryService);
  });

  it('should create', () => {
    expect(service).toBeTruthy();
  });

  it('should calculate zero totals without transactions', () => {
    expect(service.totalTransactionsInSelectedMonth()).toBe(0);
    expect(service.incomeCount()).toBe(0);
    expect(service.expenseCount()).toBe(0);
    expect(service.monthlyIncome()).toBe(0);
    expect(service.monthlyExpenses()).toBe(0);
    expect(service.operatingBalance()).toBe(0);
  });

  it('should calculate income, expenses and operating balance', () => {
    monthlyTransactions.set([income, expense]);

    expect(service.totalTransactionsInSelectedMonth()).toBe(2);
    expect(service.incomeCount()).toBe(1);
    expect(service.expenseCount()).toBe(1);
    expect(service.monthlyIncome()).toBe(1500);
    expect(service.monthlyExpenses()).toBe(350);
    expect(service.operatingBalance()).toBe(1150);
  });

  it('should recalculate totals when transactions change', () => {
    monthlyTransactions.set([income]);

    expect(service.operatingBalance()).toBe(1500);

    monthlyTransactions.set([income, expense]);

    expect(service.operatingBalance()).toBe(1150);

    monthlyTransactions.set([]);

    expect(service.operatingBalance()).toBe(0);
  });

  it('should calculate a negative operating balance', () => {
    monthlyTransactions.set([
      {
        ...income,
        amount: 100,
      },
      {
        ...expense,
        amount: 250,
      },
    ]);

    expect(service.operatingBalance()).toBe(-150);
  });

  it('should format amounts in euros', () => {
    const formatter = new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
    });

    monthlyTransactions.set([income, expense]);

    expect(service.formattedMonthlyIncome()).toBe(formatter.format(1500));

    expect(service.formattedMonthlyExpenses()).toBe(`-${formatter.format(350)}`);

    expect(service.formattedOperatingBalance()).toBe(formatter.format(1150));
  });

  it('should display zero expenses without a negative sign', () => {
    monthlyTransactions.set([income]);

    const formatter = new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
    });

    expect(service.formattedMonthlyExpenses()).toBe(formatter.format(0));
  });
});
