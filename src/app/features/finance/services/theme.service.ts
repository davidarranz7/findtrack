import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { computed, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';

export type Theme = 'light' | 'dark';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);

  private readonly activeTheme = signal<Theme>('light');

  readonly theme = this.activeTheme.asReadonly();
  readonly isDark = computed(() => this.theme() === 'dark');

  setTheme(theme: Theme): void {
    this.activeTheme.set(theme);

    if (isPlatformBrowser(this.platformId)) {
      this.document.documentElement.setAttribute('data-bs-theme', theme);
    }
  }

  toggleTheme(): void {
    this.setTheme(this.isDark() ? 'light' : 'dark');
  }
}
