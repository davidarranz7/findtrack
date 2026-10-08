import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { map, Observable, switchMap, tap, throwError } from 'rxjs';

import { User } from '../models/user';

type AuthenticatedUser = Omit<User, 'password'>;
type RegisterUser = Omit<User, 'id'>;
type UpdateProfilePayload = Pick<User, 'username' | 'email'>;

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

  checkUsernameAvailability(username: string, excludeUserId?: string): Observable<boolean> {
    const normalizedUsername = username.trim().toLowerCase();

    return this.http
      .get<User[]>(this.apiUrl)
      .pipe(
        map(
          (users) =>
            !users.some(
              (user) =>
                user.id !== excludeUserId && user.username.toLowerCase() === normalizedUsername,
            ),
        ),
      );
  }

  checkEmailAvailability(email: string, excludeUserId?: string): Observable<boolean> {
    const normalizedEmail = email.trim().toLowerCase();

    return this.http
      .get<User[]>(this.apiUrl)
      .pipe(
        map(
          (users) =>
            !users.some(
              (user) => user.id !== excludeUserId && user.email.toLowerCase() === normalizedEmail,
            ),
        ),
      );
  }

  register(user: RegisterUser): Observable<AuthenticatedUser> {
    return this.http.get<User[]>(this.apiUrl).pipe(
      switchMap((users) => {
        const normalizedUsername = user.username.trim();
        const normalizedEmail = user.email.trim().toLowerCase();

        const usernameExists = users.some(
          (currentUser) => currentUser.username.toLowerCase() === normalizedUsername.toLowerCase(),
        );

        if (usernameExists) {
          return throwError(() => new Error('USERNAME_ALREADY_EXISTS'));
        }

        const emailExists = users.some(
          (currentUser) => currentUser.email.toLowerCase() === normalizedEmail,
        );

        if (emailExists) {
          return throwError(() => new Error('EMAIL_ALREADY_EXISTS'));
        }

        return this.http.post<User>(this.apiUrl, {
          ...user,
          username: normalizedUsername,
          email: normalizedEmail,
        });
      }),
      map((createdUser) => this.toAuthenticatedUser(createdUser)),
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

        return this.toAuthenticatedUser(user);
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

  updateProfile(userId: string, profile: UpdateProfilePayload): Observable<AuthenticatedUser> {
    const normalizedUsername = profile.username.trim();
    const normalizedEmail = profile.email.trim().toLowerCase();

    return this.http.get<User[]>(this.apiUrl).pipe(
      switchMap((users) => {
        const usernameExists = users.some(
          (user) =>
            user.id !== userId && user.username.toLowerCase() === normalizedUsername.toLowerCase(),
        );

        if (usernameExists) {
          return throwError(() => new Error('USERNAME_ALREADY_EXISTS'));
        }

        const emailExists = users.some(
          (user) => user.id !== userId && user.email.toLowerCase() === normalizedEmail,
        );

        if (emailExists) {
          return throwError(() => new Error('EMAIL_ALREADY_EXISTS'));
        }

        return this.http.patch<User>(`${this.apiUrl}/${userId}`, {
          username: normalizedUsername,
          email: normalizedEmail,
        });
      }),
      map((updatedUser) => this.toAuthenticatedUser(updatedUser)),
      tap((updatedUser) => {
        this.persistCurrentSession(updatedUser);

        if (this.rememberedAccount()?.id === updatedUser.id) {
          this.rememberAccount(updatedUser);
        }
      }),
    );
  }

  changePassword(userId: string, currentPassword: string, newPassword: string): Observable<void> {
    return this.http.get<User>(`${this.apiUrl}/${userId}`).pipe(
      switchMap((user) => {
        if (user.password !== currentPassword) {
          return throwError(() => new Error('INVALID_CURRENT_PASSWORD'));
        }

        return this.http.patch<User>(`${this.apiUrl}/${userId}`, {
          password: newPassword,
        });
      }),
      map(() => undefined),
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

  private toAuthenticatedUser(user: User): AuthenticatedUser {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
    };
  }
}
