import { TestBed } from '@angular/core/testing';

import { Budget, Category, Transaction } from '../models';
import { BudgetAnalysisService } from './budget-analysis.service';

describe('BudgetAnalysisService', () => {
  let service: BudgetAnalysisService;

  const categories: Category[] = [
    {
      id: 'category-food',
      userId: 'user-1',
      name: 'Alimentación',
      icon: 'bi-basket',
      color: '#fd7e14',
    },
  ];

  const budgets: Budget[] = [
    {
      id: 'budget-1',
      userId: 'user-1',
      categoryId: 'category-food',
      amount: 100,
      month: '2026-10',
    },
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({});

    service = TestBed.inject(BudgetAnalysisService);
  });

  it('should create', () => {
    expect(service).toBeTruthy();
  });

  it('should mark a budget as warning at 80 percent', () => {
    const transactions: Transaction[] = [
      {
        id: 'transaction-1',
        userId: 'user-1',
        type: 'expense',
        amount: 80,
        description: 'Compra',
        categoryId: 'category-food',
        date: '2026-10-08',
        paymentMethod: 'card',
        notes: '',
      },
    ];

    const [budget] = service.getBudgetProgress(budgets, transactions, categories, '2026-10');

    expect(budget.status).toBe('warning');

    expect(budget.percentage).toBe(80);
  });

  it('should mark a budget as exceeded at 100 percent', () => {
    const transactions: Transaction[] = [
      {
        id: 'transaction-1',
        userId: 'user-1',
        type: 'expense',
        amount: 100,
        description: 'Compra',
        categoryId: 'category-food',
        date: '2026-10-08',
        paymentMethod: 'card',
        notes: '',
      },
    ];

    const [budget] = service.getBudgetProgress(budgets, transactions, categories, '2026-10');

    expect(budget.status).toBe('exceeded');

    expect(budget.percentage).toBe(100);
  });

  it('should prioritize an exceeded budget alert', () => {
    const transactions: Transaction[] = [
      {
        id: 'transaction-1',
        userId: 'user-1',
        type: 'expense',
        amount: 120,
        description: 'Compra',
        categoryId: 'category-food',
        date: '2026-10-08',
        paymentMethod: 'card',
        notes: '',
      },
    ];

    const progress = service.getBudgetProgress(budgets, transactions, categories, '2026-10');

    const alert = service.getBudgetAlert(progress);

    expect(alert.status).toBe('exceeded');

    expect(alert.budget?.budgetId).toBe('budget-1');
  });
});
