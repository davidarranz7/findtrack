import { signal, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Budget, Category, Transaction } from '../../../models';
import { BudgetAnalysisService } from '../../../services/budget-analysis.service';
import { BudgetsStateService } from '../../services/budgets-state';
import { formatBudgetCurrency } from '../../utils/budget-format.utils';
import { BudgetsSummary } from './budgets-summary';

describe('BudgetsSummary', () => {
  let fixture: ComponentFixture<BudgetsSummary>;
  let budgets: WritableSignal<Budget[]>;
  let transactions: WritableSignal<Transaction[]>;
  let selectedMonth: WritableSignal<string>;
  let isLoading: WritableSignal<boolean>;

  const foodBudget = {
    id: 'budget-food',
    userId: 'user-1',
    categoryId: 'food',
    amount: 500,
    month: '2026-10',
  } as Budget;

  const transportBudget = {
    id: 'budget-transport',
    userId: 'user-1',
    categoryId: 'transport',
    amount: 200,
    month: '2026-10',
  } as Budget;

  const categories = [
    {
      id: 'food',
      name: 'Alimentación',
      color: '#16a34a',
    } as Category,
    {
      id: 'transport',
      name: 'Transporte',
      color: '#2563eb',
    } as Category,
  ];

  const foodExpense = {
    id: 'expense-food',
    userId: 'user-1',
    type: 'expense',
    amount: 125,
    description: 'Compra',
    categoryId: 'food',
    date: '2026-10-15',
    paymentMethod: 'card',
    notes: '',
  } as Transaction;

  const transportExpense = {
    ...foodExpense,
    id: 'expense-transport',
    categoryId: 'transport',
    amount: 50,
  } as Transaction;

  const septemberExpense = {
    ...foodExpense,
    id: 'expense-september',
    amount: 40,
    date: '2026-09-12',
  } as Transaction;

  const income = {
    ...foodExpense,
    id: 'income-1',
    type: 'income',
    amount: 1000,
  } as Transaction;

  beforeEach(async () => {
    budgets = signal<Budget[]>([foodBudget, transportBudget]);
    transactions = signal<Transaction[]>([foodExpense, transportExpense, septemberExpense, income]);
    selectedMonth = signal('2026-10');
    isLoading = signal(false);

    await TestBed.configureTestingModule({
      imports: [BudgetsSummary],
      providers: [
        BudgetAnalysisService,
        {
          provide: BudgetsStateService,
          useValue: {
            budgets,
            categories: signal<Category[]>(categories),
            transactions,
            selectedMonth,
            isLoading,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BudgetsSummary);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render the three summary cards', () => {
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelectorAll('.budget-summary-card').length).toBe(3);
    expect(element.textContent).toContain('Presupuesto total');
    expect(element.textContent).toContain('Gastado');
    expect(element.textContent).toContain('Restante');
  });

  it('should calculate the total budget, expenses and remaining amount', () => {
    const values = fixture.nativeElement.querySelectorAll(
      '.budget-summary-value',
    ) as NodeListOf<HTMLElement>;

    expect(values[0].textContent?.trim()).toBe(formatBudgetCurrency(700));
    expect(values[1].textContent?.trim()).toBe(formatBudgetCurrency(175));
    expect(values[2].textContent?.trim()).toBe(formatBudgetCurrency(525));

    expect(fixture.nativeElement.textContent).toContain('25 %');
  });

  it('should ignore income and expenses from other months', () => {
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelectorAll('.budget-summary-value')[1].textContent).toContain(
      formatBudgetCurrency(175),
    );

    selectedMonth.set('2026-09');
    fixture.detectChanges();

    expect(element.querySelectorAll('.budget-summary-value')[1].textContent).toContain(
      formatBudgetCurrency(40),
    );
  });

  it('should update the amounts when budgets change', () => {
    budgets.set([foodBudget]);
    fixture.detectChanges();

    const values = fixture.nativeElement.querySelectorAll(
      '.budget-summary-value',
    ) as NodeListOf<HTMLElement>;

    expect(values[0].textContent?.trim()).toBe(formatBudgetCurrency(500));
    expect(values[1].textContent?.trim()).toBe(formatBudgetCurrency(125));
    expect(values[2].textContent?.trim()).toBe(formatBudgetCurrency(375));
  });

  it('should show a negative remaining amount in red', () => {
    transactions.set([
      { ...foodExpense, amount: 800 },
      { ...transportExpense, amount: 300 },
    ]);

    fixture.detectChanges();

    const values = fixture.nativeElement.querySelectorAll(
      '.budget-summary-value',
    ) as NodeListOf<HTMLElement>;

    expect(values[2].textContent?.trim()).toBe(formatBudgetCurrency(-400));
    expect(values[2].classList.contains('text-danger')).toBe(true);
    expect(values[2].classList.contains('text-success')).toBe(false);
  });

  it('should display zero totals without budgets', () => {
    budgets.set([]);
    fixture.detectChanges();

    const values = fixture.nativeElement.querySelectorAll(
      '.budget-summary-value',
    ) as NodeListOf<HTMLElement>;

    expect(values.length).toBe(3);
    expect(values[0].textContent?.trim()).toBe(formatBudgetCurrency(0));
    expect(values[1].textContent?.trim()).toBe(formatBudgetCurrency(0));
    expect(values[2].textContent?.trim()).toBe(formatBudgetCurrency(0));

    expect(fixture.nativeElement.textContent).toContain('0 %');
  });

  it('should show loading indicators while data is loading', () => {
    isLoading.set(true);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelectorAll('.spinner-border').length).toBe(3);
    expect(element.querySelectorAll('.budget-summary-value').length).toBe(0);
  });
});
