import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ReportAnalysisService } from '../../services/report-analysis';
import { ReportChartDataService } from '../../services/report-chart-data';
import { ReportSummary } from './report-summary';

describe('ReportSummary', () => {
  let fixture: ComponentFixture<ReportSummary>;

  const netBalance = signal(600);
  const filteredTransactions = signal([{}, {}, {}]);
  const highestExpenseMonth = signal<{ label: string; expense: number } | null>({
    label: 'Mar',
    expense: 250,
  });

  const topExpenseCategory = signal<{ categoryName: string } | null>({
    categoryName: 'Alimentación',
  });

  beforeEach(async () => {
    netBalance.set(600);
    filteredTransactions.set([{}, {}, {}]);
    highestExpenseMonth.set({ label: 'Mar', expense: 250 });
    topExpenseCategory.set({ categoryName: 'Alimentación' });

    await TestBed.configureTestingModule({
      imports: [ReportSummary],
      providers: [
        {
          provide: ReportAnalysisService,
          useValue: {
            filteredTransactions,
            formattedAverageMonthlyExpenses: signal('200,00 €'),
            netBalance,
            formatCurrency: (amount: number) =>
              new Intl.NumberFormat('es-ES', {
                style: 'currency',
                currency: 'EUR',
              }).format(amount),
          },
        },
        {
          provide: ReportChartDataService,
          useValue: {
            topExpenseCategory,
            highestExpenseMonth,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ReportSummary);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should display the financial summary', () => {
    const element: HTMLElement = fixture.nativeElement;

    expect(element.querySelectorAll('.report-summary-item').length).toBe(5);
    expect(element.textContent).toContain('Movimientos analizados');
    expect(element.textContent).toContain('3');
    expect(element.textContent).toContain('200,00 €');
    expect(element.textContent).toContain('Alimentación');
    expect(element.textContent).toContain('Mar');
    expect(element.textContent).toContain('Positivo');
  });

  it('should display a negative result', () => {
    netBalance.set(-100);
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;
    const result = element.querySelector('.balance-negative');

    expect(result).not.toBeNull();
    expect(result?.textContent).toContain('Negativo');
  });

  it('should display no data when there is no highest expense month', () => {
    highestExpenseMonth.set(null);
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;

    expect(element.textContent).toContain('Sin datos');
  });
});
