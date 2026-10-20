import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';

import { TransactionsFiltersService } from '../services/transactions-filters';
import { TransactionsStateService } from '../services/transactions-state';
import { TransactionsSummaryService } from '../services/transactions-summary';
import { TransactionsSummary } from './transactions-summary';

describe('TransactionsSummary', () => {
  let fixture: ComponentFixture<TransactionsSummary>;

  const isLoading = signal(false);
  const currentMonthLabel = signal('Octubre 2026');

  const formattedMonthlyIncome = signal('1.500,00 €');
  const formattedMonthlyExpenses = signal('-350,00 €');
  const formattedOperatingBalance = signal('1.150,00 €');
  const operatingBalance = signal(1150);

  beforeEach(async () => {
    isLoading.set(false);
    currentMonthLabel.set('Octubre 2026');
    formattedMonthlyIncome.set('1.500,00 €');
    formattedMonthlyExpenses.set('-350,00 €');
    formattedOperatingBalance.set('1.150,00 €');
    operatingBalance.set(1150);

    await TestBed.configureTestingModule({
      imports: [TransactionsSummary],
      providers: [
        {
          provide: TransactionsStateService,
          useValue: {
            isLoading,
          },
        },
        {
          provide: TransactionsFiltersService,
          useValue: {
            currentMonthLabel,
          },
        },
        {
          provide: TransactionsSummaryService,
          useValue: {
            formattedMonthlyIncome,
            formattedMonthlyExpenses,
            formattedOperatingBalance,
            operatingBalance,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TransactionsSummary);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render three summary cards', () => {
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelectorAll('.transaction-summary-card').length).toBe(3);

    expect(element.textContent).toContain('Ingresos del mes');
    expect(element.textContent).toContain('Gastos del mes');
    expect(element.textContent).toContain('Balance operativo');
  });

  it('should display monthly amounts and period', () => {
    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain('1.500,00 €');
    expect(element.textContent).toContain('-350,00 €');
    expect(element.textContent).toContain('1.150,00 €');
    expect(element.textContent).toContain('Octubre 2026');
  });

  it('should show loading indicators while loading', () => {
    isLoading.set(true);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelectorAll('.transaction-summary-card .spinner-border').length).toBe(3);

    expect(element.querySelectorAll('.transaction-summary-value').length).toBe(0);
  });

  it('should show a positive balance in green', () => {
    const element = fixture.nativeElement as HTMLElement;

    const values = element.querySelectorAll('.transaction-summary-value');

    expect(values[2].classList.contains('text-success')).toBe(true);
    expect(values[2].classList.contains('text-danger')).toBe(false);
  });

  it('should show a negative balance in red', () => {
    operatingBalance.set(-100);
    formattedOperatingBalance.set('-100,00 €');

    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;

    const values = element.querySelectorAll('.transaction-summary-value');

    expect(values[2].classList.contains('text-danger')).toBe(true);
    expect(values[2].textContent).toContain('-100,00 €');
  });
});
