import { Routes } from '@angular/router';

import { authGuard } from './features/auth/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadChildren: () => import('./features/auth/auth.routes').then((routes) => routes.AUTH_ROUTES),
  },
  {
    path: '',
    canActivate: [authGuard],
    canActivateChild: [authGuard],
    loadComponent: () =>
      import('./shell/app-shell/app-shell').then((component) => component.AppShell),
    children: [
      {
        path: '',
        loadChildren: () =>
          import('./features/finance/finance.routes').then((routes) => routes.FINANCE_ROUTES),
      },
    ],
  },
];
