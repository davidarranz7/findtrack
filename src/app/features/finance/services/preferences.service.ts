import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable, switchMap } from 'rxjs';

import { UserPreferences } from '../settings/user-preferences';

type CreateUserPreferencesPayload = Omit<UserPreferences, 'id'>;
type UpdateUserPreferencesPayload = Omit<UserPreferences, 'id' | 'userId'>;

@Injectable({
  providedIn: 'root',
})
export class PreferencesService {
  private readonly http = inject(HttpClient);

  private readonly apiUrl = 'http://localhost:3000/preferences';

  getPreferences(userId: string): Observable<UserPreferences | null> {
    return this.http
      .get<UserPreferences[]>(this.apiUrl, {
        params: {
          userId,
        },
      })
      .pipe(map((preferences) => preferences.at(0) ?? null));
  }

  getOrCreatePreferences(userId: string): Observable<UserPreferences> {
    return this.getPreferences(userId).pipe(
      switchMap((preferences) => {
        if (preferences) {
          return [preferences];
        }

        return this.createPreferences({
          userId,
          ...this.getDefaultPreferences(),
        });
      }),
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

  private getDefaultPreferences(): UpdateUserPreferencesPayload {
    return {
      currency: 'EUR',
      locale: 'es-ES',
      dateFormat: 'DD/MM/YYYY',
      theme: 'system',
      budgetWarningEnabled: true,
      budgetExceededEnabled: true,
      savingsGoalEnabled: true,
    };
  }
}
