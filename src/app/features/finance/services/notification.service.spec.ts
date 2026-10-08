import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  let service: NotificationService;
  let httpTestingController: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(NotificationService);

    httpTestingController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  it('should create', () => {
    expect(service).toBeTruthy();
  });

  it('should mark a notification as read', () => {
    service.markAsRead('notification-1').subscribe((notification) => {
      expect(notification.isRead).toBe(true);
    });

    const request = httpTestingController.expectOne(
      'http://localhost:3000/notifications/notification-1',
    );

    expect(request.request.method).toBe('PATCH');

    expect(request.request.body).toEqual({
      isRead: true,
    });

    request.flush({
      id: 'notification-1',
      userId: 'user-1',
      type: 'budgetWarning',
      title: 'Presupuesto próximo al límite',
      message: 'Mensaje',
      createdAt: '2026-10-09T00:00:00.000Z',
      isRead: true,
      eventKey: 'budget-warning:budget-1:2026-10',
      budgetId: 'budget-1',
      categoryId: 'category-food',
    });
  });
});
