import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  HostListener,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';

import { AuthService } from '../../features/auth/services/auth.service';
import { PreferencesService } from '../../features/finance/services/preferences.service';
import { ThemeService } from '../../features/finance/services/theme.service';
import { Toast } from '../../shared/ui/toast/toast';
import { Header } from '../header/header';
import { Sidebar } from '../sidebar/sidebar';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, Sidebar, Header, Toast],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppShell {
  private readonly authService = inject(AuthService);
  private readonly preferencesService = inject(PreferencesService);
  private readonly themeService = inject(ThemeService);
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);

  private readonly menuButton = viewChild<ElementRef<HTMLButtonElement>>('menuButton');

  private readonly userId = computed(() => this.authService.currentUser()?.id ?? null);

  protected readonly isMobileMenuOpen = signal(false);

  constructor() {
    effect((onCleanup) => {
      const userId = this.userId();

      this.themeService.setTheme('light');

      if (!userId) {
        return;
      }

      const subscription = this.preferencesService.getOrCreatePreferences(userId).subscribe({
        next: (preferences) => {
          if (this.userId() !== userId) {
            return;
          }

          this.themeService.setTheme(preferences.theme === 'dark' ? 'dark' : 'light');
        },
      });

      onCleanup(() => subscription.unsubscribe());
    });

    effect((onCleanup) => {
      if (!this.isMobileMenuOpen()) {
        return;
      }

      const body = this.document.body;

      if (!body) {
        return;
      }

      const previousOverflow = body.style.overflow;
      body.style.overflow = 'hidden';

      onCleanup(() => {
        body.style.overflow = previousOverflow;
      });
    });

    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.closeMobileMenu());
  }

  @HostListener('document:keydown.escape')
  protected handleEscapeKey(): void {
    if (!this.isMobileMenuOpen()) {
      return;
    }

    this.closeMobileMenu();
    this.menuButton()?.nativeElement.focus();
  }

  protected toggleMobileMenu(): void {
    this.isMobileMenuOpen.update((isOpen) => !isOpen);
  }

  protected closeMobileMenu(): void {
    this.isMobileMenuOpen.set(false);
  }
}