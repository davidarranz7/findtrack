import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  HostListener,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { catchError, filter, finalize, forkJoin, of, switchMap } from 'rxjs';

import { AuthService } from '../../features/auth/services/auth.service';
import { Notification } from '../../features/finance/models/notification';
import { NotificationService } from '../../features/finance/services/notification.service';
import { PreferencesService } from '../../features/finance/services/preferences.service';
import { ThemeService } from '../../features/finance/services/theme.service';
import { TransactionService } from '../../features/finance/services/transaction.service';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { NotificationPanel } from './notification-panel/notification-panel';

@Component({
  selector: 'app-header',
  imports: [NotificationPanel],
  templateUrl: './header.html',
  styleUrl: './header.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Header {
  private readonly authService = inject(AuthService);
  private readonly themeService = inject(ThemeService);
  private readonly preferencesService = inject(PreferencesService);
  private readonly notificationService = inject(NotificationService);
  private readonly transactionService = inject(TransactionService);
  private readonly toastService = inject(ToastService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  private readonly notificationWrapper = viewChild<ElementRef<HTMLElement>>('notificationWrapper');

  protected readonly currentSection = signal(this.getSectionLabel(this.router.url));

  protected readonly isDark = this.themeService.isDark;
  protected readonly isSavingTheme = signal(false);

  protected readonly notifications = signal<Notification[]>([]);
  protected readonly isNotificationPanelOpen = signal(false);
  protected readonly isLoadingNotifications = signal(false);

  protected readonly unreadNotificationCount = computed(
    () => this.notifications().filter((notification) => !notification.isRead).length,
  );

  constructor() {
    this.themeService.setTheme(this.themeService.theme());

    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((event) => {
        this.currentSection.set(this.getSectionLabel(event.urlAfterRedirects));

        this.closeNotificationPanel();
        this.loadNotifications();
      });

    this.transactionService.transactionsChanged$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.loadNotifications();
      });

    this.loadNotifications();
  }

  @HostListener('document:click', ['$event'])
  protected handleDocumentClick(event: MouseEvent): void {
    if (!this.isNotificationPanelOpen()) {
      return;
    }

    const wrapper = this.notificationWrapper()?.nativeElement;
    const target = event.target;

    if (wrapper && target instanceof Node && !wrapper.contains(target)) {
      this.closeNotificationPanel();
    }
  }

  @HostListener('document:keydown.escape')
  protected handleEscapeKey(): void {
    this.closeNotificationPanel();
  }

  protected toggleTheme(): void {
    if (this.isSavingTheme()) {
      return;
    }

    const userId = this.authService.currentUser()?.id;

    if (!userId) {
      return;
    }

    const previousTheme = this.themeService.theme();
    const nextTheme = previousTheme === 'light' ? 'dark' : 'light';

    this.themeService.setTheme(nextTheme);
    this.isSavingTheme.set(true);

    this.preferencesService
      .getOrCreatePreferences(userId)
      .pipe(
        switchMap((preferences) =>
          this.preferencesService.updatePreferences(preferences.id, {
            currency: preferences.currency,
            locale: preferences.locale,
            dateFormat: preferences.dateFormat,
            theme: nextTheme,
            budgetWarningEnabled: preferences.budgetWarningEnabled,
            budgetExceededEnabled: preferences.budgetExceededEnabled,
            savingsGoalEnabled: preferences.savingsGoalEnabled,
          }),
        ),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isSavingTheme.set(false)),
      )
      .subscribe({
        error: () => {
          if (this.authService.currentUser()?.id !== userId) {
            return;
          }

          this.themeService.setTheme(previousTheme);
          this.toastService.error('No se ha podido guardar el tema visual.');
        },
      });
  }

  protected toggleNotificationPanel(): void {
    const willOpen = !this.isNotificationPanelOpen();

    this.isNotificationPanelOpen.set(willOpen);

    if (willOpen) {
      this.loadNotifications();
    }
  }

  protected closeNotificationPanel(): void {
    this.isNotificationPanelOpen.set(false);
  }

  protected handleNotificationSelected(notification: Notification): void {
    if (notification.isRead) {
      this.openNotificationDestination(notification);
      return;
    }

    this.notificationService
      .markAsRead(notification.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updatedNotification) => {
          this.updateNotification(updatedNotification);
          this.openNotificationDestination(updatedNotification);
        },
        error: () => {
          this.openNotificationDestination(notification);
        },
      });
  }

  protected markAllNotificationsAsRead(): void {
    const unreadNotifications = this.notifications().filter((notification) => !notification.isRead);

    if (unreadNotifications.length === 0) {
      return;
    }

    forkJoin(
      unreadNotifications.map((notification) =>
        this.notificationService.markAsRead(notification.id),
      ),
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updatedNotifications) => {
          const updatedById = new Map(
            updatedNotifications.map((notification) => [notification.id, notification]),
          );

          this.notifications.update((notifications) =>
            notifications.map((notification) => updatedById.get(notification.id) ?? notification),
          );
        },
      });
  }

  protected openSettings(): void {
    this.closeNotificationPanel();

    void this.router.navigate(['/settings']);
  }

  protected logout(): void {
    this.closeNotificationPanel();
    this.themeService.setTheme('light');
    this.authService.clearCurrentUser();

    void this.router.navigate(['/login']);
  }

  private loadNotifications(): void {
    const userId = this.authService.currentUser()?.id;

    if (!userId) {
      this.notifications.set([]);
      return;
    }

    this.isLoadingNotifications.set(true);

    this.notificationService
      .syncBudgetNotifications(userId, this.getCurrentMonthKey())
      .pipe(
        catchError(() => of([])),
        switchMap(() => this.notificationService.getNotifications(userId)),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isLoadingNotifications.set(false)),
      )
      .subscribe({
        next: (notifications) => {
          this.notifications.set(notifications);
        },
        error: () => {
          this.notifications.set([]);
        },
      });
  }

  private updateNotification(updatedNotification: Notification): void {
    this.notifications.update((notifications) =>
      notifications.map((notification) =>
        notification.id === updatedNotification.id ? updatedNotification : notification,
      ),
    );
  }

  private openNotificationDestination(notification: Notification): void {
    this.closeNotificationPanel();

    if (notification.type === 'savingsGoal') {
      void this.router.navigate(['/overview']);
      return;
    }

    void this.router.navigate(['/budgets']);
  }

  private getCurrentMonthKey(): string {
    const currentDate = new Date();

    return `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
  }

  private getSectionLabel(url: string): string {
    const path = url.split('?')[0].split('#')[0];

    if (path.startsWith('/transactions')) {
      return 'Transacciones';
    }

    if (path.startsWith('/budgets')) {
      return 'Presupuestos';
    }

    if (path.startsWith('/categories')) {
      return 'Categorías';
    }

    if (path.startsWith('/reports')) {
      return 'Informes y Estadísticas';
    }

    if (path.startsWith('/settings')) {
      return 'Configuración';
    }

    return 'Resumen';
  }
}
