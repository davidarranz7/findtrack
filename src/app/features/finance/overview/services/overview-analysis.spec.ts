import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { Budget, Category, Transaction } from '../../models';
import { BudgetAnalysisService } from '../../services/budget-analysis.service';
import { OverviewAnalysisService } from './overview-analysis';
import { OverviewStateService } from './overview-state';

describe('OverviewAnalysisService', () => {
  const selectedMonth = signal(new Date(2026, 9, 1));

  const selectedMonthKey = computed(() => {
    const date = selectedMonth();

    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  });

  const categories = signal<Category[]>([]);
  const budgets = signal<Budget[]>([]);
  const transactions = signal<Transaction[]>([]);

  const foodCategory: Category = {
    id: 'food',
    userId: 'user-1',
    name: 'Alimentación',
    icon: 'bi-basket',
    color: '#16a34a',
  };

  const makeTransaction = (
    id: string,
    date: string,
    type: Transaction['type'],
    amount: number,
    categoryId: string | null = null,
  ): Transaction =>
    ({
      id,
      date,
      type,
      amount,
      categoryId,
      userId: 'user-1',
    }) as Transaction;

  let service: OverviewAnalysisService;
  let lastBudgetMonth: string;

  beforeEach(() => {
    selectedMonth.set(new Date(2026, 9, 1));
    categories.set([foodCategory]);
    budgets.set([]);

    transactions.set([
      makeTransaction('march', '2026-03-12', 'income', 700),
      makeTransaction('june', '2026-06-12', 'expense', 30, 'food'),
      makeTransaction('september', '2026-09-12', 'income', 1000),
      makeTransaction('october-income', '2026-10-02', 'income', 2000),
      makeTransaction('october-food', '2026-10-05', 'expense', 150, 'food'),
      makeTransaction('october-other', '2026-10-06', 'expense', 50),
      makeTransaction('november', '2026-11-02', 'expense', 9000),
    ]);

    lastBudgetMonth = '';

    TestBed.configureTestingModule({
      providers: [
        OverviewAnalysisService,
        {
          provide: OverviewStateService,
          useValue: {
            selectedMonth,
            selectedMonthKey,
            transactions,
            categories,
            budgets,
          },
        },
        {
          provide: BudgetAnalysisService,
          useValue: {
            getBudgetProgress: (
              ...args: Parameters<BudgetAnalysisService['getBudgetProgress']>
            ) => {
              lastBudgetMonth = args[3];
              return [];
            },
            getBudgetAlert: () => null,
          },
        },
      ],
    });

    service = TestBed.inject(OverviewAnalysisService);
  });

  it('should calculate income, expenses and savings for the selected month', () => {
    expect(service.monthlyTransactions().length).toBe(3);
    expect(service.monthlyIncome()).toBe(2000);
    expect(service.monthlyExpenses()).toBe(200);
    expect(service.monthlySavings()).toBe(1800);
  });

  it('should calculate accumulated balance through the selected month', () => {
    expect(service.availableBalance()).toBe(3470);

    selectedMonth.set(new Date(2026, 8, 1));

    expect(service.availableBalance()).toBe(1670);
    expect(service.monthlyIncome()).toBe(1000);
    expect(service.monthlyExpenses()).toBe(0);
  });

  it('should format the financial summary in euros', () => {
    expect(service.formattedBalance()).toBe(service.formatCurrency(3470));
    expect(service.formattedIncome()).toBe(service.formatCurrency(2000));
    expect(service.formattedExpenses()).toBe(service.formatCurrency(200));
    expect(service.formattedSavings()).toBe(service.formatCurrency(1800));
  });

  it('should include six months in the income and expense history', () => {
    const history = service.incomeExpenseHistory();

    expect(history.length).toBe(6);
    expect(history[0].income).toBe(0);
    expect(history[0].expense).toBe(0);
    expect(history[1].expense).toBe(30);
    expect(history[4].income).toBe(1000);
    expect(history[5].income).toBe(2000);
    expect(history[5].expense).toBe(200);
    expect(service.hasIncomeExpenseData()).toBe(true);
  });

  it('should correctly cross the year boundary in the historical chart', () => {
    selectedMonth.set(new Date(2026, 0, 1));

    transactions.set([makeTransaction('december', '2025-12-03', 'expense', 40)]);

    const history = service.incomeExpenseHistory();

    expect(history.length).toBe(6);
    expect(history[4].expense).toBe(40);
    expect(history[5].income).toBe(0);
  });

  it('should show no chart data when there are no movements', () => {
    transactions.set([]);

    expect(service.hasIncomeExpenseData()).toBe(false);
    expect(
      service.incomeExpenseHistory().every((month) => month.income === 0 && month.expense === 0),
    ).toBe(true);
    expect(service.expenseDistribution()).toEqual([]);
  });

  it('should group expenses by category and calculate percentages', () => {
    const distribution = service.expenseDistribution();

    expect(distribution.length).toBe(2);
    expect(distribution[0]).toMatchObject({
      categoryId: 'food',
      categoryName: 'Alimentación',
      amount: 150,
      percentage: 75,
      color: '#16a34a',
    });

    expect(distribution[1]).toMatchObject({
      categoryId: 'uncategorized',
      categoryName: 'Sin categoría',
      amount: 50,
      percentage: 25,
    });
  });

  it('should display unknown categories as uncategorized', () => {
    categories.set([]);

    expect(service.expenseDistribution()[0].categoryName).toBe('Sin categoría');
    expect(service.expenseDistribution()[0].color).toBe('#6c757d');
  });

  it('should keep the five most recent transactions', () => {
    transactions.set(
      Array.from({ length: 7 }, (_, index) =>
        makeTransaction(
          `item-${index}`,
          `2026-10-${String(index + 1).padStart(2, '0')}`,
          'income',
          10,
        ),
      ),
    );

    expect(service.latestTransactions().length).toBe(5);
    expect(service.latestTransactions()[0].id).toBe('item-6');
    expect(service.latestTransactions()[4].id).toBe('item-2');
    expect(transactions()[0].id).toBe('item-0');
  });

  it('should preserve historical category names', () => {
    expect(service.getCategoryName('food', 'Nombre anterior')).toBe('Alimentación');
    expect(service.getCategoryName(null, 'Viajes')).toBe('Viajes (eliminada)');
    expect(service.getCategoryName('missing')).toBe('Sin categoría');
    expect(service.getCategoryName(null)).toBe('Sin categoría');
  });

  it('should format amounts and dates correctly', () => {
    const income = makeTransaction('income', '2026-10-02', 'income', 30);
    const expense = makeTransaction('expense', '2026-10-02', 'expense', 30);
    const today = new Date();

    const todayKey =
      `${today.getFullYear()}-` +
      `${String(today.getMonth() + 1).padStart(2, '0')}-` +
      `${String(today.getDate()).padStart(2, '0')}`;

    expect(service.formatTransactionAmount(income)).toBe(`+${service.formatCurrency(30)}`);
    expect(service.formatTransactionAmount(expense)).toBe(`-${service.formatCurrency(30)}`);
    expect(service.formatTransactionDate(todayKey)).toBe('Hoy');
  });

  it('should recalculate when a new transaction is added', () => {
    transactions.update((items) => [
      ...items,
      makeTransaction('new-expense', '2026-10-18', 'expense', 100),
    ]);

    expect(service.monthlyExpenses()).toBe(300);
    expect(service.monthlySavings()).toBe(1700);
    expect(service.availableBalance()).toBe(3370);
    expect(service.expenseDistribution()[0].percentage).toBe(50);
  });

  it('should reuse BudgetAnalysisService for the selected month', () => {
    expect(service.budgetProgress()).toEqual([]);
    expect(lastBudgetMonth).toBe('2026-10');
    expect(service.budgetAlert()).toBeNull();

    selectedMonth.set(new Date(2026, 8, 1));
    service.budgetProgress();

    expect(lastBudgetMonth).toBe('2026-09');
  });
});
