import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { Budget } from '../models';

type CreateBudgetPayload = Omit<Budget, 'id'>;

type UpdateBudgetPayload = Pick<Budget, 'amount'>;

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

  getBudgetsByUser(userId: string): Observable<Budget[]> {
    return this.http.get<Budget[]>(this.apiUrl, {
      params: {
        userId,
      },
    });
  }

  createBudget(budget: CreateBudgetPayload): Observable<Budget> {
    return this.http.post<Budget>(this.apiUrl, budget);
  }

  updateBudget(budgetId: string, budget: UpdateBudgetPayload): Observable<Budget> {
    return this.http.patch<Budget>(`${this.apiUrl}/${budgetId}`, budget);
  }

  deleteBudget(budgetId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${budgetId}`);
  }
}
