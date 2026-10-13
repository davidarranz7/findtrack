import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  defer,
  finalize,
  firstValueFrom,
  from,
  map,
  Observable,
  of,
  shareReplay,
  switchMap,
} from 'rxjs';

import { environment } from '../../../../environments/environment';
import { UserPreferences } from '../settings/user-preferences';

type CreateUserPreferencesPayload = Omit<UserPreferences, 'id'>;

type UpdateUserPreferencesPayload = Partial<Omit<UserPreferences, 'id' | 'userId'>>;

@Injectable({
  providedIn: 'root',
})
export class PreferencesService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/preferences`;

  private readonly pendingPreferences = new Map<string, Observable<UserPreferences>>();

  getPreferences(userId: string): Observable<UserPreferences | null> {
    return this.http
      .get<UserPreferences[]>(this.apiUrl, {
        params: { userId },
      })
      .pipe(map((preferences) => preferences.at(0) ?? null));
  }

  getOrCreatePreferences(userId: string): Observable<UserPreferences> {
    const pendingRequest = this.pendingPreferences.get(userId);

    if (pendingRequest) {
      return pendingRequest;
    }

    const request$: Observable<UserPreferences> = defer(() => {
      if (typeof navigator !== 'undefined' && 'locks' in navigator) {
        return from(this.getOrCreateWithLock(userId));
      }

      return this.fetchOrCreatePreferences(userId);
    }).pipe(
      finalize(() => {
        this.pendingPreferences.delete(userId);
      }),
      shareReplay({
        bufferSize: 1,
        refCount: true,
      }),
    );

    this.pendingPreferences.set(userId, request$);

    return request$;
  }

  private async getOrCreateWithLock(userId: string): Promise<UserPreferences> {
    return navigator.locks.request(
      `finora:preferences:${userId}`,
      async (): Promise<UserPreferences> => {
        return firstValueFrom(this.fetchOrCreatePreferences(userId));
      },
    );
  }

  private fetchOrCreatePreferences(userId: string): Observable<UserPreferences> {
    return this.getPreferences(userId).pipe(
      switchMap((preferences) =>
        preferences
          ? of(preferences)
          : this.createPreferences({
              userId,
              ...this.getDefaultPreferences(),
            }),
      ),
    );
  }

  updatePreferences(
    preferencesId: string,
    preferences: UpdateUserPreferencesPayload,
  ): Observable<UserPreferences> {
    return this.http.patch<UserPreferences>(`${this.apiUrl}/${preferencesId}`, preferences);
  }

  private createPreferences(
    preferences: CreateUserPreferencesPayload,
  ): Observable<UserPreferences> {
    return this.http.post<UserPreferences>(this.apiUrl, preferences);
  }

  private getDefaultPreferences(): Omit<UserPreferences, 'id' | 'userId'> {
    return {
      currency: 'EUR',
      locale: 'es-ES',
      dateFormat: 'DD/MM/YYYY',
      theme: 'light',
      budgetWarningEnabled: true,
      budgetExceededEnabled: true,
      savingsGoalEnabled: true,
    };
  }
}
