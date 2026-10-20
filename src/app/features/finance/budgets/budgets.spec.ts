import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of, throwError } from 'rxjs';

import { ConfirmDialog } from '../../../shared/ui/confirm-dialog/confirm-dialog';
import { AuthService } from '../../auth/services/auth.service';
import { Budget, Category, Transaction } from '../models';
import { BudgetService } from '../services/budget.service';
import { CategoryService } from '../services/category.service';
import { TransactionService } from '../services/transaction.service';
import { BudgetForm } from './budget-form/budget-form';
import { BudgetsStateService } from './services/budgets-state';
import { Budgets } from './budgets';

describe('Budgets', () => {
  let fixture: ComponentFixture<Budgets>;
  let state: BudgetsStateService;
  let storedBudgets: Budget[];
  let requestedMonths: string[];
  let failCreate: boolean;
  let failDelete: boolean;

  const today = new Date();
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

  const initialBudget = {
    id: 'budget-1',
    userId: 'user-1',
    categoryId: 'food',
    amount: 500,
    month: currentMonth,
  } as Budget;

  const categories = [
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
  ];

  const transactions = [
    {
      id: 'transaction-1',
      userId: 'user-1',
      type: 'expense',
      amount: 125,
      categoryId: 'food',
      description: 'Supermercado',
      date: `${currentMonth}-15`,
    } as Transaction,
  ];

  const getButton = (selector: string): HTMLButtonElement =>
    fixture.nativeElement.querySelector(selector) as HTMLButtonElement;

  const getForm = (): BudgetForm =>
    fixture.debugElement.query(By.directive(BudgetForm)).componentInstance as BudgetForm;

  const getDialog = (): ConfirmDialog =>
    fixture.debugElement.query(By.directive(ConfirmDialog)).componentInstance as ConfirmDialog;

  beforeEach(async () => {
    storedBudgets = [{ ...initialBudget }];
    requestedMonths = [];
    failCreate = false;
    failDelete = false;

    await TestBed.configureTestingModule({
      imports: [Budgets],
      providers: [
        {
          provide: AuthService,
          useValue: {
            currentUser: signal({ id: 'user-1' }),
          },
        },
        {
          provide: BudgetService,
          useValue: {
            getBudgets: (_userId: string, month: string) => {
              requestedMonths.push(month);
              return of(storedBudgets.filter((budget) => budget.month === month));
            },
            createBudget: (payload: Omit<Budget, 'id'>) => {
              if (failCreate) {
                return throwError(() => new Error('CREATE_FAILED'));
              }

              const created = { ...payload, id: 'budget-2' } as Budget;
              storedBudgets.push(created);
              return of(created);
            },
            updateBudget: (budgetId: string, changes: Pick<Budget, 'amount'>) => {
              const original = storedBudgets.find((budget) => budget.id === budgetId)!;

              const updated = { ...original, ...changes };
              storedBudgets = storedBudgets.map((budget) =>
                budget.id === budgetId ? updated : budget,
              );

              return of(updated);
            },
            deleteBudget: (budgetId: string) => {
              if (failDelete) {
                return throwError(() => new Error('DELETE_FAILED'));
              }

              storedBudgets = storedBudgets.filter((budget) => budget.id !== budgetId);

              return of(void 0);
            },
          },
        },
        {
          provide: CategoryService,
          useValue: {
            getCategories: () => of(categories),
          },
        },
        {
          provide: TransactionService,
          useValue: {
            getTransactions: () => of(transactions),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Budgets);
    state = fixture.debugElement.injector.get(BudgetsStateService);
    fixture.detectChanges();
  });

  it('should create and load the initial budgets', () => {
    expect(fixture.componentInstance).toBeTruthy();
    expect(state.budgets()).toEqual([initialBudget]);
    expect(state.isLoading()).toBe(false);

    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelectorAll('.budget-summary-card').length).toBe(3);
    expect(element.querySelectorAll('.budget-card').length).toBe(1);
    expect(element.textContent).toContain('Alimentación');
  });

  it('should create a new budget through the form', () => {
    getButton('.budgets-header-actions button').click();
    fixture.detectChanges();

    getForm().submitted.emit({
      categoryId: 'transport',
      amount: 200,
    });
    fixture.detectChanges();

    expect(state.budgets().length).toBe(2);
    expect(state.budgets()[1].categoryId).toBe('transport');
    expect(state.budgets()[1].amount).toBe(200);
    expect(state.budgets()[1].month).toBe(currentMonth);

    expect(fixture.nativeElement.querySelectorAll('.budget-card').length).toBe(2);

    expect(fixture.debugElement.query(By.directive(BudgetForm))).toBeNull();
  });

  it('should prevent two budgets for the same category and month', () => {
    getButton('.budgets-header-actions button').click();
    fixture.detectChanges();

    getForm().submitted.emit({
      categoryId: 'food',
      amount: 300,
    });
    fixture.detectChanges();

    expect(state.budgets().length).toBe(1);
    expect(getForm().errorMessage()).toContain('Esta categoría ya tiene un presupuesto');
  });

  it('should edit an existing budget', () => {
    getButton('[aria-label="Editar presupuesto"]').click();
    fixture.detectChanges();

    expect(getForm().budget()?.id).toBe('budget-1');

    getForm().submitted.emit({
      categoryId: 'food',
      amount: 750,
    });
    fixture.detectChanges();

    expect(state.budgets()[0].amount).toBe(750);
    expect(state.budgets().length).toBe(1);
    expect(fixture.debugElement.query(By.directive(BudgetForm))).toBeNull();
  });

  it('should delete a budget after confirmation', () => {
    getButton('[aria-label="Eliminar presupuesto"]').click();
    fixture.detectChanges();

    expect(getDialog()).toBeTruthy();

    getDialog().confirmed.emit();
    fixture.detectChanges();

    expect(state.budgets()).toEqual([]);
    expect(fixture.debugElement.query(By.directive(ConfirmDialog))).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('No tienes presupuestos este mes');
  });

  it('should keep the budget and show an error if deletion fails', () => {
    failDelete = true;

    getButton('[aria-label="Eliminar presupuesto"]').click();
    fixture.detectChanges();

    getDialog().confirmed.emit();
    fixture.detectChanges();

    expect(state.budgets().length).toBe(1);
    expect(getDialog().errorMessage()).toContain('No se ha podido eliminar el presupuesto');
  });

  it('should keep the form open if creation fails', () => {
    failCreate = true;

    getButton('.budgets-header-actions button').click();
    fixture.detectChanges();

    getForm().submitted.emit({
      categoryId: 'transport',
      amount: 200,
    });
    fixture.detectChanges();

    expect(state.budgets().length).toBe(1);
    expect(getForm().errorMessage()).toContain('No se ha podido crear el presupuesto');
    expect(getForm().isSaving()).toBe(false);
  });

  it('should load the selected month without modifying other budgets', () => {
    const monthInput = fixture.nativeElement.querySelector(
      'input[type="month"]',
    ) as HTMLInputElement;

    monthInput.value = '2030-05';
    monthInput.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(state.selectedMonth()).toBe('2030-05');
    expect(requestedMonths).toContain('2030-05');
    expect(state.budgets()).toEqual([]);
    expect(storedBudgets).toEqual([initialBudget]);

    expect(fixture.nativeElement.textContent).toContain('No tienes presupuestos este mes');
  });
});
