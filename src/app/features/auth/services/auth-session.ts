import { isPlatformBrowser } from '@angular/common';
import { computed, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';

import { User } from '../models/user';

export type AuthenticatedUser = Omit<User, 'password'>;

@Injectable({
  providedIn: 'root',
})
export class AuthSessionService {
  private readonly platformId = inject(PLATFORM_ID);

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

  setCurrentUser(user: AuthenticatedUser): void {
    this.currentUserState.set(user);

    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    sessionStorage.setItem(this.sessionStorageKey, JSON.stringify(user));
  }

  clearCurrentUser(): void {
    this.currentUserState.set(null);

    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    sessionStorage.removeItem(this.sessionStorageKey);
  }

  rememberAccount(user: AuthenticatedUser): void {
    this.rememberedAccountState.set(user);

    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    localStorage.setItem(this.rememberedAccountStorageKey, JSON.stringify(user));
  }

  clearRememberedAccount(): void {
    this.rememberedAccountState.set(null);

    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    localStorage.removeItem(this.rememberedAccountStorageKey);
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
