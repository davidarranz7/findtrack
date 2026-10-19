import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, finalize, switchMap } from 'rxjs';

import { AuthService } from '../../features/auth/services/auth.service';
import { PreferencesService } from '../../features/finance/services/preferences.service';
import { ThemeService } from '../../features/finance/services/theme.service';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { HeaderNotifications } from './header-notifications/header-notifications';
import { HeaderSearch } from './header-search/header-search';

@Component({
  selector: 'app-header',
  imports: [HeaderSearch, HeaderNotifications],
  templateUrl: './header.html',
  styleUrl: './header.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Header {
  private readonly authService = inject(AuthService);
  private readonly themeService = inject(ThemeService);
  private readonly preferencesService = inject(PreferencesService);
  private readonly toastService = inject(ToastService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  private readonly headerSearch = viewChild(HeaderSearch);
  private readonly headerNotifications = viewChild(HeaderNotifications);

  protected readonly currentSection = signal(this.getSectionLabel(this.router.url));
  protected readonly isDark = this.themeService.isDark;
  protected readonly isSavingTheme = signal(false);

  constructor() {
    this.themeService.setTheme(this.themeService.theme());

    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((event) => {
        this.currentSection.set(this.getSectionLabel(event.urlAfterRedirects));
      });
  }

  protected closeSearch(): void {
    this.headerSearch()?.closeSearch();
  }

  protected closeNotifications(): void {
    this.headerNotifications()?.closeNotificationPanel();
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

  protected openSettings(): void {
    this.headerSearch()?.closeSearch(true);
    this.closeNotifications();

    void this.router.navigate(['/settings']);
  }

  protected logout(): void {
    this.headerSearch()?.resetOnLogout();
    this.closeNotifications();

    this.themeService.setTheme('light');
    this.authService.clearCurrentUser();

    void this.router.navigate(['/login']);
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
