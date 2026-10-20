import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of, throwError } from 'rxjs';

import { ConfirmDialog } from '../../../shared/ui/confirm-dialog/confirm-dialog';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { AuthService } from '../../auth/services/auth.service';
import { Budget, Category, Transaction } from '../models';
import { BudgetService } from '../services/budget.service';
import { CategoryService } from '../services/category.service';
import { TransactionService } from '../services/transaction.service';
import { CategoriesStateService } from './services/categories-state';
import { CategoryForm } from './category-form/category-form';
import { Categories } from './categories';

describe('Categories', () => {
  let fixture: ComponentFixture<Categories>;
  let state: CategoriesStateService;
  let storedCategories: Category[];
  let storedTransactions: Transaction[];
  let notifications: string[];
  let failCreate: boolean;
  let failTransactionUpdate: boolean;
  let failDelete: boolean;
  let categoryReloads: number;

  const currentUser = signal<{ id: string } | null>({ id: 'user-1' });

  const foodCategory: Category = {
    id: 'food',
    userId: 'user-1',
    name: 'Alimentación',
    icon: 'bi-basket',
    color: '#16a34a',
  };

  const transportCategory: Category = {
    id: 'transport',
    userId: 'user-1',
    name: 'Transporte',
    icon: 'bi-bus-front',
    color: '#2563eb',
  };

  const foodTransaction = {
    id: 'transaction-1',
    userId: 'user-1',
    categoryId: 'food',
    categoryNameSnapshot: 'Alimentación',
    type: 'expense',
    amount: 50,
    date: '2026-10-15',
  } as Transaction;

  const uncategorizedTransaction = {
    ...foodTransaction,
    id: 'transaction-2',
    categoryId: null,
  } as Transaction;

  const getButton = (selector: string): HTMLButtonElement =>
    fixture.nativeElement.querySelector(selector) as HTMLButtonElement;

  const getForm = (): CategoryForm =>
    fixture.debugElement.query(By.directive(CategoryForm)).componentInstance as CategoryForm;

  const getDialog = (): ConfirmDialog =>
    fixture.debugElement.query(By.directive(ConfirmDialog)).componentInstance as ConfirmDialog;

  beforeEach(async () => {
    currentUser.set({ id: 'user-1' });
    storedCategories = [{ ...foodCategory }, { ...transportCategory }];
    storedTransactions = [{ ...foodTransaction }, { ...uncategorizedTransaction }];
    notifications = [];
    failCreate = false;
    failTransactionUpdate = false;
    failDelete = false;
    categoryReloads = 0;

    await TestBed.configureTestingModule({
      imports: [Categories],
      providers: [
        {
          provide: AuthService,
          useValue: { currentUser },
        },
        {
          provide: ToastService,
          useValue: {
            success: (message: string) => notifications.push(message),
            warning: (message: string) => notifications.push(message),
            info: (message: string) => notifications.push(message),
          },
        },
        {
          provide: CategoryService,
          useValue: {
            getCategories: () => {
              categoryReloads++;
              return of([...storedCategories]);
            },
            createCategory: (values: Omit<Category, 'id'>) => {
              if (failCreate) {
                return throwError(() => new Error('CREATE_FAILED'));
              }

              const created = { ...values, id: 'new-category' };
              storedCategories.push(created);
              return of(created);
            },
            updateCategory: (
              categoryId: string,
              values: Pick<Category, 'name' | 'icon' | 'color'>,
            ) => {
              const original = storedCategories.find((category) => category.id === categoryId)!;
              const updated = { ...original, ...values };

              storedCategories = storedCategories.map((category) =>
                category.id === categoryId ? updated : category,
              );

              return of(updated);
            },
            deleteCategory: (categoryId: string) => {
              if (failDelete) {
                return throwError(() => new Error('DELETE_FAILED'));
              }

              storedCategories = storedCategories.filter((category) => category.id !== categoryId);
              return of(void 0);
            },
          },
        },
        {
          provide: TransactionService,
          useValue: {
            getTransactions: () => of([...storedTransactions]),
            updateTransaction: (
              transactionId: string,
              changes: Pick<Transaction, 'categoryId' | 'categoryNameSnapshot'>,
            ) => {
              if (failTransactionUpdate) {
                return throwError(() => new Error('UPDATE_FAILED'));
              }

              const original = storedTransactions.find(
                (transaction) => transaction.id === transactionId,
              )!;
              const updated = { ...original, ...changes };

              storedTransactions = storedTransactions.map((transaction) =>
                transaction.id === transactionId ? updated : transaction,
              );

              return of(updated);
            },
          },
        },
        {
          provide: BudgetService,
          useValue: {
            getBudgetsByUser: () => of([] as Budget[]),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Categories);
    state = fixture.debugElement.injector.get(CategoriesStateService);
    fixture.detectChanges();
  });

  it('should load categories and display the summary', () => {
    expect(fixture.componentInstance).toBeTruthy();
    expect(state.categories().length).toBe(2);
    expect(state.categorizedTransactions()).toBe(1);
    expect(state.uncategorizedTransactions()).toBe(1);

    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelectorAll('.summary-card').length).toBe(3);
    expect(element.querySelectorAll('.category-card').length).toBe(2);
  });

  it('should create a category and update the list', () => {
    getButton('.categories-page-header-actions button').click();
    fixture.detectChanges();

    getForm().submitted.emit({
      name: '  Salud  ',
      icon: 'bi-heart-pulse',
      color: '#dc2626',
    });
    fixture.detectChanges();

    expect(state.categories().length).toBe(3);
    expect(state.categories()[2].name).toBe('Salud');
    expect(fixture.nativeElement.textContent).toContain('Salud');
    expect(notifications).toContain('Categoría creada correctamente.');
    expect(fixture.debugElement.query(By.directive(CategoryForm))).toBeNull();
  });

  it('should reject duplicate names ignoring case and spaces', () => {
    getButton('.categories-page-header-actions button').click();
    fixture.detectChanges();

    getForm().submitted.emit({
      name: ' alimentación ',
      icon: 'bi-tag',
      color: '#2563eb',
    });
    fixture.detectChanges();

    expect(state.categories().length).toBe(2);
    expect(getForm().errorMessage()).toBe('Ya existe una categoría con ese nombre.');
  });

  it('should edit an existing category', () => {
    getButton('[aria-label="Editar categoría Alimentación"]').click();
    fixture.detectChanges();

    expect(getForm().category()?.id).toBe('food');

    getForm().submitted.emit({
      name: 'Comida',
      icon: 'bi-cart',
      color: '#dc2626',
    });
    fixture.detectChanges();

    expect(state.categories()[0].name).toBe('Comida');
    expect(state.categories()[0].icon).toBe('bi-cart');
    expect(notifications).toContain('Categoría actualizada correctamente.');
  });

  it('should keep the form open when creation fails', () => {
    failCreate = true;

    getButton('.categories-page-header-actions button').click();
    fixture.detectChanges();

    getForm().submitted.emit({
      name: 'Salud',
      icon: 'bi-heart-pulse',
      color: '#dc2626',
    });
    fixture.detectChanges();

    expect(state.categories().length).toBe(2);
    expect(getForm().errorMessage()).toContain('No se ha podido crear la categoría');
    expect(getForm().isSaving()).toBe(false);
  });

  it('should show affected transactions before deletion', () => {
    getButton('[aria-label="Eliminar categoría Alimentación"]').click();
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;

    expect(getDialog()).toBeTruthy();
    expect(element.textContent).toMatch(/1\s+transacción asociada/);
    expect(element.textContent).toContain('Alimentación (eliminada)');
    expect(state.categories().length).toBe(2);
  });

  it('should cancel deletion without modifying data', () => {
    getButton('[aria-label="Eliminar categoría Alimentación"]').click();
    fixture.detectChanges();

    getDialog().cancelled.emit();
    fixture.detectChanges();

    expect(state.categories().length).toBe(2);
    expect(state.transactions()[0].categoryId).toBe('food');
    expect(fixture.debugElement.query(By.directive(ConfirmDialog))).toBeNull();
  });

  it('should preserve transaction history when deleting a category', () => {
    getButton('[aria-label="Eliminar categoría Alimentación"]').click();
    fixture.detectChanges();

    getDialog().confirmed.emit();
    fixture.detectChanges();

    expect(state.categories().length).toBe(1);
    expect(state.categories()[0].id).toBe('transport');
    expect(state.transactions()[0].categoryId).toBeNull();
    expect(state.transactions()[0].categoryNameSnapshot).toBe('Alimentación');
    expect(state.transactions().length).toBe(2);
    expect(state.uncategorizedTransactions()).toBe(2);
    expect(notifications).toContain('Categoría eliminada correctamente.');
  });

  it('should block deletion when the category has a budget', () => {
    state.budgets.set([
      {
        id: 'budget-1',
        userId: 'user-1',
        categoryId: 'food',
        amount: 300,
        month: '2026-09',
      } as Budget,
    ]);

    getButton('[aria-label="Eliminar categoría Alimentación"]').click();
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.directive(ConfirmDialog))).toBeNull();
    expect(notifications.some((message) => message.includes('tiene un presupuesto asociado'))).toBe(
      true,
    );
    expect(state.categories().length).toBe(2);
  });

  it('should reload data when unlinking a transaction fails', () => {
    failTransactionUpdate = true;

    getButton('[aria-label="Eliminar categoría Alimentación"]').click();
    fixture.detectChanges();

    getDialog().confirmed.emit();
    fixture.detectChanges();

    expect(state.categories().length).toBe(2);
    expect(state.transactions()[0].categoryId).toBe('food');
    expect(categoryReloads).toBe(2);
    expect(fixture.nativeElement.textContent).toContain('No se ha podido completar la eliminación');
  });

  it('should reload after a partial failure deleting the category', () => {
    failDelete = true;

    getButton('[aria-label="Eliminar categoría Alimentación"]').click();
    fixture.detectChanges();

    getDialog().confirmed.emit();
    fixture.detectChanges();

    expect(state.categories().length).toBe(2);
    expect(state.transactions()[0].categoryId).toBeNull();
    expect(state.transactions()[0].categoryNameSnapshot).toBe('Alimentación');
    expect(categoryReloads).toBe(2);
    expect(fixture.nativeElement.textContent).toContain('No se ha podido completar la eliminación');
  });
});
