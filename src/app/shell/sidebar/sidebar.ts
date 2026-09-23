import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AppBrand } from '../../shared/ui/app-brand/app-brand';

interface NavigationItem {
  label: string;
  route: string;
  icon: string;
}

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive, AppBrand],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Sidebar {
  protected readonly navigationItems: NavigationItem[] = [
    {
      label: 'Resumen',
      icon: 'bi-grid',
      route: '/dashboard',
    },
    {
      label: 'Transacciones',
      icon: 'bi-receipt',
      route: '/transactions',
    },
    {
      label: 'Presupuestos',
      icon: 'bi-wallet2',
      route: '/budgets',
    },
    {
      label: 'Categorías y Etiquetas',
      icon: 'bi-tag',
      route: '/categories',
    },
    {
      label: 'Informes y Estadísticas',
      icon: 'bi-bar-chart',
      route: '/reports',
    },
    {
      label: 'Configuración',
      icon: 'bi-gear',
      route: '/settings',
    },
  ];
}
