import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadChildren: () => import('./features/auth/auth.routes').then((routes) => routes.AUTH_ROUTES),
  },
  {
    path: '',
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
