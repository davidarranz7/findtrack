import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { map, Observable, switchMap, tap, throwError } from 'rxjs';

import { User } from '../models/user';

type AuthenticatedUser = Omit<User, 'password'>;
type RegisterUser = Omit<User, 'id'>;

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);

  private readonly apiUrl = 'http://localhost:3000/users';

  private readonly sessionStorageKey = 'finora-auth-session';
  private readonly rememberedAccountStorageKey = 'finora-remembered-account';

  private readonly currentUserState = signal<AuthenticatedUser | null>(
    this.restoreCurrentSession(),
  );

  private readonly rememberedAccountState = signal<AuthenticatedUser | null>(
    this.restoreRememberedAccount(),
  );

  readonly currentUser = this.currentUserState.asReadonly();

  readonly rememberedAccount = this.rememberedAccountState.asReadonly();

  readonly isAuthenticated = computed(() => this.currentUser() !== null);

  checkUsernameAvailability(username: string): Observable<boolean> {
    const normalizedUsername = username.trim().toLowerCase();

    return this.http
      .get<User[]>(this.apiUrl)
      .pipe(
        map((users) => !users.some((user) => user.username.toLowerCase() === normalizedUsername)),
      );
  }

  checkEmailAvailability(email: string): Observable<boolean> {
    const normalizedEmail = email.trim().toLowerCase();

    return this.http
      .get<User[]>(this.apiUrl)
      .pipe(map((users) => !users.some((user) => user.email.toLowerCase() === normalizedEmail)));
  }

  register(user: RegisterUser): Observable<AuthenticatedUser> {
    return this.http.get<User[]>(this.apiUrl).pipe(
      switchMap((users) => {
        const usernameExists = users.some(
          (currentUser) =>
            currentUser.username.toLowerCase() === user.username.trim().toLowerCase(),
        );

        if (usernameExists) {
          return throwError(() => new Error('USERNAME_ALREADY_EXISTS'));
        }

        const emailExists = users.some(
          (currentUser) => currentUser.email.toLowerCase() === user.email.trim().toLowerCase(),
        );

        if (emailExists) {
          return throwError(() => new Error('EMAIL_ALREADY_EXISTS'));
        }

        return this.http.post<User>(this.apiUrl, {
          ...user,
          username: user.username.trim(),
          email: user.email.trim().toLowerCase(),
        });
      }),
      map((createdUser) => ({
        id: createdUser.id,
        username: createdUser.username,
        email: createdUser.email,
      })),
    );
  }

  login(identifier: string, password: string, rememberMe = false): Observable<AuthenticatedUser> {
    const normalizedIdentifier = identifier.trim().toLowerCase();

    return this.http.get<User[]>(this.apiUrl).pipe(
      map((users) => {
        const user = users.find(
          (currentUser) =>
            (currentUser.username.toLowerCase() === normalizedIdentifier ||
              currentUser.email.toLowerCase() === normalizedIdentifier) &&
            currentUser.password === password,
        );

        if (!user) {
          throw new Error('INVALID_CREDENTIALS');
        }

        return {
          id: user.id,
          username: user.username,
          email: user.email,
        };
      }),
      tap((user) => {
        this.persistCurrentSession(user);

        if (rememberMe) {
          this.rememberAccount(user);
        } else {
          this.clearRememberedAccount();
        }
      }),
    );
  }

  setCurrentUser(user: AuthenticatedUser): void {
    this.persistCurrentSession(user);
  }

  clearCurrentUser(): void {
    this.currentUserState.set(null);

    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    sessionStorage.removeItem(this.sessionStorageKey);
  }

  clearRememberedAccount(): void {
    this.rememberedAccountState.set(null);

    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    localStorage.removeItem(this.rememberedAccountStorageKey);
  }

  private persistCurrentSession(user: AuthenticatedUser): void {
    this.currentUserState.set(user);

    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    sessionStorage.setItem(this.sessionStorageKey, JSON.stringify(user));
  }

  private rememberAccount(user: AuthenticatedUser): void {
    this.rememberedAccountState.set(user);

    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    localStorage.setItem(this.rememberedAccountStorageKey, JSON.stringify(user));
  }

  private restoreCurrentSession(): AuthenticatedUser | null {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }

    return this.readStoredUser(sessionStorage.getItem(this.sessionStorageKey));
  }

  private restoreRememberedAccount(): AuthenticatedUser | null {
    if (!isPlatformBrowser(this.platformId)) {
      return null;
    }

    return this.readStoredUser(localStorage.getItem(this.rememberedAccountStorageKey));
  }

  private readStoredUser(storedUser: string | null): AuthenticatedUser | null {
    if (!storedUser) {
      return null;
    }

    try {
      const user = JSON.parse(storedUser) as Partial<AuthenticatedUser>;

      if (
        typeof user.id !== 'string' ||
        typeof user.username !== 'string' ||
        typeof user.email !== 'string'
      ) {
        return null;
      }

      return {
        id: user.id,
        username: user.username,
        email: user.email,
      };
    } catch {
      return null;
    }
  }
}
