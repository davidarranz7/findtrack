import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ReportAnalysisService } from '../../services/report-analysis';
import { ReportChartDataService } from '../../services/report-chart-data';
import { ReportStateService } from '../../services/report-state';
import { ReportCategoryRanking } from './report-category-ranking';

describe('ReportCategoryRanking', () => {
  let fixture: ComponentFixture<ReportCategoryRanking>;

  const selectedCategoryIds = signal<string[]>([]);

  const topExpenseCategories = signal([
    {
      categoryId: 'food',
      categoryName: 'Alimentación',
      amount: 350,
      percentage: 70,
      color: '#2563eb',
    },
    {
      categoryId: 'transport',
      categoryName: 'Transporte',
      amount: 150,
      percentage: 30,
      color: '#16a34a',
    },
  ]);

  const stateMock = {
    selectedCategoryIds,
    isCategorySelected: (categoryId: string) => selectedCategoryIds().includes(categoryId),
    toggleRankingCategory: (categoryId: string) =>
      selectedCategoryIds.update((selected) =>
        selected.includes(categoryId)
          ? selected.filter((id) => id !== categoryId)
          : [...selected, categoryId],
      ),
    clearRankingCategorySelection: () => selectedCategoryIds.set([]),
  };

  beforeEach(async () => {
    selectedCategoryIds.set([]);

    topExpenseCategories.set([
      {
        categoryId: 'food',
        categoryName: 'Alimentación',
        amount: 350,
        percentage: 70,
        color: '#2563eb',
      },
      {
        categoryId: 'transport',
        categoryName: 'Transporte',
        amount: 150,
        percentage: 30,
        color: '#16a34a',
      },
    ]);

    await TestBed.configureTestingModule({
      imports: [ReportCategoryRanking],
      providers: [
        { provide: ReportStateService, useValue: stateMock },
        {
          provide: ReportAnalysisService,
          useValue: {
            formatCurrency: (amount: number) =>
              new Intl.NumberFormat('es-ES', {
                style: 'currency',
                currency: 'EUR',
              }).format(amount),
          },
        },
        {
          provide: ReportChartDataService,
          useValue: { topExpenseCategories },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ReportCategoryRanking);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should display expense categories', () => {
    const element: HTMLElement = fixture.nativeElement;

    expect(element.querySelectorAll('.top-category').length).toBe(2);
    expect(element.textContent).toContain('Alimentación');
    expect(element.textContent).toContain('Transporte');
  });

  it('should select and deselect a category', () => {
    const element: HTMLElement = fixture.nativeElement;
    const button = element.querySelector<HTMLButtonElement>('.top-category-filter');

    expect(button).not.toBeNull();

    button!.click();
    fixture.detectChanges();

    expect(selectedCategoryIds()).toEqual(['food']);
    expect(button!.getAttribute('aria-pressed')).toBe('true');

    button!.click();
    fixture.detectChanges();

    expect(selectedCategoryIds()).toEqual([]);
    expect(button!.getAttribute('aria-pressed')).toBe('false');
  });

  it('should clear selected categories', () => {
    selectedCategoryIds.set(['food']);
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;
    const button = element.querySelector<HTMLButtonElement>('.top-categories-clear');

    expect(button).not.toBeNull();

    button!.click();
    fixture.detectChanges();

    expect(selectedCategoryIds()).toEqual([]);
  });

  it('should display an empty state when there are no categories', () => {
    topExpenseCategories.set([]);
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;

    expect(element.textContent).toContain('No hay categorías que analizar');
  });
});
