import { Component, input, output, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { Transaction } from '../models';
import { OverviewAnalysisService } from './services/overview-analysis';
import { OverviewStateService } from './services/overview-state';
import { Overview } from './overview';

@Component({
  selector: 'app-page-header',
  template:
    '<h1>{{ title() }}</h1><p>{{ description() }}</p><ng-content select="[pageHeaderActions]"></ng-content>',
})
class PageHeaderStub {
  readonly eyebrow = input('');
  readonly title = input('');
  readonly description = input('');
}

@Component({ selector: 'app-overview-summary', template: '' })
class OverviewSummaryStub {}

@Component({ selector: 'app-overview-charts', template: '' })
class OverviewChartsStub {}

@Component({ selector: 'app-overview-budgets', template: '' })
class OverviewBudgetsStub {}

@Component({ selector: 'app-overview-recent-transactions', template: '' })
class OverviewRecentTransactionsStub {}

@Component({ selector: 'app-transaction-form', template: '' })
class TransactionFormStub {
  readonly closed = output<void>();
  readonly created = output<Transaction>();
}

describe('Overview', () => {
  let fixture: ComponentFixture<Overview>;
  let addedTransactions: Transaction[];

  const userName = signal('David');
  const currentMonthLabel = signal('Octubre 2026');
  const canGoToNextMonth = signal(false);
  const isLoadingBudgets = signal(false);
  const loadError = signal<string | null>(null);
  const budgetProgress = signal<{ budgetId: string }[]>([]);

  const budgetAlert = signal<{
    status: 'safe' | 'warning' | 'exceeded';
    budget?: {
      categoryName: string;
      spent: number;
      limit: number;
      percentage: number;
      remaining: number;
    };
  } | null>(null);

  const formatter = new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  });

  const stateMock = {
    userName,
    currentMonthLabel,
    canGoToNextMonth,
    isLoadingBudgets,
    loadError,
    previousMonth: () => {
      currentMonthLabel.set('Septiembre 2026');
      canGoToNextMonth.set(true);
    },
    nextMonth: () => {
      currentMonthLabel.set('Octubre 2026');
      canGoToNextMonth.set(false);
    },
    addTransaction: (transaction: Transaction) => {
      addedTransactions.push(transaction);
    },
  };

  const analysisMock = {
    budgetProgress,
    budgetAlert,
    formatCurrency: (amount: number) => formatter.format(amount),
  };

  const getButton = (selector: string): HTMLButtonElement =>
    fixture.nativeElement.querySelector(selector) as HTMLButtonElement;

  const getTransactionForm = (): TransactionFormStub =>
    fixture.debugElement.query(By.directive(TransactionFormStub))
      .componentInstance as TransactionFormStub;

  beforeEach(async () => {
    addedTransactions = [];
    userName.set('David');
    currentMonthLabel.set('Octubre 2026');
    canGoToNextMonth.set(false);
    isLoadingBudgets.set(false);
    loadError.set(null);
    budgetProgress.set([]);
    budgetAlert.set(null);

    await TestBed.configureTestingModule({
      imports: [Overview],
    })
      .overrideComponent(Overview, {
        set: {
          imports: [
            PageHeaderStub,
            OverviewSummaryStub,
            OverviewChartsStub,
            OverviewBudgetsStub,
            OverviewRecentTransactionsStub,
            TransactionFormStub,
          ],
          providers: [
            { provide: OverviewStateService, useValue: stateMock },
            { provide: OverviewAnalysisService, useValue: analysisMock },
          ],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(Overview);
    fixture.detectChanges();
  });

  it('should create and display the welcome message', () => {
    expect(fixture.componentInstance).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Buenos días, David');
    expect(fixture.nativeElement.textContent).toContain('Octubre 2026');
  });

  it('should render all four dashboard sections', () => {
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('app-overview-summary')).not.toBeNull();
    expect(element.querySelector('app-overview-charts')).not.toBeNull();
    expect(element.querySelector('app-overview-budgets')).not.toBeNull();
    expect(element.querySelector('app-overview-recent-transactions')).not.toBeNull();
  });

  it('should prevent navigation to a future month', () => {
    expect(getButton('[aria-label="Mes siguiente"]').disabled).toBe(true);
    expect(currentMonthLabel()).toBe('Octubre 2026');
  });

  it('should navigate between months', () => {
    getButton('[aria-label="Mes anterior"]').click();
    fixture.detectChanges();

    expect(currentMonthLabel()).toBe('Septiembre 2026');
    expect(getButton('[aria-label="Mes siguiente"]').disabled).toBe(false);

    getButton('[aria-label="Mes siguiente"]').click();
    fixture.detectChanges();

    expect(currentMonthLabel()).toBe('Octubre 2026');
    expect(getButton('[aria-label="Mes siguiente"]').disabled).toBe(true);
  });

  it('should show loading errors', () => {
    loadError.set('No se han podido cargar tus movimientos.');
    fixture.detectChanges();

    const alert = fixture.nativeElement.querySelector('.alert-danger') as HTMLElement;

    expect(alert.textContent).toContain('No se han podido cargar tus movimientos.');
  });

  it('should display the safe budget alert', () => {
    budgetProgress.set([{ budgetId: 'budget-1' }]);
    budgetAlert.set({ status: 'safe' });
    fixture.detectChanges();

    const alert = fixture.nativeElement.querySelector('.budget-alert-safe') as HTMLElement;

    expect(alert.textContent).toContain('Tus presupuestos están bajo control');
  });

  it('should display a warning when approaching a budget limit', () => {
    budgetProgress.set([{ budgetId: 'budget-1' }]);
    budgetAlert.set({
      status: 'warning',
      budget: {
        categoryName: 'Alimentación',
        spent: 255,
        limit: 300,
        percentage: 85,
        remaining: 45,
      },
    });
    fixture.detectChanges();

    const alert = fixture.nativeElement.querySelector('.budget-alert-warning') as HTMLElement;

    expect(alert.textContent).toContain('Alimentación cerca del límite');
    expect(alert.textContent).toContain('85 %');
  });

  it('should display the exceeded budget amount', () => {
    budgetProgress.set([{ budgetId: 'budget-1' }]);
    budgetAlert.set({
      status: 'exceeded',
      budget: {
        categoryName: 'Alimentación',
        spent: 360,
        limit: 300,
        percentage: 120,
        remaining: -60,
      },
    });
    fixture.detectChanges();

    const alert = fixture.nativeElement.querySelector('.budget-alert-exceeded') as HTMLElement;

    expect(alert.textContent).toContain('presupuesto superado');
    expect(alert.textContent).toContain(formatter.format(60));
  });

  it('should hide budget alerts while budgets are loading', () => {
    budgetProgress.set([{ budgetId: 'budget-1' }]);
    budgetAlert.set({ status: 'safe' });
    isLoadingBudgets.set(true);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.budget-alert')).toBeNull();
  });

  it('should open and close the transaction form', () => {
    getButton('.new-transaction-button').click();
    fixture.detectChanges();

    expect(getTransactionForm()).toBeTruthy();

    getTransactionForm().closed.emit();
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.directive(TransactionFormStub))).toBeNull();
  });

  it('should update the state after creating a transaction', () => {
    const transaction = {
      id: 'transaction-1',
      userId: 'user-1',
      type: 'expense',
      amount: 50,
      description: 'Supermercado',
      date: '2026-10-20',
      categoryId: null,
    } as Transaction;

    getButton('.new-transaction-button').click();
    fixture.detectChanges();

    getTransactionForm().created.emit(transaction);
    fixture.detectChanges();

    expect(addedTransactions).toEqual([transaction]);
    expect(fixture.debugElement.query(By.directive(TransactionFormStub))).toBeNull();
  });
});
