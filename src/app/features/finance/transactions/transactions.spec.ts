import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { ConfirmDialog } from '../../../shared/ui/confirm-dialog/confirm-dialog';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { AuthService } from '../../auth/services/auth.service';
import { Category, Transaction } from '../models';
import { CategoryService } from '../services/category.service';
import { TransactionService } from '../services/transaction.service';
import { TransactionsFiltersService } from './services/transactions-filters';
import { TransactionsStateService } from './services/transactions-state';
import { TransactionForm } from './transaction-form/transaction-form';
import { Transactions } from './transactions';

describe('Transactions', () => {
  let fixture: ComponentFixture<Transactions>;
  let state: TransactionsStateService;
  let filters: TransactionsFiltersService;

  let deletedIds: string[];
  let successMessages: string[];
  let deleteShouldFail: boolean;

  const category = {
    id: 'category-1',
    name: 'Alimentación',
  } as Category;

  const income = {
    id: 'income-1',
    userId: 'user-1',
    type: 'income',
    amount: 1500,
    description: 'Nómina',
    categoryId: null,
    categoryNameSnapshot: 'Trabajo',
    date: '2026-10-18',
    paymentMethod: 'bankTransfer',
    notes: '',
  } as Transaction;

  const expense = {
    ...income,
    id: 'expense-1',
    type: 'expense',
    amount: 25,
    description: 'Supermercado',
    categoryId: 'category-1',
    categoryNameSnapshot: 'Alimentación',
    date: '2026-10-15',
    paymentMethod: 'card',
    notes: 'Compra semanal',
  } as Transaction;

  const septemberExpense = {
    ...expense,
    id: 'expense-2',
    date: '2026-09-10',
  } as Transaction;

  function clickButton(selector: string): void {
    const button = fixture.nativeElement.querySelector(selector) as HTMLButtonElement;

    expect(button).not.toBeNull();
    button.click();
    fixture.detectChanges();
  }

  function getForm(): TransactionForm {
    return fixture.debugElement.query(By.directive(TransactionForm))
      .componentInstance as TransactionForm;
  }

  function getDialog(): ConfirmDialog {
    return fixture.debugElement.query(By.directive(ConfirmDialog))
      .componentInstance as ConfirmDialog;
  }

  beforeEach(async () => {
    deletedIds = [];
    successMessages = [];
    deleteShouldFail = false;

    await TestBed.configureTestingModule({
      imports: [Transactions],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            currentUser: () => ({
              id: 'user-1',
              username: 'usuario',
              email: 'usuario@example.com',
            }),
          },
        },
        {
          provide: TransactionService,
          useValue: {
            getTransactions: () => of([income, expense, septemberExpense]),
            createTransaction: () => of(expense),
            updateTransaction: () => of(income),
            deleteTransaction: (id: string) => {
              deletedIds.push(id);

              return deleteShouldFail
                ? throwError(() => new Error('DELETE_FAILED'))
                : of(undefined);
            },
          },
        },
        {
          provide: CategoryService,
          useValue: {
            getCategories: () => of([category]),
          },
        },
        {
          provide: ToastService,
          useValue: {
            success: (message: string) => successMessages.push(message),
            error: () => undefined,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Transactions);
    state = fixture.debugElement.injector.get(TransactionsStateService);
    filters = fixture.debugElement.injector.get(TransactionsFiltersService);

    filters.selectMonth('2026-10');
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should display the summary, filters and transaction table', () => {
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('app-transactions-summary')).not.toBeNull();
    expect(element.querySelector('app-transactions-filters')).not.toBeNull();
    expect(element.querySelector('app-transactions-table')).not.toBeNull();

    expect(element.querySelectorAll('tbody tr').length).toBe(2);
    expect(element.textContent).toContain('Nómina');
    expect(element.textContent).toContain('Supermercado');

    const exportButton = element.querySelector('.export-button') as HTMLButtonElement;

    expect(exportButton.disabled).toBe(true);
    expect(state.totalTransactions()).toBe(3);
  });

  it('should filter transactions without modifying monthly totals', () => {
    const searchInput = fixture.nativeElement.querySelector(
      '.transaction-search-input',
    ) as HTMLInputElement;

    searchInput.value = 'supermercado';
    searchInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(filters.filteredTransactions().length).toBe(1);
    expect(fixture.nativeElement.querySelectorAll('tbody tr').length).toBe(1);

    expect(fixture.nativeElement.querySelector('tbody')?.textContent).toContain('Supermercado');

    expect(fixture.nativeElement.querySelector('tbody')?.textContent).not.toContain('Nómina');

    expect(state.totalTransactions()).toBe(3);
  });

  it('should open the form and register a created transaction', () => {
    clickButton('.new-transaction-button');

    expect(fixture.nativeElement.querySelector('.transaction-modal-backdrop')).not.toBeNull();

    const createdTransaction = {
      ...expense,
      id: 'expense-created',
      description: 'Nueva compra',
    } as Transaction;

    getForm().created.emit(createdTransaction);
    fixture.detectChanges();

    expect(state.totalTransactions()).toBe(4);
    expect(state.transactions()[0]).toEqual(createdTransaction);
    expect(filters.currentPage()).toBe(1);

    expect(fixture.nativeElement.querySelector('.transaction-modal-backdrop')).toBeNull();
  });

  it('should open the edit form and update the transaction', () => {
    clickButton('tbody tr:first-child button[aria-label="Editar transacción"]');

    expect(getForm().transaction()?.id).toBe('income-1');

    const updatedIncome = {
      ...income,
      amount: 1700,
    } as Transaction;

    getForm().updated.emit(updatedIncome);
    fixture.detectChanges();

    expect(state.transactions().find((transaction) => transaction.id === 'income-1')?.amount).toBe(
      1700,
    );

    expect(fixture.nativeElement.querySelector('.transaction-modal-backdrop')).toBeNull();
  });

  it('should cancel a deletion without removing the transaction', () => {
    clickButton('tbody tr:nth-child(2) button[aria-label="Eliminar transacción"]');

    expect(getDialog()).toBeTruthy();

    getDialog().cancelled.emit();
    fixture.detectChanges();

    expect(state.totalTransactions()).toBe(3);
    expect(deletedIds).toEqual([]);
    expect(fixture.debugElement.query(By.directive(ConfirmDialog))).toBeNull();
  });

  it('should delete a transaction after confirmation', () => {
    clickButton('tbody tr:nth-child(2) button[aria-label="Eliminar transacción"]');

    getDialog().confirmed.emit();
    fixture.detectChanges();

    expect(deletedIds).toEqual(['expense-1']);
    expect(state.totalTransactions()).toBe(2);

    expect(state.transactions().some((transaction) => transaction.id === 'expense-1')).toBe(false);

    expect(successMessages).toContain('Transacción eliminada correctamente.');

    expect(fixture.debugElement.query(By.directive(ConfirmDialog))).toBeNull();
  });

  it('should preserve the transaction when deletion fails', () => {
    deleteShouldFail = true;

    clickButton('tbody tr:nth-child(2) button[aria-label="Eliminar transacción"]');

    getDialog().confirmed.emit();
    fixture.detectChanges();

    expect(deletedIds).toEqual(['expense-1']);
    expect(state.totalTransactions()).toBe(3);
    expect(successMessages).toEqual([]);

    expect(fixture.nativeElement.textContent).toContain('No se ha podido eliminar la transacción.');

    expect(getDialog()).toBeTruthy();
  });

  it('should adjust pagination after deleting the last page item', () => {
    state.transactions.set(
      Array.from({ length: 11 }, (_, index) => ({
        ...expense,
        id: `expense-${index + 1}`,
      })),
    );

    filters.changePageSize('5');
    filters.goToPage(3);
    fixture.detectChanges();

    expect(filters.totalPages()).toBe(3);
    expect(filters.currentPage()).toBe(3);

    clickButton('tbody tr:first-child button[aria-label="Eliminar transacción"]');

    getDialog().confirmed.emit();
    fixture.detectChanges();

    expect(state.totalTransactions()).toBe(10);
    expect(filters.totalPages()).toBe(2);
    expect(filters.currentPage()).toBe(2);
  });

  it('should show the loading error without rendering transaction rows', () => {
    state.loadError.set('No se han podido cargar tus transacciones.');
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'No se han podido cargar tus transacciones.',
    );

    expect(element.querySelectorAll('tbody tr').length).toBe(0);
  });
});
