import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { Notification, NotificationType } from '../../../features/finance/models/notification';

@Component({
  selector: 'app-notification-panel',
  imports: [],
  templateUrl: './notification-panel.html',
  styleUrl: './notification-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationPanel {
  readonly notifications = input.required<Notification[]>();

  readonly isLoading = input(false);

  readonly notificationSelected = output<Notification>();

  readonly markAllAsRead = output<void>();

  protected readonly unreadCount = computed(
    () => this.notifications().filter((notification) => !notification.isRead).length,
  );

  protected selectNotification(notification: Notification): void {
    this.notificationSelected.emit(notification);
  }

  protected markAll(): void {
    if (this.unreadCount() === 0) {
      return;
    }

    this.markAllAsRead.emit();
  }

  protected getIcon(type: NotificationType): string {
    switch (type) {
      case 'budgetWarning':
        return 'bi-exclamation-triangle';
      case 'budgetExceeded':
        return 'bi-exclamation-circle';
      case 'savingsGoal':
        return 'bi-trophy';
      case 'budgetUpdated':
        return 'bi-info-circle';
    }
  }

  protected getTypeClass(type: NotificationType): string {
    switch (type) {
      case 'budgetWarning':
        return 'notification-warning';
      case 'budgetExceeded':
        return 'notification-danger';
      case 'savingsGoal':
        return 'notification-success';
      case 'budgetUpdated':
        return 'notification-info';
    }
  }

  protected formatRelativeTime(createdAt: string): string {
    const createdDate = new Date(createdAt);
    const now = new Date();

    const differenceInMilliseconds = now.getTime() - createdDate.getTime();

    const differenceInMinutes = Math.floor(differenceInMilliseconds / 60000);

    if (differenceInMinutes < 1) {
      return 'Ahora';
    }

    if (differenceInMinutes < 60) {
      return `Hace ${differenceInMinutes} min`;
    }

    const differenceInHours = Math.floor(differenceInMinutes / 60);

    if (differenceInHours < 24) {
      return `Hace ${differenceInHours} h`;
    }

    const differenceInDays = Math.floor(differenceInHours / 24);

    if (differenceInDays === 1) {
      return 'Ayer';
    }

    if (differenceInDays < 7) {
      return `Hace ${differenceInDays} días`;
    }

    return new Intl.DateTimeFormat('es-ES', {
      day: 'numeric',
      month: 'short',
    }).format(createdDate);
  }
}
