import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { Transaction } from '../models';

@Injectable({
  providedIn: 'root',
})
export class TransactionService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:3000/transactions';

  getTransactions(userId: string): Observable<Transaction[]> {
    return this.http.get<Transaction[]>(this.apiUrl, {
      params: { userId },
    });
  }
}
