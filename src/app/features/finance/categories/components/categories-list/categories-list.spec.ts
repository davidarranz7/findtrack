import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Category, Transaction } from '../../../models';
import { CategoriesStateService } from '../../services/categories-state';
import { CategoriesList } from './categories-list';

describe('CategoriesList', () => {
  let fixture: ComponentFixture<CategoriesList>;

  const foodCategory = {
    id: 'food',
    userId: 'user-1',
    name: 'Alimentación',
    icon: 'bi-basket',
    color: '#16a34a',
  } as Category;

  const transportCategory = {
    id: 'transport',
    userId: 'user-1',
    name: 'Transporte',
    icon: 'bi bi-bus-front',
    color: '#2563eb',
  } as Category;

  const categories = signal<Category[]>([]);
  const transactions = signal<Transaction[]>([]);
  const isLoadingCategories = signal(false);
  const isLoadingBudgets = signal(false);

  const totalCategories = computed(() => categories().length);

  const getTransactionCount = (categoryId: string): number =>
    transactions().filter((transaction) => transaction.categoryId === categoryId).length;

  beforeEach(async () => {
    categories.set([foodCategory, transportCategory]);
    transactions.set([
      { id: 'transaction-1', categoryId: 'food' } as Transaction,
      { id: 'transaction-2', categoryId: 'food' } as Transaction,
      { id: 'transaction-3', categoryId: 'transport' } as Transaction,
    ]);
    isLoadingCategories.set(false);
    isLoadingBudgets.set(false);

    await TestBed.configureTestingModule({
      imports: [CategoriesList],
      providers: [
        {
          provide: CategoriesStateService,
          useValue: {
            categories,
            totalCategories,
            isLoadingCategories,
            isLoadingBudgets,
            getTransactionCount,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CategoriesList);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should display categories in their original order', () => {
    const element = fixture.nativeElement as HTMLElement;
    const names = element.querySelectorAll('.category-name');

    expect(names.length).toBe(2);
    expect(names[0].textContent).toContain('Alimentación');
    expect(names[1].textContent).toContain('Transporte');
    expect(element.textContent).toMatch(/2\s+categorías/);
  });

  it('should display the number of associated transactions', () => {
    const element = fixture.nativeElement as HTMLElement;
    const cards = element.querySelectorAll('.category-card');

    expect(cards[0].textContent).toMatch(/2\s+transacciones/);
    expect(cards[1].textContent).toMatch(/1\s+transacción/);
  });

  it('should render category icons correctly', () => {
    const icons = fixture.nativeElement.querySelectorAll(
      '.category-icon i',
    ) as NodeListOf<HTMLElement>;

    expect(icons[0].classList.contains('bi')).toBe(true);
    expect(icons[0].classList.contains('bi-basket')).toBe(true);
    expect(icons[1].classList.contains('bi-bus-front')).toBe(true);
  });

  it('should emit the category selected for editing', () => {
    let selected: Category | null = null;

    fixture.componentInstance.editRequested.subscribe((category) => {
      selected = category;
    });

    const button = fixture.nativeElement.querySelector(
      '[aria-label="Editar categoría Alimentación"]',
    ) as HTMLButtonElement;

    button.click();

    expect(selected).toEqual(foodCategory);
  });

  it('should emit the category selected for deletion', () => {
    let selected: Category | null = null;

    fixture.componentInstance.deleteRequested.subscribe((category) => {
      selected = category;
    });

    const button = fixture.nativeElement.querySelector(
      '[aria-label="Eliminar categoría Transporte"]',
    ) as HTMLButtonElement;

    button.click();

    expect(selected).toEqual(transportCategory);
  });

  it('should disable deletion while budgets are loading', () => {
    isLoadingBudgets.set(true);
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll(
      '.category-action-delete',
    ) as NodeListOf<HTMLButtonElement>;

    expect(buttons.length).toBe(2);
    expect(buttons[0].disabled).toBe(true);
    expect(buttons[1].disabled).toBe(true);
  });

  it('should disable deletion while another category is being deleted', () => {
    fixture.componentRef.setInput('deletingCategoryId', 'food');
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll(
      '.category-action-delete',
    ) as NodeListOf<HTMLButtonElement>;

    expect(buttons[0].disabled).toBe(true);
    expect(buttons[1].disabled).toBe(true);
  });

  it('should show the empty state and allow creating a category', () => {
    categories.set([]);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).toContain('No tienes categorías');

    let requested = false;

    fixture.componentInstance.createRequested.subscribe(() => {
      requested = true;
    });

    const button = element.querySelector('.categories-empty button') as HTMLButtonElement;

    button.click();

    expect(requested).toBe(true);
  });

  it('should show a loading indicator while categories load', () => {
    isLoadingCategories.set(true);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('.categories-loading')).not.toBeNull();
    expect(element.querySelectorAll('.category-card').length).toBe(0);
  });

  it('should update transaction counts when data changes', () => {
    transactions.set([]);
    fixture.detectChanges();

    const cards = fixture.nativeElement.querySelectorAll(
      '.category-card',
    ) as NodeListOf<HTMLElement>;

    expect(cards[0].textContent).toMatch(/0\s+transacciones/);
    expect(cards[1].textContent).toMatch(/0\s+transacciones/);
  });
});
