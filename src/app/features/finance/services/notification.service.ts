import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { forkJoin, map, Observable, of, switchMap } from 'rxjs';

import { Notification } from '../models/notification';
import { BudgetAnalysisService } from './budget-analysis.service';
import { BudgetService } from './budget.service';
import { CategoryService } from './category.service';
import { PreferencesService } from './preferences.service';
import { TransactionService } from './transaction.service';

type CreateNotificationPayload = Omit<Notification, 'id'>;

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private readonly http = inject(HttpClient);
  private readonly budgetService = inject(BudgetService);
  private readonly categoryService = inject(CategoryService);
  private readonly transactionService = inject(TransactionService);
  private readonly preferencesService = inject(PreferencesService);
  private readonly budgetAnalysisService = inject(BudgetAnalysisService);

  private readonly apiUrl = 'http://localhost:3000/notifications';

  private readonly currencyFormatter = new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  });

  getNotifications(userId: string): Observable<Notification[]> {
    return this.http
      .get<Notification[]>(this.apiUrl, {
        params: { userId },
      })
      .pipe(
        map((notifications) =>
          [...notifications].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          ),
        ),
      );
  }

  createNotification(notification: CreateNotificationPayload): Observable<Notification> {
    return this.http.post<Notification>(this.apiUrl, notification);
  }

  notificationExists(userId: string, eventKey: string): Observable<boolean> {
    return this.http
      .get<Notification[]>(this.apiUrl, {
        params: {
          userId,
          eventKey,
        },
      })
      .pipe(map((notifications) => notifications.length > 0));
  }

  markAsRead(notificationId: string): Observable<Notification> {
    return this.http.patch<Notification>(`${this.apiUrl}/${notificationId}`, {
      isRead: true,
    });
  }

  syncBudgetNotifications(userId: string, month: string): Observable<Notification[]> {
    return forkJoin({
      budgets: this.budgetService.getBudgets(userId, month),
      categories: this.categoryService.getCategories(userId),
      transactions: this.transactionService.getTransactions(userId),
      preferences: this.preferencesService.getOrCreatePreferences(userId),
    }).pipe(
      map(({ budgets, categories, transactions, preferences }) => {
        const budgetProgress = this.budgetAnalysisService.getBudgetProgress(
          budgets,
          transactions,
          categories,
          month,
        );

        return budgetProgress.flatMap((budget) => {
          const notifications: CreateNotificationPayload[] = [];

          if (budget.status === 'warning' && preferences.budgetWarningEnabled) {
            notifications.push({
              userId,
              type: 'budgetWarning',
              title: 'Presupuesto próximo al límite',
              message: `Has utilizado el ${Math.round(
                budget.percentage,
              )}% de tu presupuesto de ${budget.categoryName}.`,
              createdAt: new Date().toISOString(),
              isRead: false,
              eventKey: `budget-warning:${budget.budgetId}:${month}`,
              budgetId: budget.budgetId,
              categoryId: budget.categoryId,
            });
          }

          if (budget.status === 'exceeded' && preferences.budgetExceededEnabled) {
            notifications.push({
              userId,
              type: 'budgetExceeded',
              title: 'Presupuesto superado',
              message: `Has superado el presupuesto de ${
                budget.categoryName
              } en ${this.currencyFormatter.format(Math.abs(budget.remaining))}.`,
              createdAt: new Date().toISOString(),
              isRead: false,
              eventKey: `budget-exceeded:${budget.budgetId}:${month}`,
              budgetId: budget.budgetId,
              categoryId: budget.categoryId,
            });
          }

          return notifications;
        });
      }),
      switchMap((notifications) => {
        if (notifications.length === 0) {
          return of([]);
        }

        return forkJoin(
          notifications.map((notification) => this.createNotificationIfMissing(notification)),
        ).pipe(
          map((createdNotifications) =>
            createdNotifications.filter(
              (notification): notification is Notification => notification !== null,
            ),
          ),
        );
      }),
    );
  }

  private createNotificationIfMissing(
    notification: CreateNotificationPayload,
  ): Observable<Notification | null> {
    return this.notificationExists(notification.userId, notification.eventKey).pipe(
      switchMap((exists) => {
        if (exists) {
          return of(null);
        }

        return this.createNotification(notification);
      }),
    );
  }
}
