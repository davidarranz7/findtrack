import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OverviewAnalysisService } from '../../services/overview-analysis';
import { OverviewStateService } from '../../services/overview-state';
import { OverviewBudgets } from './overview-budgets';

interface BudgetProgressItem {
  budgetId: string;
  categoryName: string;
  categoryColor: string;
  spent: number;
  limit: number;
  remaining: number;
  percentage: number;
  status: 'safe' | 'warning' | 'exceeded';
}

describe('OverviewBudgets', () => {
  let fixture: ComponentFixture<OverviewBudgets>;

  const isLoadingBudgets = signal(false);
  const budgetLoadError = signal<string | null>(null);
  const currentMonthLabel = signal('Octubre 2026');
  const budgetProgress = signal<BudgetProgressItem[]>([]);

  const formatter = new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  });

  const budget: BudgetProgressItem = {
    budgetId: 'budget-1',
    categoryName: 'Alimentación',
    categoryColor: '#16a34a',
    spent: 150,
    limit: 300,
    remaining: 150,
    percentage: 50,
    status: 'safe',
  };

  beforeEach(async () => {
    isLoadingBudgets.set(false);
    budgetLoadError.set(null);
    currentMonthLabel.set('Octubre 2026');
    budgetProgress.set([budget]);

    await TestBed.configureTestingModule({
      imports: [OverviewBudgets],
      providers: [
        {
          provide: OverviewStateService,
          useValue: {
            isLoadingBudgets,
            budgetLoadError,
            currentMonthLabel,
          },
        },
        {
          provide: OverviewAnalysisService,
          useValue: {
            budgetProgress,
            formatCurrency: (amount: number) => formatter.format(amount),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OverviewBudgets);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should display the selected month and budget category', () => {
    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain('Presupuestos del Mes');
    expect(element.textContent).toContain('Octubre 2026');
    expect(element.textContent).toContain('Alimentación');
  });

  it('should display spending, limit and remaining amount', () => {
    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain(formatter.format(150));
    expect(element.textContent).toContain(formatter.format(300));
    expect(element.textContent).toContain('Quedan');
    expect(element.textContent).toContain('50%');
  });

  it('should display a warning when approaching the limit', () => {
    budgetProgress.set([
      {
        ...budget,
        spent: 255,
        remaining: 45,
        percentage: 85,
        status: 'warning',
      },
    ]);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('.text-warning')).not.toBeNull();
    expect(element.querySelector('.progress-bar.bg-warning')).not.toBeNull();
    expect(element.textContent).toContain('85%');
  });

  it('should cap the progress bar when the budget is exceeded', () => {
    budgetProgress.set([
      {
        ...budget,
        spent: 360,
        remaining: -60,
        percentage: 120,
        status: 'exceeded',
      },
    ]);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const progress = element.querySelector('[role="progressbar"]');
    const bar = element.querySelector('.progress-bar') as HTMLElement;

    expect(element.textContent).toContain('120%');
    expect(element.textContent).toContain('Excedido en');
    expect(element.textContent).toContain(formatter.format(60));
    expect(progress?.getAttribute('aria-valuenow')).toBe('100');
    expect(bar.style.width).toBe('100%');
    expect(bar.classList.contains('bg-danger')).toBe(true);
  });

  it('should display the loading state', () => {
    isLoadingBudgets.set(true);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain('Cargando presupuestos...');
    expect(element.querySelector('.budget-list')).toBeNull();
  });

  it('should display an error when budgets cannot be loaded', () => {
    budgetLoadError.set('No se han podido cargar tus presupuestos.');
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('[role="alert"]')).not.toBeNull();
    expect(element.textContent).toContain('No se han podido cargar tus presupuestos.');
    expect(element.querySelector('.budget-list')).toBeNull();
  });

  it('should display the empty state when no budgets exist', () => {
    budgetProgress.set([]);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain('Sin presupuestos disponibles');
    expect(element.querySelector('.budget-list')).toBeNull();
  });

  it('should update when the selected month changes', () => {
    currentMonthLabel.set('Septiembre 2026');
    budgetProgress.set([]);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain('Septiembre 2026');
    expect(element.textContent).toContain('Sin presupuestos disponibles');
  });

  it('should keep the existing options button disabled', () => {
    const button = fixture.nativeElement.querySelector(
      '[aria-label="Opciones de presupuestos"]',
    ) as HTMLButtonElement;

    expect(button.disabled).toBe(true);
  });
});
