import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { Category, Transaction } from '../../../../features/finance/models';
import { HeaderSearchService } from './header-search.service';

describe('HeaderSearchService', () => {
  let service: HeaderSearchService;
  let httpTesting: HttpTestingController;

  const transactions: Transaction[] = [
    {
      id: 'transaction-1',
      userId: 'user-1',
      type: 'expense',
      amount: 12,
      description: 'Café',
      categoryId: 'category-1',
      date: '2026-10-01',
      paymentMethod: 'card',
      notes: '',
    },
    {
      id: 'transaction-2',
      userId: 'user-1',
      type: 'expense',
      amount: 25,
      description: 'Compra',
      categoryId: 'category-1',
      date: '2026-10-15',
      paymentMethod: 'card',
      notes: 'En el café del centro',
    },
    {
      id: 'transaction-3',
      userId: 'user-1',
      type: 'income',
      amount: 100,
      description: 'Nómina',
      categoryId: null,
      date: '2026-10-10',
      paymentMethod: 'bankTransfer',
      notes: '',
    },
  ];

  const categories: Category[] = [
    {
      id: 'category-1',
      userId: 'user-1',
      name: 'Alimentación',
      icon: 'bi-cup',
      color: '#ff9900',
    },
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(HeaderSearchService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should create', () => {
    expect(service).toBeTruthy();
  });

  it('should load transactions and categories for the user', () => {
    let result:
      | {
          transactions: Transaction[];
          categories: Category[];
        }
      | undefined;

    service.loadData('user-1').subscribe((data) => {
      result = data;
    });

    const transactionRequest = httpTesting.expectOne(
      (request) =>
        request.url.endsWith('/transactions') && request.params.get('userId') === 'user-1',
    );

    const categoryRequest = httpTesting.expectOne(
      (request) => request.url.endsWith('/categories') && request.params.get('userId') === 'user-1',
    );

    transactionRequest.flush(transactions);
    categoryRequest.flush(categories);

    expect(result).toEqual({ transactions, categories });
  });

  it('should filter by description and notes', () => {
    const result = service.filterTransactions(transactions, 'CAFÉ');

    expect(result.map((transaction) => transaction.id)).toEqual(['transaction-2', 'transaction-1']);
  });

  it('should return no results for an empty query', () => {
    expect(service.filterTransactions(transactions, '   ')).toEqual([]);
  });

  it('should not modify the original transaction order', () => {
    service.filterTransactions(transactions, 'café');

    expect(transactions[0].id).toBe('transaction-1');
    expect(transactions[1].id).toBe('transaction-2');
  });
});
