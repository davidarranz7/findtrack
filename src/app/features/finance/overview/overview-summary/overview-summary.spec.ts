import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OverviewAnalysisService } from '../services/overview-analysis';
import { OverviewStateService } from '../services/overview-state';
import { OverviewSummary } from './overview-summary';

describe('OverviewSummary', () => {
  let fixture: ComponentFixture<OverviewSummary>;

  const isLoading = signal(false);
  const currentMonthLabel = signal('Octubre 2026');

  const balance = signal(2500);
  const income = signal(2000);
  const expenses = signal(500);

  const formatter = new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  });

  const formattedBalance = computed(() => formatter.format(balance()));
  const formattedIncome = computed(() => formatter.format(income()));
  const formattedExpenses = computed(() => formatter.format(expenses()));
  const formattedSavings = computed(() => formatter.format(income() - expenses()));

  beforeEach(async () => {
    isLoading.set(false);
    currentMonthLabel.set('Octubre 2026');
    balance.set(2500);
    income.set(2000);
    expenses.set(500);

    await TestBed.configureTestingModule({
      imports: [OverviewSummary],
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
            formattedBalance,
            formattedIncome,
            formattedExpenses,
            formattedSavings,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OverviewSummary);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should display four financial summary cards', () => {
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelectorAll('.summary-card').length).toBe(4);
    expect(element.textContent).toContain('Balance disponible');
    expect(element.textContent).toContain('Ingresos totales');
    expect(element.textContent).toContain('Gastos totales');
    expect(element.textContent).toContain('Ahorro del mes');
  });

  it('should display formatted financial values', () => {
    const values = fixture.nativeElement.querySelectorAll(
      '.summary-value',
    ) as NodeListOf<HTMLElement>;

    expect(values.length).toBe(4);
    expect(values[0].textContent?.trim()).toBe(formatter.format(2500));
    expect(values[1].textContent?.trim()).toBe(formatter.format(2000));
    expect(values[2].textContent?.trim()).toBe(formatter.format(500));
    expect(values[3].textContent?.trim()).toBe(formatter.format(1500));
  });

  it('should update the displayed values when data changes', () => {
    balance.set(3200);
    income.set(1500);
    expenses.set(300);

    fixture.detectChanges();

    const values = fixture.nativeElement.querySelectorAll(
      '.summary-value',
    ) as NodeListOf<HTMLElement>;

    expect(values[0].textContent?.trim()).toBe(formatter.format(3200));
    expect(values[1].textContent?.trim()).toBe(formatter.format(1500));
    expect(values[2].textContent?.trim()).toBe(formatter.format(300));
    expect(values[3].textContent?.trim()).toBe(formatter.format(1200));
  });

  it('should show negative savings correctly', () => {
    income.set(300);
    expenses.set(500);

    fixture.detectChanges();

    const values = fixture.nativeElement.querySelectorAll(
      '.summary-value',
    ) as NodeListOf<HTMLElement>;

    expect(values[3].textContent?.trim()).toBe(formatter.format(-200));
  });

  it('should display the selected month in descriptions', () => {
    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain('Ingresos de Octubre 2026');
    expect(element.textContent).toContain('Gastos de Octubre 2026');

    currentMonthLabel.set('Septiembre 2026');
    fixture.detectChanges();

    expect(element.textContent).toContain('Ingresos de Septiembre 2026');
    expect(element.textContent).toContain('Gastos de Septiembre 2026');
  });

  it('should show loading indicators instead of values', () => {
    isLoading.set(true);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelectorAll('.spinner-border').length).toBe(4);
    expect(element.querySelectorAll('.summary-value').length).toBe(0);
  });

  it('should display zero values when there are no movements', () => {
    balance.set(0);
    income.set(0);
    expenses.set(0);
    fixture.detectChanges();

    const values = fixture.nativeElement.querySelectorAll(
      '.summary-value',
    ) as NodeListOf<HTMLElement>;

    for (const value of values) {
      expect(value.textContent?.trim()).toBe(formatter.format(0));
    }
  });
});
