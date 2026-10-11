import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { Category } from '../models';

type CreateCategoryPayload = Omit<Category, 'id'>;
type UpdateCategoryPayload = Pick<Category, 'name' | 'icon' | 'color'>;

@Injectable({
  providedIn: 'root',
})
export class CategoryService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/categories`;

  getCategories(userId: string): Observable<Category[]> {
    return this.http.get<Category[]>(this.apiUrl, {
      params: {
        userId,
      },
    });
  }

  createCategory(category: CreateCategoryPayload): Observable<Category> {
    return this.http.post<Category>(this.apiUrl, category);
  }

  updateCategory(categoryId: string, category: UpdateCategoryPayload): Observable<Category> {
    return this.http.patch<Category>(`${this.apiUrl}/${categoryId}`, category);
  }

  deleteCategory(categoryId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${categoryId}`);
  }
}
