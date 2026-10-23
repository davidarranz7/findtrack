import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ReportAnalysisService } from '../../services/report-analysis';
import { ReportStateService } from '../../services/report-state';
import { ReportKpis } from './report-kpis';

describe('ReportKpis', () => {
  let fixture: ComponentFixture<ReportKpis>;

  const comparisonEnabled = signal(false);

  const analysisMock = {
    formattedIncome: signal('1.000,00 €'),
    formattedExpenses: signal('400,00 €'),
    formattedBalance: signal('600,00 €'),
    formattedSavingsRate: signal('60,0 %'),
    netBalance: signal(600),
    savingsRate: signal<number | null>(60),
    incomeComparison: signal({
      previousValue: 800,
      percentage: 25,
      direction: 'increase',
    }),
    expenseComparison: signal({
      previousValue: 300,
      percentage: 33.3,
      direction: 'increase',
    }),
    balanceComparison: signal({
      previousValue: 500,
      percentage: 20,
      direction: 'increase',
    }),
    savingsRateComparison: signal({
      previousValue: 62.5,
      points: 2.5,
      direction: 'decrease',
    }),
    formatMoneyComparison: () => '20.0 % vs periodo anterior',
    formatSavingsComparison: () => '2.5 puntos vs periodo anterior',
  };

  beforeEach(async () => {
    comparisonEnabled.set(false);

    await TestBed.configureTestingModule({
      imports: [ReportKpis],
      providers: [
        { provide: ReportAnalysisService, useValue: analysisMock },
        { provide: ReportStateService, useValue: { comparisonEnabled } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ReportKpis);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should display all four financial indicators', () => {
    const element: HTMLElement = fixture.nativeElement;

    expect(element.querySelectorAll('.report-kpi').length).toBe(4);
    expect(element.textContent).toContain('1.000,00 €');
    expect(element.textContent).toContain('400,00 €');
    expect(element.textContent).toContain('600,00 €');
    expect(element.textContent).toContain('60,0 %');
  });

  it('should display comparisons when enabled', () => {
    comparisonEnabled.set(true);
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;

    expect(element.querySelectorAll('.report-kpi-comparison').length).toBe(4);
  });
});
