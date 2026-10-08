import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

import { AuthService } from '../../features/auth/services/auth.service';

@Component({
  selector: 'app-header',
  imports: [],
  templateUrl: './header.html',
  styleUrl: './header.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Header {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly currentSection = signal(this.getSectionLabel(this.router.url));

  constructor() {
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((event) => {
        this.currentSection.set(this.getSectionLabel(event.urlAfterRedirects));
      });
  }

  protected logout(): void {
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
