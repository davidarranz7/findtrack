import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Transaction } from '../../../models';
import { OverviewAnalysisService } from '../../services/overview-analysis';
import { OverviewStateService } from '../../services/overview-state';
import { OverviewRecentTransactions } from './overview-recent-transactions';

describe('OverviewRecentTransactions', () => {
  let fixture: ComponentFixture<OverviewRecentTransactions>;

  const isLoading = signal(false);
  const latestTransactions = signal<Transaction[]>([]);

  const income = {
    id: 'income-1',
    userId: 'user-1',
    type: 'income',
    amount: 1500,
    description: 'Nómina',
    date: '2026-10-20',
    categoryId: null,
  } as Transaction;

  const expense = {
    id: 'expense-1',
    userId: 'user-1',
    type: 'expense',
    amount: 75,
    description: 'Supermercado',
    date: '2026-10-19',
    categoryId: 'food',
  } as Transaction;

  const deletedCategoryExpense = {
    ...expense,
    id: 'expense-2',
    description: 'Billete de tren',
    categoryId: null,
    categoryNameSnapshot: 'Viajes',
  } as Transaction;

  beforeEach(async () => {
    isLoading.set(false);
    latestTransactions.set([income, expense]);

    await TestBed.configureTestingModule({
      imports: [OverviewRecentTransactions],
      providers: [
        provideRouter([]),
        {
          provide: OverviewStateService,
          useValue: { isLoading },
        },
        {
          provide: OverviewAnalysisService,
          useValue: {
            latestTransactions,
            formatTransactionDate: (date: string) => date,
            formatTransactionAmount: (transaction: Transaction) =>
              `${transaction.type === 'income' ? '+' : '-'}${transaction.amount} €`,
            getCategoryName: (categoryId: string | null, snapshot?: string | null) => {
              if (categoryId === 'food') {
                return 'Alimentación';
              }

              return snapshot ? `${snapshot} (eliminada)` : 'Sin categoría';
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(OverviewRecentTransactions);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should display the section heading and navigation link', () => {
    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain('Últimas Transacciones');

    const link = element.querySelector('.view-all-button') as HTMLAnchorElement;

    expect(link.textContent).toContain('Ver todas');
    expect(link.getAttribute('href')).toBe('/transactions');
  });

  it('should display the recent transactions', () => {
    const element = fixture.nativeElement as HTMLElement;
    const items = element.querySelectorAll('.recent-transaction');

    expect(items.length).toBe(2);
    expect(items[0].textContent).toContain('Nómina');
    expect(items[1].textContent).toContain('Supermercado');
    expect(items[1].textContent).toContain('Alimentación');
  });

  it('should distinguish income and expenses', () => {
    const element = fixture.nativeElement as HTMLElement;

    const incomeAmount = element.querySelector('.transaction-amount-income');

    const expenseAmount = element.querySelector('.transaction-amount-expense');

    expect(incomeAmount?.textContent).toContain('+1500 €');
    expect(expenseAmount?.textContent).toContain('-75 €');
    expect(element.querySelector('.transaction-icon-income')).not.toBeNull();
    expect(element.querySelector('.transaction-icon-expense')).not.toBeNull();
  });

  it('should preserve names of deleted categories', () => {
    latestTransactions.set([deletedCategoryExpense]);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain('Billete de tren');
    expect(element.textContent).toContain('Viajes (eliminada)');
  });

  it('should display the empty state', () => {
    latestTransactions.set([]);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain('Sin transacciones disponibles');
    expect(element.querySelector('.recent-transactions')).toBeNull();
  });

  it('should show loading indicators instead of transactions', () => {
    isLoading.set(true);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain('Cargando movimientos...');
    expect(element.querySelector('.recent-transaction')).toBeNull();
  });

  it('should react when recent transactions change', () => {
    latestTransactions.set([deletedCategoryExpense, income, expense]);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const items = element.querySelectorAll('.recent-transaction');

    expect(items.length).toBe(3);
    expect(items[0].textContent).toContain('Billete de tren');
    expect(items[2].textContent).toContain('Supermercado');
  });
});
