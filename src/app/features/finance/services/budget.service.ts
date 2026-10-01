import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { Budget } from '../models';

@Injectable({
  providedIn: 'root',
})
export class BudgetService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:3000/budgets';

  getBudgets(userId: string, month: string): Observable<Budget[]> {
    return this.http.get<Budget[]>(this.apiUrl, {
      params: {
        userId,
        month,
      },
    });
  }
}
