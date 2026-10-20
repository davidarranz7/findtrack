import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Budget, Category, Transaction } from '../../models';
import { BudgetAnalysisService } from '../../services/budget-analysis.service';
import { BudgetsStateService } from '../services/budgets-state';
import { BudgetsList } from './budgets-list';

describe('BudgetsList', () => {
  let fixture: ComponentFixture<BudgetsList>;

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

  const availableCategories: Category[] = [
    {
      id: 'food',
      name: 'Alimentación',
      color: '#16a34a',
      icon: 'bi-basket',
    } as Category,
    {
      id: 'transport',
      name: 'Transporte',
      color: '#2563eb',
      icon: 'bi-bus-front',
    } as Category,
    {
      id: 'other',
      name: 'Otros',
      color: '#64748b',
      icon: 'bi-tag',
    } as Category,
  ];

  const foodExpense = {
    id: 'expense-food',
    userId: 'user-1',
    type: 'expense',
    amount: 450,
    description: 'Supermercado',
    categoryId: 'food',
    date: '2026-10-15',
    paymentMethod: 'card',
    notes: '',
  } as Transaction;

  const transportExpense = {
    ...foodExpense,
    id: 'expense-transport',
    amount: 250,
    description: 'Transporte',
    categoryId: 'transport',
  } as Transaction;

  const budgets = signal<Budget[]>([]);
  const categories = signal<Category[]>([]);
  const transactions = signal<Transaction[]>([]);
  const selectedMonth = signal('2026-10');
  const isLoading = signal(false);
  const loadError = signal<string | null>(null);

  const canCreateBudget = computed(() =>
    categories().some((category) => !budgets().some((budget) => budget.categoryId === category.id)),
  );

  beforeEach(async () => {
    budgets.set([foodBudget, transportBudget]);
    categories.set([...availableCategories]);
    transactions.set([foodExpense, transportExpense]);
    selectedMonth.set('2026-10');
    isLoading.set(false);
    loadError.set(null);

    await TestBed.configureTestingModule({
      imports: [BudgetsList],
      providers: [
        BudgetAnalysisService,
        {
          provide: BudgetsStateService,
          useValue: {
            budgets,
            categories,
            transactions,
            selectedMonth,
            isLoading,
            loadError,
            canCreateBudget,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BudgetsList);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should display the budgets in their original order', () => {
    const element = fixture.nativeElement as HTMLElement;
    const names = element.querySelectorAll('.budget-category-name');

    expect(names.length).toBe(2);
    expect(names[0].textContent).toContain('Alimentación');
    expect(names[1].textContent).toContain('Transporte');
    expect(element.textContent).toMatch(/2\s+presupuestos/);
  });

  it('should display warning and exceeded statuses', () => {
    const element = fixture.nativeElement as HTMLElement;
    const cards = element.querySelectorAll('.budget-card');

    expect(cards[0].classList.contains('budget-card-warning')).toBe(true);
    expect(cards[1].classList.contains('budget-card-exceeded')).toBe(true);

    expect(cards[0].textContent).toContain('Cerca del límite');
    expect(cards[1].textContent).toContain('Superado');

    const progressBars = element.querySelectorAll(
      '.budget-progress-bar',
    ) as NodeListOf<HTMLElement>;

    expect(progressBars[0].style.width).toBe('90%');
    expect(progressBars[1].style.width).toBe('100%');
  });

  it('should show a normal status below 80 percent', () => {
    transactions.set([
      { ...foodExpense, amount: 100 },
      { ...transportExpense, amount: 50 },
    ]);

    fixture.detectChanges();

    const cards = fixture.nativeElement.querySelectorAll('.budget-card') as NodeListOf<HTMLElement>;

    expect(cards[0].classList.contains('budget-card-warning')).toBe(false);
    expect(cards[0].textContent).toContain('En control');
    expect(cards[1].textContent).toContain('En control');
  });

  it('should only mark a budget as exceeded above 100 percent', () => {
    transactions.set([
      { ...foodExpense, amount: 500 },
      { ...transportExpense, amount: 200 },
    ]);

    fixture.detectChanges();

    let cards = fixture.nativeElement.querySelectorAll('.budget-card') as NodeListOf<HTMLElement>;

    expect(cards[0].classList.contains('budget-card-warning')).toBe(true);
    expect(cards[1].classList.contains('budget-card-warning')).toBe(true);

    transactions.set([
      { ...foodExpense, amount: 500 },
      { ...transportExpense, amount: 201 },
    ]);

    fixture.detectChanges();

    cards = fixture.nativeElement.querySelectorAll('.budget-card') as NodeListOf<HTMLElement>;

    expect(cards[1].classList.contains('budget-card-exceeded')).toBe(true);
  });

  it('should emit the selected budget when editing', () => {
    let selectedBudget: Budget | null = null;

    fixture.componentInstance.editRequested.subscribe((budget) => {
      selectedBudget = budget;
    });

    const button = fixture.nativeElement.querySelector(
      '.budget-card:first-child button[aria-label="Editar presupuesto"]',
    ) as HTMLButtonElement;

    button.click();

    expect(selectedBudget).toEqual(foodBudget);
  });

  it('should emit the selected budget when deleting', () => {
    let selectedBudget: Budget | null = null;

    fixture.componentInstance.deleteRequested.subscribe((budget) => {
      selectedBudget = budget;
    });

    const button = fixture.nativeElement.querySelector(
      '.budget-card:first-child button[aria-label="Eliminar presupuesto"]',
    ) as HTMLButtonElement;

    button.click();

    expect(selectedBudget).toEqual(foodBudget);
  });

  it('should disable deletion buttons while processing', () => {
    fixture.componentRef.setInput('isDeletingBudget', true);
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll(
      'button[aria-label="Eliminar presupuesto"]',
    ) as NodeListOf<HTMLButtonElement>;

    expect(buttons.length).toBe(2);
    expect(buttons[0].disabled).toBe(true);
    expect(buttons[1].disabled).toBe(true);
  });

  it('should allow creating the first budget', () => {
    budgets.set([]);
    fixture.detectChanges();

    let createRequested = false;

    fixture.componentInstance.createRequested.subscribe(() => {
      createRequested = true;
    });

    const element = fixture.nativeElement as HTMLElement;
    const button = element.querySelector('.budgets-empty button') as HTMLButtonElement;

    expect(element.textContent).toContain('No tienes presupuestos este mes');
    expect(button.disabled).toBe(false);

    button.click();

    expect(createRequested).toBe(true);
  });

  it('should disable creation when no categories are available', () => {
    budgets.set([]);
    categories.set([]);
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector(
      '.budgets-empty button',
    ) as HTMLButtonElement;

    expect(button.disabled).toBe(true);
  });

  it('should show loading and error states', () => {
    isLoading.set(true);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain('Cargando tus presupuestos...');
    expect(element.querySelectorAll('.budget-card').length).toBe(0);

    isLoading.set(false);
    loadError.set('No se han podido cargar tus presupuestos.');
    fixture.detectChanges();

    expect(element.querySelector('.budgets-grid')).toBeNull();
    expect(element.querySelector('.budgets-empty')).toBeNull();
  });

  it('should show a fallback when a category is unavailable', () => {
    categories.set(availableCategories.filter((category) => category.id !== 'food'));

    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain('Categoría no disponible');
  });

  it('should recalculate expenses when the selected month changes', () => {
    transactions.set([
      foodExpense,
      {
        ...foodExpense,
        id: 'expense-september',
        amount: 50,
        date: '2026-09-10',
      },
    ]);

    selectedMonth.set('2026-09');
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain('Septiembre de 2026');

    const firstCard = element.querySelector('.budget-card') as HTMLElement;

    expect(firstCard.textContent).toContain('50,00');
    expect(firstCard.textContent).toContain('En control');
  });
});
