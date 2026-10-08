import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, Subject, tap } from 'rxjs';

import { Transaction } from '../models';

type CreateTransactionPayload = Omit<Transaction, 'id'>;

type UpdateTransactionPayload = Partial<CreateTransactionPayload>;

@Injectable({
  providedIn: 'root',
})
export class TransactionService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:3000/transactions';

  private readonly transactionsChangedSubject = new Subject<void>();

  readonly transactionsChanged$ = this.transactionsChangedSubject.asObservable();

  getTransactions(userId: string): Observable<Transaction[]> {
    return this.http.get<Transaction[]>(this.apiUrl, {
      params: {
        userId,
      },
    });
  }

  createTransaction(transaction: CreateTransactionPayload): Observable<Transaction> {
    return this.http
      .post<Transaction>(this.apiUrl, transaction)
      .pipe(tap(() => this.notifyTransactionsChanged()));
  }

  updateTransaction(
    transactionId: string,
    transaction: UpdateTransactionPayload,
  ): Observable<Transaction> {
    return this.http
      .patch<Transaction>(`${this.apiUrl}/${transactionId}`, transaction)
      .pipe(tap(() => this.notifyTransactionsChanged()));
  }

  deleteTransaction(transactionId: string): Observable<void> {
    return this.http
      .delete<void>(`${this.apiUrl}/${transactionId}`)
      .pipe(tap(() => this.notifyTransactionsChanged()));
  }

  private notifyTransactionsChanged(): void {
    this.transactionsChangedSubject.next();
  }
}
