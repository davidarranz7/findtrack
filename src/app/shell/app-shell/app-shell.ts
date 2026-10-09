import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';

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

  private readonly userId = computed(() => this.authService.currentUser()?.id ?? null);

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
  }
}
