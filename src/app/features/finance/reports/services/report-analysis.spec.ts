import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import type { Transaction } from '../../models';
import { ReportAnalysisService } from './report-analysis';
import { ReportStateService } from './report-state';

describe('ReportAnalysisService', () => {
  let service: ReportAnalysisService;

  const today = new Date();
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

  beforeEach(() => {
    const transactions = signal<Transaction[]>([
      {
        date: `${currentMonth}-05`,
        type: 'income',
        amount: 1000,
        categoryId: null,
        paymentMethod: 'card',
      } as Transaction,
      {
        date: `${currentMonth}-10`,
        type: 'expense',
        amount: 400,
        categoryId: 'food',
        paymentMethod: 'card',
      } as Transaction,
    ]);

    TestBed.configureTestingModule({
      providers: [
        ReportAnalysisService,
        {
          provide: ReportStateService,
          useValue: {
            transactions,
            selectedYear: signal(today.getFullYear()),
            selectedPeriod: signal(1),
            selectedCategoryIds: signal<string[]>([]),
            selectedPaymentMethod: signal('all'),
          },
        },
      ],
    });

    service = TestBed.inject(ReportAnalysisService);
  });

  it('should create', () => {
    expect(service).toBeTruthy();
  });

  it('should calculate income and expenses', () => {
    expect(service.totalIncome()).toBe(1000);
    expect(service.totalExpenses()).toBe(400);
  });

  it('should calculate the net balance', () => {
    expect(service.netBalance()).toBe(600);
  });

  it('should calculate the savings rate', () => {
    expect(service.savingsRate()).toBe(60);
  });

  it('should format financial amounts', () => {
    expect(service.formatCurrency(1000)).toBe(
      new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency: 'EUR',
      }).format(1000),
    );
  });

  it('should identify available report data', () => {
    expect(service.hasReportData()).toBe(true);
    expect(service.filteredTransactions().length).toBe(2);
  });
});
