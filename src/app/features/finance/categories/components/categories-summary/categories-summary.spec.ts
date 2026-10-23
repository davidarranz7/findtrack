import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CategoriesStateService } from '../../services/categories-state';
import { CategoriesSummary } from './categories-summary';

describe('CategoriesSummary', () => {
  let fixture: ComponentFixture<CategoriesSummary>;

  const categories = signal(['food', 'transport']);
  const transactionCategoryIds = signal<(string | null)[]>(['food', 'transport', null]);
  const isLoading = signal(false);

  const totalCategories = computed(() => categories().length);

  const categorizedTransactions = computed(
    () =>
      transactionCategoryIds().filter(
        (categoryId) => categoryId !== null && categories().includes(categoryId),
      ).length,
  );

  const uncategorizedTransactions = computed(
    () => transactionCategoryIds().length - categorizedTransactions(),
  );

  beforeEach(async () => {
    categories.set(['food', 'transport']);
    transactionCategoryIds.set(['food', 'transport', null]);
    isLoading.set(false);

    await TestBed.configureTestingModule({
      imports: [CategoriesSummary],
      providers: [
        {
          provide: CategoriesStateService,
          useValue: {
            isLoading,
            totalCategories,
            categorizedTransactions,
            uncategorizedTransactions,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CategoriesSummary);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should display the three summary cards', () => {
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelectorAll('.summary-card').length).toBe(3);
    expect(element.textContent).toContain('Total categorías');
    expect(element.textContent).toContain('Movimientos categorizados');
    expect(element.textContent).toContain('Sin categoría');
  });

  it('should display the correct statistics', () => {
    const values = fixture.nativeElement.querySelectorAll(
      '.summary-value',
    ) as NodeListOf<HTMLElement>;

    expect(values.length).toBe(3);
    expect(values[0].textContent?.trim()).toBe('2');
    expect(values[1].textContent?.trim()).toBe('2');
    expect(values[2].textContent?.trim()).toBe('1');
  });

  it('should update when a category is added', () => {
    categories.set(['food', 'transport', 'health']);
    fixture.detectChanges();

    const values = fixture.nativeElement.querySelectorAll(
      '.summary-value',
    ) as NodeListOf<HTMLElement>;

    expect(values[0].textContent?.trim()).toBe('3');
    expect(values[1].textContent?.trim()).toBe('2');
    expect(values[2].textContent?.trim()).toBe('1');
  });

  it('should update when a category disappears', () => {
    categories.set(['transport']);
    fixture.detectChanges();

    const values = fixture.nativeElement.querySelectorAll(
      '.summary-value',
    ) as NodeListOf<HTMLElement>;

    expect(values[0].textContent?.trim()).toBe('1');
    expect(values[1].textContent?.trim()).toBe('1');
    expect(values[2].textContent?.trim()).toBe('2');
  });

  it('should update when transactions become uncategorized', () => {
    transactionCategoryIds.set([null, null, 'transport']);
    fixture.detectChanges();

    const values = fixture.nativeElement.querySelectorAll(
      '.summary-value',
    ) as NodeListOf<HTMLElement>;

    expect(values[0].textContent?.trim()).toBe('2');
    expect(values[1].textContent?.trim()).toBe('1');
    expect(values[2].textContent?.trim()).toBe('2');
  });

  it('should display zero values when no data exists', () => {
    categories.set([]);
    transactionCategoryIds.set([]);
    fixture.detectChanges();

    const values = fixture.nativeElement.querySelectorAll(
      '.summary-value',
    ) as NodeListOf<HTMLElement>;

    expect(values.length).toBe(3);

    for (const value of values) {
      expect(value.textContent?.trim()).toBe('0');
    }
  });

  it('should display loading indicators while fetching data', () => {
    isLoading.set(true);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelectorAll('.spinner-border').length).toBe(3);
    expect(element.querySelectorAll('.summary-value').length).toBe(0);
  });
});
