import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { AuthService } from '../../../auth/services/auth.service';
import { CategoryService } from '../../services/category.service';
import { TransactionService } from '../../services/transaction.service';
import { ReportStateService } from './report-state';

describe('ReportStateService', () => {
  let service: ReportStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ReportStateService,
        {
          provide: AuthService,
          useValue: { currentUser: () => null },
        },
        {
          provide: TransactionService,
          useValue: { getTransactions: () => of([]) },
        },
        {
          provide: CategoryService,
          useValue: { getCategories: () => of([]) },
        },
      ],
    });

    service = TestBed.inject(ReportStateService);
  });

  it('should create', () => {
    expect(service).toBeTruthy();
  });

  it('should initialize the default filters', () => {
    expect(service.selectedPeriod()).toBe(6);
    expect(service.selectedCategoryIds()).toEqual([]);
    expect(service.selectedPaymentMethod()).toBe('all');
    expect(service.comparisonEnabled()).toBe(false);
  });

  it('should update the selected period', () => {
    service.changePeriod(3);

    expect(service.selectedPeriod()).toBe(3);
  });

  it('should reject an invalid period', () => {
    service.changePeriod(5);

    expect(service.selectedPeriod()).toBe(6);
  });

  it('should toggle selected categories', () => {
    service.toggleRankingCategory('food');

    expect(service.selectedCategoryIds()).toEqual(['food']);

    service.toggleRankingCategory('food');

    expect(service.selectedCategoryIds()).toEqual([]);
  });

  it('should clear analysis filters', () => {
    service.changeCategory('food');
    service.changePaymentMethod('card');

    service.clearAnalysisFilters();

    expect(service.selectedCategoryIds()).toEqual([]);
    expect(service.selectedPaymentMethod()).toBe('all');
  });
});
