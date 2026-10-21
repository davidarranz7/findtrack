import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { environment } from '../../../../environments/environment';
import { User } from '../models/user';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let httpTesting: HttpTestingController;

  const usersUrl = `${environment.apiUrl}/users`;

  const user: User = {
    id: 'user-1',
    username: 'demo',
    email: 'demo@finora.app',
    password: 'Demo123!',
  };

  const publicUser = {
    id: user.id,
    username: user.username,
    email: user.email,
  };

  const respondWithUsers = (users: User[] = [user]): void => {
    const request = httpTesting.expectOne(usersUrl);
    expect(request.request.method).toBe('GET');
    request.flush(users);
  };

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(AuthService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
    sessionStorage.clear();
    localStorage.clear();
  });

  it('should create with no authenticated user', () => {
    expect(service).toBeTruthy();
    expect(service.currentUser()).toBeNull();
    expect(service.isAuthenticated()).toBe(false);
  });

  it('should set and clear the current user', () => {
    service.setCurrentUser(publicUser);

    expect(service.currentUser()).toEqual(publicUser);
    expect(service.isAuthenticated()).toBe(true);

    service.clearCurrentUser();

    expect(service.currentUser()).toBeNull();
    expect(service.isAuthenticated()).toBe(false);
  });

  it('should register a new user without exposing the password', () => {
    const next = vi.fn();

    service
      .register({
        username: ' newuser ',
        email: ' NEW@FINORA.APP ',
        password: 'Password1!',
      })
      .subscribe(next);

    respondWithUsers([]);

    const request = httpTesting.expectOne(usersUrl);

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      username: 'newuser',
      email: 'new@finora.app',
      password: 'Password1!',
    });

    request.flush({
      ...user,
      id: 'user-2',
      username: 'newuser',
      email: 'new@finora.app',
    });

    expect(next).toHaveBeenCalledWith({
      id: 'user-2',
      username: 'newuser',
      email: 'new@finora.app',
    });
  });

  it('should reject an existing username during registration', () => {
    const error = vi.fn();

    service
      .register({
        username: 'DEMO',
        email: 'new@finora.app',
        password: 'Password1!',
      })
      .subscribe({ error });

    respondWithUsers();

    expect(error.mock.calls[0][0].message).toBe('USERNAME_ALREADY_EXISTS');
  });

  it('should reject an existing email during registration', () => {
    const error = vi.fn();

    service
      .register({
        username: 'newuser',
        email: ' DEMO@FINORA.APP ',
        password: 'Password1!',
      })
      .subscribe({ error });

    respondWithUsers();

    expect(error.mock.calls[0][0].message).toBe('EMAIL_ALREADY_EXISTS');
  });

  it('should login with username and update the session', () => {
    const next = vi.fn();

    service.login(' DEMO ', user.password).subscribe(next);
    respondWithUsers();

    expect(next).toHaveBeenCalledWith(publicUser);
    expect(service.currentUser()).toEqual(publicUser);
    expect(service.isAuthenticated()).toBe(true);
  });

  it('should login with email', () => {
    const next = vi.fn();

    service.login('DEMO@FINORA.APP', user.password).subscribe(next);
    respondWithUsers();

    expect(next).toHaveBeenCalledWith(publicUser);
  });

  it('should reject invalid credentials without logging in', () => {
    const error = vi.fn();

    service.login('demo', 'incorrect').subscribe({ error });
    respondWithUsers();

    expect(error.mock.calls[0][0].message).toBe('INVALID_CREDENTIALS');
    expect(service.currentUser()).toBeNull();
  });

  it('should remember the account only when requested', () => {
    service.login('demo', user.password, true).subscribe();
    respondWithUsers();

    expect(service.rememberedAccount()).toEqual(publicUser);
    expect(JSON.parse(localStorage.getItem('finora-remembered-account')!)).toEqual(publicUser);

    service.login('demo', user.password, false).subscribe();
    respondWithUsers();

    expect(service.rememberedAccount()).toBeNull();
  });

  it('should check username availability ignoring case and excluding the current user', () => {
    const available = vi.fn();

    service.checkUsernameAvailability(' DEMO ').subscribe(available);
    respondWithUsers();

    expect(available).toHaveBeenCalledWith(false);

    service.checkUsernameAvailability(' DEMO ', user.id).subscribe(available);
    respondWithUsers();

    expect(available).toHaveBeenLastCalledWith(true);
  });

  it('should check email availability ignoring case and excluding the current user', () => {
    const available = vi.fn();

    service.checkEmailAvailability(' DEMO@FINORA.APP ').subscribe(available);
    respondWithUsers();

    expect(available).toHaveBeenCalledWith(false);

    service.checkEmailAvailability(' DEMO@FINORA.APP ', user.id).subscribe(available);
    respondWithUsers();

    expect(available).toHaveBeenLastCalledWith(true);
  });

  it('should update the profile and synchronize the session', () => {
    const next = vi.fn();

    service.setCurrentUser(publicUser);

    service
      .updateProfile(user.id, {
        username: ' newname ',
        email: ' NEW@FINORA.APP ',
      })
      .subscribe(next);

    respondWithUsers();

    const request = httpTesting.expectOne(`${usersUrl}/${user.id}`);

    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({
      username: 'newname',
      email: 'new@finora.app',
    });

    request.flush({
      ...user,
      username: 'newname',
      email: 'new@finora.app',
    });

    const updatedUser = {
      ...publicUser,
      username: 'newname',
      email: 'new@finora.app',
    };

    expect(next).toHaveBeenCalledWith(updatedUser);
    expect(service.currentUser()).toEqual(updatedUser);
  });

  it('should synchronize the remembered account after a profile update', () => {
    service.login(user.username, user.password, true).subscribe();
    respondWithUsers();

    service
      .updateProfile(user.id, {
        username: 'newname',
        email: user.email,
      })
      .subscribe();

    respondWithUsers();

    httpTesting.expectOne(`${usersUrl}/${user.id}`).flush({
      ...user,
      username: 'newname',
    });

    expect(service.rememberedAccount()?.username).toBe('newname');
  });

  it('should reject duplicate usernames during profile updates', () => {
    const error = vi.fn();

    service
      .updateProfile(user.id, {
        username: 'taken',
        email: user.email,
      })
      .subscribe({ error });

    respondWithUsers([
      user,
      {
        ...user,
        id: 'user-2',
        username: 'taken',
      },
    ]);

    expect(error.mock.calls[0][0].message).toBe('USERNAME_ALREADY_EXISTS');
  });

  it('should reject duplicate emails during profile updates', () => {
    const error = vi.fn();

    service
      .updateProfile(user.id, {
        username: user.username,
        email: 'taken@finora.app',
      })
      .subscribe({ error });

    respondWithUsers([
      user,
      {
        ...user,
        id: 'user-2',
        username: 'another',
        email: 'taken@finora.app',
      },
    ]);

    expect(error.mock.calls[0][0].message).toBe('EMAIL_ALREADY_EXISTS');
  });

  it('should change the password after validating the current password', () => {
    const next = vi.fn();

    service.changePassword(user.id, user.password, 'NewPassword123!').subscribe(next);

    const getRequest = httpTesting.expectOne(`${usersUrl}/${user.id}`);

    expect(getRequest.request.method).toBe('GET');
    getRequest.flush(user);

    const patchRequest = httpTesting.expectOne(`${usersUrl}/${user.id}`);

    expect(patchRequest.request.method).toBe('PATCH');
    expect(patchRequest.request.body).toEqual({
      password: 'NewPassword123!',
    });

    patchRequest.flush({
      ...user,
      password: 'NewPassword123!',
    });

    expect(next).toHaveBeenCalledWith(undefined);
  });

  it('should reject an incorrect current password', () => {
    const error = vi.fn();

    service.changePassword(user.id, 'incorrect', 'NewPassword123!').subscribe({ error });

    const request = httpTesting.expectOne(`${usersUrl}/${user.id}`);

    expect(request.request.method).toBe('GET');
    request.flush(user);

    expect(error.mock.calls[0][0].message).toBe('INVALID_CURRENT_PASSWORD');
  });
});
