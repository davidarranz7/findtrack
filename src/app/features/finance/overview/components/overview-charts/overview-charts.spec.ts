import { Component, computed, input, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { type ExpenseDistributionItem } from '../../../charts/expense-distribution-chart/expense-distribution-chart';
import { type IncomeExpenseChartItem } from '../../../charts/income-expense-chart/income-expense-chart';
import { OverviewAnalysisService } from '../../services/overview-analysis';
import { OverviewStateService } from '../../services/overview-state';
import { OverviewCharts } from './overview-charts';

@Component({
  selector: 'app-income-expense-chart',
  template: '',
})
class IncomeExpenseChartStub {
  readonly items = input<IncomeExpenseChartItem[]>([]);
}

@Component({
  selector: 'app-expense-distribution-chart',
  template: '',
})
class ExpenseDistributionChartStub {
  readonly items = input<ExpenseDistributionItem[]>([]);
  readonly total = input(0);
}

describe('OverviewCharts', () => {
  let fixture: ComponentFixture<OverviewCharts>;

  const isLoading = signal(false);
  const currentMonthLabel = signal('Octubre 2026');
  const incomeExpenseHistory = signal<IncomeExpenseChartItem[]>([]);
  const expenseDistribution = signal<ExpenseDistributionItem[]>([]);
  const monthlyExpenses = signal(0);

  const hasIncomeExpenseData = computed(() =>
    incomeExpenseHistory().some((item) => item.income > 0 || item.expense > 0),
  );

  const historyItem: IncomeExpenseChartItem = {
    label: 'Oct',
    income: 1600,
    expense: 400,
  };

  const distributionItem: ExpenseDistributionItem = {
    categoryId: 'food',
    categoryName: 'Alimentación',
    amount: 400,
    percentage: 100,
    color: '#16a34a',
  };

  beforeEach(async () => {
    isLoading.set(false);
    currentMonthLabel.set('Octubre 2026');
    incomeExpenseHistory.set([]);
    expenseDistribution.set([]);
    monthlyExpenses.set(0);

    await TestBed.configureTestingModule({
      imports: [OverviewCharts],
      providers: [
        {
          provide: OverviewStateService,
          useValue: {
            isLoading,
            currentMonthLabel,
          },
        },
        {
          provide: OverviewAnalysisService,
          useValue: {
            incomeExpenseHistory,
            expenseDistribution,
            monthlyExpenses,
            hasIncomeExpenseData,
          },
        },
      ],
    })
      .overrideComponent(OverviewCharts, {
        set: {
          imports: [IncomeExpenseChartStub, ExpenseDistributionChartStub],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(OverviewCharts);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should preserve titles and selected month', () => {
    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain('Ingresos vs Gastos');
    expect(element.textContent).toContain('Distribución de Gastos');
    expect(element.textContent).toContain('Octubre 2026');

    currentMonthLabel.set('Septiembre 2026');
    fixture.detectChanges();

    expect(element.textContent).toContain('Septiembre 2026');
  });

  it('should display both loading indicators', () => {
    isLoading.set(true);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelectorAll('.spinner-border').length).toBe(2);
    expect(element.textContent).toContain('Cargando histórico...');
    expect(element.textContent).toContain('Cargando distribución...');
  });

  it('should display empty states when there is no data', () => {
    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain('Todavía no hay datos para mostrar');
    expect(element.textContent).toContain('Sin distribución disponible');
  });

  it('should pass monthly history to the income expense chart', () => {
    incomeExpenseHistory.set([historyItem]);
    fixture.detectChanges();

    const chart = fixture.debugElement.query(By.directive(IncomeExpenseChartStub));

    expect(chart).not.toBeNull();

    const component = chart.componentInstance as IncomeExpenseChartStub;

    expect(component.items()).toEqual([historyItem]);
  });

  it('should pass expenses and total to the distribution chart', () => {
    expenseDistribution.set([distributionItem]);
    monthlyExpenses.set(400);
    fixture.detectChanges();

    const chart = fixture.debugElement.query(By.directive(ExpenseDistributionChartStub));

    expect(chart).not.toBeNull();

    const component = chart.componentInstance as ExpenseDistributionChartStub;

    expect(component.items()).toEqual([distributionItem]);
    expect(component.total()).toBe(400);
  });

  it('should handle charts with data independently', () => {
    incomeExpenseHistory.set([historyItem]);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;

    expect(fixture.debugElement.query(By.directive(IncomeExpenseChartStub))).not.toBeNull();

    expect(fixture.debugElement.query(By.directive(ExpenseDistributionChartStub))).toBeNull();

    expect(element.textContent).toContain('Sin distribución disponible');
  });

  it('should update both charts when data changes', () => {
    incomeExpenseHistory.set([historyItem]);
    expenseDistribution.set([distributionItem]);
    monthlyExpenses.set(400);
    fixture.detectChanges();

    incomeExpenseHistory.set([{ label: 'Nov', income: 2000, expense: 600 }]);
    monthlyExpenses.set(600);
    fixture.detectChanges();

    const incomeChart = fixture.debugElement.query(By.directive(IncomeExpenseChartStub))
      .componentInstance as IncomeExpenseChartStub;

    const distributionChart = fixture.debugElement.query(By.directive(ExpenseDistributionChartStub))
      .componentInstance as ExpenseDistributionChartStub;

    expect(incomeChart.items()[0].income).toBe(2000);
    expect(distributionChart.total()).toBe(600);
  });
});
