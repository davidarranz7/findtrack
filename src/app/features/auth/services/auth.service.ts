import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { map, Observable, switchMap, throwError } from 'rxjs';

import { User } from '../models/user';

type AuthenticatedUser = Omit<User, 'password'>;
type RegisterUser = Omit<User, 'id'>;

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:3000/users';

  private readonly currentUserState = signal<AuthenticatedUser | null>(null);

  readonly currentUser = this.currentUserState.asReadonly();

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

  setCurrentUser(user: AuthenticatedUser): void {
    this.currentUserState.set(user);
  }

  clearCurrentUser(): void {
    this.currentUserState.set(null);
  }
}
