import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let httpTesting: HttpTestingController;

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
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should start without an authenticated user', () => {
    expect(service.currentUser()).toBeNull();
    expect(service.isAuthenticated()).toBe(false);
  });

  it('should set the current user', () => {
    service.setCurrentUser({
      id: 'user-1',
      username: 'demo',
      email: 'demo@finora.app',
    });

    expect(service.currentUser()).toEqual({
      id: 'user-1',
      username: 'demo',
      email: 'demo@finora.app',
    });

    expect(service.isAuthenticated()).toBe(true);
  });

  it('should clear the current user', () => {
    service.setCurrentUser({
      id: 'user-1',
      username: 'demo',
      email: 'demo@finora.app',
    });

    service.clearCurrentUser();

    expect(service.currentUser()).toBeNull();
    expect(service.isAuthenticated()).toBe(false);
  });

  it('should register a new user', () => {
    let result:
      | {
          id: string;
          username: string;
          email: string;
        }
      | undefined;

    service
      .register({
        username: 'david',
        email: 'david@finora.app',
        password: 'Password1!',
      })
      .subscribe((user) => {
        result = user;
      });

    const usersRequest = httpTesting.expectOne('http://localhost:3000/users');

    expect(usersRequest.request.method).toBe('GET');

    usersRequest.flush([]);

    const registerRequest = httpTesting.expectOne('http://localhost:3000/users');

    expect(registerRequest.request.method).toBe('POST');

    expect(registerRequest.request.body).toEqual({
      username: 'david',
      email: 'david@finora.app',
      password: 'Password1!',
    });

    registerRequest.flush({
      id: 'user-2',
      username: 'david',
      email: 'david@finora.app',
      password: 'Password1!',
    });

    expect(result).toEqual({
      id: 'user-2',
      username: 'david',
      email: 'david@finora.app',
    });
  });

  it('should reject registration when username already exists', () => {
    let receivedError: Error | undefined;

    service
      .register({
        username: 'demo',
        email: 'new@finora.app',
        password: 'Password1!',
      })
      .subscribe({
        error: (error: Error) => {
          receivedError = error;
        },
      });

    const usersRequest = httpTesting.expectOne('http://localhost:3000/users');

    expect(usersRequest.request.method).toBe('GET');

    usersRequest.flush([
      {
        id: 'user-1',
        username: 'demo',
        email: 'demo@finora.app',
        password: 'Demo123!',
      },
    ]);

    expect(receivedError?.message).toBe('USERNAME_ALREADY_EXISTS');
  });

  it('should reject registration when email already exists', () => {
    let receivedError: Error | undefined;

    service
      .register({
        username: 'david',
        email: 'demo@finora.app',
        password: 'Password1!',
      })
      .subscribe({
        error: (error: Error) => {
          receivedError = error;
        },
      });

    const usersRequest = httpTesting.expectOne('http://localhost:3000/users');

    expect(usersRequest.request.method).toBe('GET');

    usersRequest.flush([
      {
        id: 'user-1',
        username: 'demo',
        email: 'demo@finora.app',
        password: 'Demo123!',
      },
    ]);

    expect(receivedError?.message).toBe('EMAIL_ALREADY_EXISTS');
  });

  it('should login with username', () => {
    let result:
      | {
          id: string;
          username: string;
          email: string;
        }
      | undefined;

    service.login('demo', 'Demo123!').subscribe((user) => {
      result = user;
    });

    const request = httpTesting.expectOne('http://localhost:3000/users');

    expect(request.request.method).toBe('GET');

    request.flush([
      {
        id: 'user-1',
        username: 'demo',
        email: 'demo@finora.app',
        password: 'Demo123!',
      },
    ]);

    expect(result).toEqual({
      id: 'user-1',
      username: 'demo',
      email: 'demo@finora.app',
    });

    expect(service.currentUser()).toEqual(result);
    expect(service.isAuthenticated()).toBe(true);
  });

  it('should login with email', () => {
    let result:
      | {
          id: string;
          username: string;
          email: string;
        }
      | undefined;

    service.login('DEMO@FINORA.APP', 'Demo123!').subscribe((user) => {
      result = user;
    });

    const request = httpTesting.expectOne('http://localhost:3000/users');

    expect(request.request.method).toBe('GET');

    request.flush([
      {
        id: 'user-1',
        username: 'demo',
        email: 'demo@finora.app',
        password: 'Demo123!',
      },
    ]);

    expect(result).toEqual({
      id: 'user-1',
      username: 'demo',
      email: 'demo@finora.app',
    });

    expect(service.currentUser()).toEqual(result);
    expect(service.isAuthenticated()).toBe(true);
  });

  it('should reject invalid credentials', () => {
    let receivedError: Error | undefined;

    service.login('demo', 'WrongPassword').subscribe({
      error: (error: Error) => {
        receivedError = error;
      },
    });

    const request = httpTesting.expectOne('http://localhost:3000/users');

    expect(request.request.method).toBe('GET');

    request.flush([
      {
        id: 'user-1',
        username: 'demo',
        email: 'demo@finora.app',
        password: 'Demo123!',
      },
    ]);

    expect(receivedError?.message).toBe('INVALID_CREDENTIALS');

    expect(service.currentUser()).toBeNull();
    expect(service.isAuthenticated()).toBe(false);
  });
});
