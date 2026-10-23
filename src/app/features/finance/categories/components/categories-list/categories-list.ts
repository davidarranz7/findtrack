import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';

import { Category } from '../../../models';
import { CategoriesStateService } from '../../services/categories-state';
import { getCategoryIconClass } from '../../utils/category-icon.utils';

@Component({
  selector: 'app-categories-list',
  templateUrl: './categories-list.html',
  styleUrl: './categories-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoriesList {
  protected readonly state = inject(CategoriesStateService);

  readonly deletingCategoryId = input<string | null>(null);

  readonly createRequested = output<void>();
  readonly editRequested = output<Category>();
  readonly deleteRequested = output<Category>();

  protected readonly getCategoryIconClass = getCategoryIconClass;
}
