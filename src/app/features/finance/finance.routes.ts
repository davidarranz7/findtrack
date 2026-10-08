import { Routes } from '@angular/router';

export const FINANCE_ROUTES: Routes = [
  {
    path: 'overview',
    loadComponent: () => import('./overview/overview').then((component) => component.Overview),
  },
  {
    path: 'transactions',
    loadComponent: () =>
      import('./transactions/transactions').then((component) => component.Transactions),
  },
  {
    path: 'categories',
    loadComponent: () =>
      import('./categories/categories').then((component) => component.Categories),
  },
  {
    path: 'budgets',
    loadComponent: () => import('./budgets/budgets').then((component) => component.Budgets),
  },
];
