import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable, switchMap, tap, throwError } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { User } from '../models/user';
import { AuthenticatedUser, AuthSessionService } from './auth-session';

type RegisterUser = Omit<User, 'id'>;
type UpdateProfilePayload = Pick<User, 'username' | 'email'>;

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly authSession = inject(AuthSessionService);

  private readonly apiUrl = `${environment.apiUrl}/users`;

  readonly currentUser = this.authSession.currentUser;
  readonly rememberedAccount = this.authSession.rememberedAccount;
  readonly isAuthenticated = this.authSession.isAuthenticated;

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
        this.authSession.setCurrentUser(user);

        if (rememberMe) {
          this.authSession.rememberAccount(user);
        } else {
          this.authSession.clearRememberedAccount();
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
        this.authSession.setCurrentUser(updatedUser);

        if (this.rememberedAccount()?.id === updatedUser.id) {
          this.authSession.rememberAccount(updatedUser);
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
    this.authSession.setCurrentUser(user);
  }

  clearCurrentUser(): void {
    this.authSession.clearCurrentUser();
  }

  clearRememberedAccount(): void {
    this.authSession.clearRememberedAccount();
  }

  private toAuthenticatedUser(user: User): AuthenticatedUser {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
    };
  }
}
