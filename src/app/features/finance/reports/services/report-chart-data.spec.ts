import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import type { Category, Transaction } from '../../models';
import { ReportAnalysisService } from './report-analysis';
import { ReportChartDataService } from './report-chart-data';
import { ReportStateService } from './report-state';

describe('ReportChartDataService', () => {
  let service: ReportChartDataService;

  const today = new Date();
  const monthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

  const transactions = signal<Transaction[]>([]);
  const categories = signal<Category[]>([]);

  beforeEach(() => {
    transactions.set([]);
    categories.set([]);

    TestBed.configureTestingModule({
      providers: [
        ReportChartDataService,
        {
          provide: ReportStateService,
          useValue: {
            categories,
            selectedCategoryIds: signal<string[]>([]),
          },
        },
        {
          provide: ReportAnalysisService,
          useValue: {
            filteredTransactions: transactions,
            paymentFilteredTransactions: transactions,
            reportMonths: signal([{ key: monthKey, label: 'Mes' }]),
          },
        },
      ],
    });

    service = TestBed.inject(ReportChartDataService);
  });

  it('should create', () => {
    expect(service).toBeTruthy();
  });

  it('should return an empty expense distribution without expenses', () => {
    expect(service.expenseDistribution()).toEqual([]);
    expect(service.topExpenseCategories()).toEqual([]);
  });

  it('should prepare monthly income and expense data', () => {
    transactions.set([
      {
        date: `${monthKey}-05`,
        type: 'income',
        amount: 500,
        categoryId: null,
      } as Transaction,
      {
        date: `${monthKey}-10`,
        type: 'expense',
        amount: 200,
        categoryId: 'food',
      } as Transaction,
    ]);

    expect(service.incomeExpenseHistory()).toEqual([
      {
        label: 'Mes',
        income: 500,
        expense: 200,
      },
    ]);
  });

  it('should calculate the accumulated balance', () => {
    transactions.set([
      {
        date: `${monthKey}-05`,
        type: 'income',
        amount: 500,
      } as Transaction,
      {
        date: `${monthKey}-10`,
        type: 'expense',
        amount: 200,
      } as Transaction,
    ]);

    expect(service.balanceEvolution()).toEqual([
      {
        label: 'Mes',
        balance: 300,
      },
    ]);
  });

  it('should calculate the expense ranking', () => {
    categories.set([
      {
        id: 'food',
        name: 'Alimentación',
        color: '#2563eb',
      } as Category,
    ]);

    transactions.set([
      {
        date: `${monthKey}-10`,
        type: 'expense',
        amount: 200,
        categoryId: 'food',
      } as Transaction,
    ]);

    expect(service.topExpenseCategories()[0].categoryName).toBe('Alimentación');
    expect(service.topExpenseCategories()[0].amount).toBe(200);
  });
});
