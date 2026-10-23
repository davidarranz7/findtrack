import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, Observable } from 'rxjs';

import { ConfirmDialog } from '../../../shared/ui/confirm-dialog/confirm-dialog';
import { PageHeader } from '../../../shared/ui/page-header/page-header';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { Category } from '../models';
import { CategoryForm, CategoryFormValue } from './components/category-form/category-form';
import { CategoriesList } from './components/categories-list/categories-list';
import { CategoriesSummary } from './components/categories-summary/categories-summary';
import { CategoryDeletionService } from './services/category-deletion';
import { CategoriesStateService } from './services/categories-state';
import { getCategoryIconClass } from './utils/category-icon.utils';

@Component({
  selector: 'app-categories',
  imports: [PageHeader, CategoryForm, CategoriesSummary, CategoriesList, ConfirmDialog],
  providers: [CategoriesStateService, CategoryDeletionService],
  templateUrl: './categories.html',
  styleUrl: './categories.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Categories {
  protected readonly state = inject(CategoriesStateService);
  private readonly deletionService = inject(CategoryDeletionService);
  private readonly toastService = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly getCategoryIconClass = getCategoryIconClass;

  protected readonly isCategoryFormOpen = signal(false);
  protected readonly categoryToEdit = signal<Category | null>(null);
  protected readonly categoryToDelete = signal<Category | null>(null);

  protected readonly isSavingCategory = signal(false);
  protected readonly deletingCategoryId = signal<string | null>(null);

  protected readonly categoryFormError = signal<string | null>(null);
  protected readonly deleteError = signal<string | null>(null);

  protected readonly isEditingCategory = computed(() => this.categoryToEdit() !== null);

  protected readonly affectedTransactions = computed(() => {
    const category = this.categoryToDelete();

    return category ? this.deletionService.getAffectedTransactions(category) : [];
  });

  protected openCategoryForm(): void {
    this.categoryToEdit.set(null);
    this.categoryFormError.set(null);
    this.isCategoryFormOpen.set(true);
  }

  protected openEditCategory(category: Category): void {
    this.categoryToEdit.set(category);
    this.categoryFormError.set(null);
    this.isCategoryFormOpen.set(true);
  }

  protected closeCategoryForm(): void {
    if (this.isSavingCategory()) {
      return;
    }

    this.categoryToEdit.set(null);
    this.categoryFormError.set(null);
    this.isCategoryFormOpen.set(false);
  }

  protected saveCategory(formValue: CategoryFormValue): void {
    if (this.isSavingCategory()) {
      return;
    }

    const userId = this.state.currentUserId();

    if (!userId) {
      this.categoryFormError.set('No se ha podido identificar al usuario actual.');
      return;
    }

    const categoryToEdit = this.categoryToEdit();
    const normalizedName = formValue.name.trim();

    if (this.state.hasDuplicateName(normalizedName, categoryToEdit?.id)) {
      this.categoryFormError.set('Ya existe una categoría con ese nombre.');
      return;
    }

    if (categoryToEdit && categoryToEdit.userId !== userId) {
      this.categoryFormError.set('No puedes editar esta categoría.');
      return;
    }

    const values = {
      name: normalizedName,
      icon: formValue.icon,
      color: formValue.color,
    };

    const request = categoryToEdit
      ? this.state.updateCategory(categoryToEdit.id, values)
      : this.state.createCategory(userId, values);

    this.submitCategory(request, categoryToEdit !== null);
  }

  protected requestDeleteCategory(category: Category): void {
    if (this.deletingCategoryId()) {
      return;
    }

    const block = this.deletionService.getDeletionBlock(category);

    if (block) {
      this.toastService[block.notification](block.message);
      return;
    }

    this.deleteError.set(null);
    this.categoryToDelete.set(category);
  }

  protected cancelDeleteCategory(): void {
    if (this.deletingCategoryId()) {
      return;
    }

    this.categoryToDelete.set(null);
    this.deleteError.set(null);
  }

  protected confirmDeleteCategory(): void {
    const category = this.categoryToDelete();

    if (!category || this.deletingCategoryId()) {
      return;
    }

    const block = this.deletionService.getDeletionBlock(category);

    if (block) {
      this.deleteError.set(block.message);
      return;
    }

    this.deletingCategoryId.set(category.id);
    this.deleteError.set(null);

    this.deletionService
      .deleteCategory(category)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.deletingCategoryId.set(null)),
      )
      .subscribe({
        next: () => {
          this.categoryToDelete.set(null);
          this.deleteError.set(null);
          this.toastService.success('Categoría eliminada correctamente.');
        },
        error: () => {
          this.deleteError.set(
            'No se ha podido completar la eliminación. Se volverán a cargar los datos para mantenerlos sincronizados.',
          );
        },
      });
  }

  private submitCategory(request: Observable<Category>, isEditMode: boolean): void {
    this.isSavingCategory.set(true);
    this.categoryFormError.set(null);

    request
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isSavingCategory.set(false)),
      )
      .subscribe({
        next: () => {
          this.categoryToEdit.set(null);
          this.isCategoryFormOpen.set(false);

          this.toastService.success(
            isEditMode ? 'Categoría actualizada correctamente.' : 'Categoría creada correctamente.',
          );
        },
        error: () => {
          this.categoryFormError.set(
            isEditMode
              ? 'No se ha podido actualizar la categoría. Inténtalo de nuevo.'
              : 'No se ha podido crear la categoría. Inténtalo de nuevo.',
          );
        },
      });
  }
}
