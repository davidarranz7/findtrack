import { Category } from '../../models';

export function getCategoryIconClass(category: Category): string {
  if (category.icon.startsWith('bi ')) {
    return category.icon;
  }

  if (category.icon.startsWith('bi-')) {
    return `bi ${category.icon}`;
  }

  return 'bi bi-tag';
}
