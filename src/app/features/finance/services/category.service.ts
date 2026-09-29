import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';

import { Category } from '../models';

@Injectable({
  providedIn: 'root',
})
export class CategoryService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:3000/categories';

  getCategories(userId: string): Observable<Category[]> {
    return this.http
      .get<Category[]>(this.apiUrl)
      .pipe(
        map((categories) =>
          categories.filter((category) => category.userId === null || category.userId === userId),
        ),
      );
  }
}
