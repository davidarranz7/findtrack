import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AuthSessionService } from './auth-session';

describe('AuthSessionService', () => {
  const user = {
    id: 'user-1',
    username: 'david',
    email: 'david@finora.app',
  };

  const sessionKey = 'finora-auth-session';
  const rememberedKey = 'finora-remembered-account';

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();

    TestBed.configureTestingModule({});
  });

  afterEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('should start without an authenticated user', () => {
    const service = TestBed.inject(AuthSessionService);

    expect(service.currentUser()).toBeNull();
    expect(service.rememberedAccount()).toBeNull();
    expect(service.isAuthenticated()).toBe(false);
  });

  it('should store the authenticated user', () => {
    const service = TestBed.inject(AuthSessionService);

    service.setCurrentUser(user);

    expect(service.currentUser()).toEqual(user);
    expect(service.isAuthenticated()).toBe(true);
    expect(JSON.parse(sessionStorage.getItem(sessionKey)!)).toEqual(user);
  });

  it('should restore an existing session', () => {
    sessionStorage.setItem(sessionKey, JSON.stringify(user));

    const service = TestBed.inject(AuthSessionService);

    expect(service.currentUser()).toEqual(user);
    expect(service.isAuthenticated()).toBe(true);
  });

  it('should clear the current session', () => {
    const service = TestBed.inject(AuthSessionService);

    service.setCurrentUser(user);
    service.clearCurrentUser();

    expect(service.currentUser()).toBeNull();
    expect(service.isAuthenticated()).toBe(false);
    expect(sessionStorage.getItem(sessionKey)).toBeNull();
  });

  it('should store a remembered account', () => {
    const service = TestBed.inject(AuthSessionService);

    service.rememberAccount(user);

    expect(service.rememberedAccount()).toEqual(user);
    expect(JSON.parse(localStorage.getItem(rememberedKey)!)).toEqual(user);
  });

  it('should restore a remembered account', () => {
    localStorage.setItem(rememberedKey, JSON.stringify(user));

    const service = TestBed.inject(AuthSessionService);

    expect(service.rememberedAccount()).toEqual(user);
    expect(service.currentUser()).toBeNull();
  });

  it('should clear a remembered account', () => {
    const service = TestBed.inject(AuthSessionService);

    service.rememberAccount(user);
    service.clearRememberedAccount();

    expect(service.rememberedAccount()).toBeNull();
    expect(localStorage.getItem(rememberedKey)).toBeNull();
  });

  it('should keep the remembered account when logging out', () => {
    const service = TestBed.inject(AuthSessionService);

    service.setCurrentUser(user);
    service.rememberAccount(user);
    service.clearCurrentUser();

    expect(service.currentUser()).toBeNull();
    expect(service.rememberedAccount()).toEqual(user);
  });

  it('should reject malformed JSON', () => {
    sessionStorage.setItem(sessionKey, '{invalid-json');

    const service = TestBed.inject(AuthSessionService);

    expect(service.currentUser()).toBeNull();
  });

  it('should reject an incomplete stored user', () => {
    sessionStorage.setItem(sessionKey, JSON.stringify({ id: 'user-1', username: 'david' }));

    const service = TestBed.inject(AuthSessionService);

    expect(service.currentUser()).toBeNull();
  });

  it('should exclude password when restoring a session', () => {
    sessionStorage.setItem(sessionKey, JSON.stringify({ ...user, password: 'Secret123!' }));

    const service = TestBed.inject(AuthSessionService);

    expect(service.currentUser()).toEqual(user);
    expect(service.currentUser()).not.toHaveProperty('password');
  });

  it('should not access browser storage during SSR', () => {
    TestBed.overrideProvider(PLATFORM_ID, {
      useValue: 'server',
    });

    sessionStorage.setItem(sessionKey, JSON.stringify(user));

    const service = TestBed.inject(AuthSessionService);

    expect(service.currentUser()).toBeNull();

    service.setCurrentUser(user);
    service.rememberAccount(user);

    expect(service.currentUser()).toEqual(user);
    expect(service.rememberedAccount()).toEqual(user);
    expect(localStorage.getItem(rememberedKey)).toBeNull();

    service.clearCurrentUser();

    expect(sessionStorage.getItem(sessionKey)).toBe(JSON.stringify(user));
  });
});
