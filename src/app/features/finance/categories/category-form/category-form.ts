import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { Category } from '../../models';

export interface CategoryFormValue {
  name: string;
  icon: string;
  color: string;
}

@Component({
  selector: 'app-category-form',
  imports: [ReactiveFormsModule],
  templateUrl: './category-form.html',
  styleUrl: './category-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoryForm {
  private readonly formBuilder = inject(FormBuilder);

  readonly category = input<Category | null>(null);

  readonly isSaving = input(false);
  readonly errorMessage = input<string | null>(null);

  readonly submitted = output<CategoryFormValue>();
  readonly cancelled = output<void>();

  protected readonly isEditMode = computed(() => this.category() !== null);

  protected readonly iconOptions = [
    'bi-tag',
    'bi-basket',
    'bi-cart',
    'bi-house',
    'bi-car-front',
    'bi-bus-front',
    'bi-heart-pulse',
    'bi-controller',
    'bi-airplane',
    'bi-cup-hot',
    'bi-briefcase',
    'bi-cash-stack',
  ];

  protected readonly colorOptions = [
    '#2563eb',
    '#16a34a',
    '#dc2626',
    '#f59e0b',
    '#7c3aed',
    '#0891b2',
    '#db2777',
    '#475569',
  ];

  protected readonly categoryForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(40)]],
    icon: ['bi-tag', Validators.required],
    color: ['#2563eb', Validators.required],
  });

  constructor() {
    effect(() => {
      const category = this.category();

      if (category) {
        this.categoryForm.reset({
          name: category.name,
          icon: category.icon,
          color: category.color,
        });

        return;
      }

      this.reset();
    });
  }

  public reset(): void {
    this.categoryForm.reset({
      name: '',
      icon: 'bi-tag',
      color: '#2563eb',
    });
  }

  protected selectIcon(icon: string): void {
    this.categoryForm.controls.icon.setValue(icon);
  }

  protected selectColor(color: string): void {
    this.categoryForm.controls.color.setValue(color);
  }

  protected cancel(): void {
    if (this.isSaving()) {
      return;
    }

    this.cancelled.emit();
  }

  protected submit(): void {
    if (this.isSaving()) {
      return;
    }

    const name = this.categoryForm.controls.name.value.trim();

    if (!name) {
      this.categoryForm.controls.name.setErrors({
        required: true,
      });

      this.categoryForm.controls.name.markAsTouched();

      return;
    }

    if (this.categoryForm.invalid) {
      this.categoryForm.markAllAsTouched();

      return;
    }

    this.submitted.emit({
      ...this.categoryForm.getRawValue(),
      name,
    });
  }
}
