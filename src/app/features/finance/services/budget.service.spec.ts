import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { Budget } from '../models';
import { BudgetService } from './budget.service';

describe('BudgetService', () => {
  let service: BudgetService;
  let httpTestingController: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [BudgetService, provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(BudgetService);
    httpTestingController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  it('should create', () => {
    expect(service).toBeTruthy();
  });

  it('should get budgets by user and month', () => {
    const budgets: Budget[] = [
      {
        id: 'budget-1',
        userId: 'user-1',
        categoryId: 'food',
        amount: 300,
        month: '2026-09',
      },
    ];

    service.getBudgets('user-1', '2026-09').subscribe((response) => {
      expect(response).toEqual(budgets);
    });

    const request = httpTestingController.expectOne(
      (req) =>
        req.url === 'http://localhost:3000/budgets' &&
        req.params.get('userId') === 'user-1' &&
        req.params.get('month') === '2026-09',
    );

    expect(request.request.method).toBe('GET');

    request.flush(budgets);
  });
});
