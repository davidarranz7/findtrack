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
import { Category, Transaction } from '../../features/finance/models';
import { Notification } from '../../features/finance/models/notification';
import { CategoryService } from '../../features/finance/services/category.service';
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
  private readonly categoryService = inject(CategoryService);
  private readonly toastService = inject(ToastService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  private readonly notificationWrapper = viewChild<ElementRef<HTMLElement>>('notificationWrapper');
  private readonly searchWrapper = viewChild<ElementRef<HTMLElement>>('searchWrapper');

  private readonly currencyFormatter = new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  });

  private readonly dateFormatter = new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  protected readonly currentSection = signal(this.getSectionLabel(this.router.url));

  protected readonly isDark = this.themeService.isDark;
  protected readonly isSavingTheme = signal(false);

  protected readonly notifications = signal<Notification[]>([]);
  protected readonly isNotificationPanelOpen = signal(false);
  protected readonly isLoadingNotifications = signal(false);

  protected readonly unreadNotificationCount = computed(
    () => this.notifications().filter((notification) => !notification.isRead).length,
  );

  protected readonly searchQuery = signal('');
  protected readonly isSearchOpen = signal(false);
  protected readonly isLoadingSearch = signal(false);
  protected readonly searchError = signal<string | null>(null);
  protected readonly searchTransactions = signal<Transaction[]>([]);
  protected readonly searchCategories = signal<Category[]>([]);
  protected readonly hasLoadedSearchData = signal(false);
  protected readonly showAllSearchResults = signal(false);
  protected readonly activeSearchIndex = signal(-1);

  protected readonly matchingSearchTransactions = computed(() => {
    const query = this.searchQuery().trim().toLocaleLowerCase('es-ES');

    if (!query) {
      return [];
    }

    return this.searchTransactions()
      .filter((transaction) => {
        const description = transaction.description.toLocaleLowerCase('es-ES');
        const notes = (transaction.notes ?? '').toLocaleLowerCase('es-ES');

        return description.includes(query) || notes.includes(query);
      })
      .sort((first, second) => second.date.localeCompare(first.date));
  });

  protected readonly visibleSearchResults = computed(() => {
    const matches = this.matchingSearchTransactions();

    return this.showAllSearchResults() ? matches : matches.slice(0, 6);
  });

  constructor() {
    this.themeService.setTheme(this.themeService.theme());

    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((event) => {
        this.currentSection.set(this.getSectionLabel(event.urlAfterRedirects));

        this.closeSearch(true);
        this.hasLoadedSearchData.set(false);
        this.closeNotificationPanel();
        this.loadNotifications();
      });

    this.transactionService.transactionsChanged$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.hasLoadedSearchData.set(false);

        if (this.isSearchOpen()) {
          this.loadSearchData();
        }

        this.loadNotifications();
      });

    this.loadNotifications();
  }

  @HostListener('document:click', ['$event'])
  protected handleDocumentClick(event: MouseEvent): void {
    const target = event.target;

    if (!(target instanceof Node)) {
      return;
    }

    if (this.isSearchOpen()) {
      const searchElement = this.searchWrapper()?.nativeElement;

      if (searchElement && !searchElement.contains(target)) {
        this.closeSearch();
      }
    }

    if (this.isNotificationPanelOpen()) {
      const notificationElement = this.notificationWrapper()?.nativeElement;

      if (notificationElement && !notificationElement.contains(target)) {
        this.closeNotificationPanel();
      }
    }
  }

  @HostListener('document:keydown.escape')
  protected handleEscapeKey(): void {
    this.closeSearch();
    this.closeNotificationPanel();
  }

  protected openSearch(): void {
    this.closeNotificationPanel();
    this.isSearchOpen.set(true);

    if (!this.hasLoadedSearchData() && !this.isLoadingSearch()) {
      this.loadSearchData();
    }
  }

  protected closeSearch(clearQuery = false): void {
    this.isSearchOpen.set(false);
    this.activeSearchIndex.set(-1);
    this.showAllSearchResults.set(false);

    if (clearQuery) {
      this.searchQuery.set('');
    }
  }

  protected updateSearchQuery(value: string): void {
    this.searchQuery.set(value);
    this.showAllSearchResults.set(false);
    this.activeSearchIndex.set(value.trim() ? 0 : -1);

    if (!this.isSearchOpen()) {
      this.openSearch();
    }
  }

  protected clearSearch(): void {
    this.searchQuery.set('');
    this.activeSearchIndex.set(-1);
    this.showAllSearchResults.set(false);
  }

  protected expandSearchResults(): void {
    this.showAllSearchResults.set(true);
    this.activeSearchIndex.set(0);
  }

  protected handleSearchKeydown(event: KeyboardEvent): void {
    const results = this.visibleSearchResults();

    if (!this.isSearchOpen() || results.length === 0) {
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();

      this.activeSearchIndex.update((index) => (index < results.length - 1 ? index + 1 : 0));

      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();

      this.activeSearchIndex.update((index) => (index > 0 ? index - 1 : results.length - 1));

      return;
    }

    if (event.key === 'Enter') {
      const index = this.activeSearchIndex();
      const transaction = results[index];

      if (transaction) {
        event.preventDefault();
        this.openSearchResult(transaction);
      }
    }
  }

  protected openSearchResult(transaction: Transaction): void {
    this.closeSearch(true);

    void this.router.navigate(['/transactions'], {
      queryParams: {
        month: transaction.date.slice(0, 7),
        search: transaction.description,
      },
    });
  }

  protected getSearchCategoryName(categoryId: string | null): string {
    if (!categoryId) {
      return 'Sin categoría';
    }

    return (
      this.searchCategories().find((category) => category.id === categoryId)?.name ??
      'Sin categoría'
    );
  }

  protected formatSearchDate(date: string): string {
    const [year, month, day] = date.split('-').map(Number);

    return this.dateFormatter.format(new Date(year, month - 1, day));
  }

  protected formatSearchAmount(transaction: Transaction): string {
    const amount = this.currencyFormatter.format(transaction.amount);

    return transaction.type === 'income' ? `+${amount}` : `-${amount}`;
  }

  protected loadSearchData(): void {
    if (this.isLoadingSearch()) {
      return;
    }

    const userId = this.authService.currentUser()?.id;

    if (!userId) {
      this.searchTransactions.set([]);
      this.searchCategories.set([]);
      this.searchError.set('No se ha podido identificar al usuario actual.');
      return;
    }

    this.isLoadingSearch.set(true);
    this.searchError.set(null);

    forkJoin({
      transactions: this.transactionService.getTransactions(userId),
      categories: this.categoryService.getCategories(userId),
    })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isLoadingSearch.set(false)),
      )
      .subscribe({
        next: ({ transactions, categories }) => {
          if (this.authService.currentUser()?.id !== userId) {
            return;
          }

          this.searchTransactions.set(transactions);
          this.searchCategories.set(categories);
          this.hasLoadedSearchData.set(true);
        },
        error: () => {
          this.searchTransactions.set([]);
          this.searchCategories.set([]);
          this.hasLoadedSearchData.set(false);
          this.searchError.set('No hemos podido cargar los resultados de búsqueda.');
        },
      });
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

    if (willOpen) {
      this.closeSearch();
    }

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
    this.closeSearch(true);
    this.closeNotificationPanel();

    void this.router.navigate(['/settings']);
  }

  protected logout(): void {
    this.closeSearch(true);
    this.closeNotificationPanel();

    this.searchTransactions.set([]);
    this.searchCategories.set([]);
    this.hasLoadedSearchData.set(false);

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
