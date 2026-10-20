import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { CategoriesStateService } from '../services/categories-state';

@Component({
  selector: 'app-categories-summary',
  templateUrl: './categories-summary.html',
  styleUrl: './categories-summary.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoriesSummary {
  protected readonly state = inject(CategoriesStateService);
}
