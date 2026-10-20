import { TestBed } from '@angular/core/testing';
import { FormControl, Validators } from '@angular/forms';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { AuthService } from '../../services/auth.service';
import { RegisterAvailabilityService } from './register-availability';

describe('RegisterAvailabilityService', () => {
  let service: RegisterAvailabilityService;
  let usernameControl: FormControl<string>;
  let emailControl: FormControl<string>;
  let checkedUsernames: string[];
  let checkedEmails: string[];

  beforeEach(() => {
    vi.useFakeTimers();

    checkedUsernames = [];
    checkedEmails = [];

    TestBed.configureTestingModule({
      providers: [
        RegisterAvailabilityService,
        {
          provide: AuthService,
          useValue: {
            checkUsernameAvailability: (username: string) => {
              checkedUsernames.push(username);

              return username === 'failure'
                ? throwError(() => new Error('API_ERROR'))
                : of(username !== 'taken');
            },
            checkEmailAvailability: (email: string) => {
              checkedEmails.push(email);

              return email === 'failure@example.com'
                ? throwError(() => new Error('API_ERROR'))
                : of(email !== 'used@example.com');
            },
          },
        },
      ],
    });

    service = TestBed.inject(RegisterAvailabilityService);

    usernameControl = new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(4),
        Validators.pattern(/^[a-z0-9._]+$/),
      ],
    });

    emailControl = new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    });

    service.watchUsernameAvailability(usernameControl);
    service.watchEmailAvailability(emailControl);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should start with both availability states idle', () => {
    expect(service.usernameAvailability()).toBe('idle');
    expect(service.emailAvailability()).toBe('idle');
    expect(service.isCheckingAvailability()).toBe(false);
  });

  it('should not check invalid usernames', () => {
    usernameControl.setValue('abc');
    vi.advanceTimersByTime(1000);

    usernameControl.setValue('David');
    vi.advanceTimersByTime(1000);

    usernameControl.setValue('nombre con espacios');
    vi.advanceTimersByTime(1000);

    expect(checkedUsernames).toEqual([]);
    expect(service.usernameAvailability()).toBe('idle');
  });

  it('should check username availability after one second', () => {
    usernameControl.setValue('david');

    expect(service.usernameAvailability()).toBe('checking');
    expect(service.isCheckingAvailability()).toBe(true);

    vi.advanceTimersByTime(999);

    expect(checkedUsernames).toEqual([]);

    vi.advanceTimersByTime(1);

    expect(checkedUsernames).toEqual(['david']);
    expect(service.usernameAvailability()).toBe('available');
    expect(service.isCheckingAvailability()).toBe(false);
  });

  it('should reject an unavailable username', () => {
    usernameControl.setValue('taken');
    vi.advanceTimersByTime(1000);

    expect(usernameControl.hasError('usernameTaken')).toBe(true);
    expect(service.usernameAvailability()).toBe('unavailable');
    expect(usernameControl.invalid).toBe(true);
  });

  it('should clear the unavailable state when username changes', () => {
    usernameControl.setValue('taken');
    vi.advanceTimersByTime(1000);

    usernameControl.setValue('newuser');

    expect(usernameControl.hasError('usernameTaken')).toBe(false);
    expect(service.usernameAvailability()).toBe('checking');

    vi.advanceTimersByTime(1000);

    expect(service.usernameAvailability()).toBe('available');
  });

  it('should cancel outdated username checks', () => {
    usernameControl.setValue('taken');

    vi.advanceTimersByTime(900);

    usernameControl.setValue('newuser');

    vi.advanceTimersByTime(100);

    expect(checkedUsernames).toEqual([]);

    vi.advanceTimersByTime(900);

    expect(checkedUsernames).toEqual(['newuser']);
    expect(service.usernameAvailability()).toBe('available');
  });

  it('should report username availability errors', () => {
    usernameControl.setValue('failure');
    vi.advanceTimersByTime(1000);

    expect(service.usernameAvailability()).toBe('error');
    expect(service.isCheckingAvailability()).toBe(false);
  });

  it('should not check invalid emails', () => {
    emailControl.setValue('correo-invalido');
    vi.advanceTimersByTime(1000);

    expect(checkedEmails).toEqual([]);
    expect(service.emailAvailability()).toBe('idle');
  });

  it('should check valid email availability', () => {
    emailControl.setValue('david@example.com');

    expect(service.emailAvailability()).toBe('checking');

    vi.advanceTimersByTime(1000);

    expect(checkedEmails).toEqual(['david@example.com']);
    expect(service.emailAvailability()).toBe('available');
  });

  it('should reject an already registered email', () => {
    emailControl.setValue('used@example.com');
    vi.advanceTimersByTime(1000);

    expect(emailControl.hasError('emailTaken')).toBe(true);
    expect(service.emailAvailability()).toBe('unavailable');
  });

  it('should clear the email error when its value changes', () => {
    emailControl.setValue('used@example.com');
    vi.advanceTimersByTime(1000);

    emailControl.setValue('new@example.com');

    expect(emailControl.hasError('emailTaken')).toBe(false);
    expect(service.emailAvailability()).toBe('checking');

    vi.advanceTimersByTime(1000);

    expect(service.emailAvailability()).toBe('available');
  });

  it('should report email availability errors', () => {
    emailControl.setValue('failure@example.com');
    vi.advanceTimersByTime(1000);

    expect(service.emailAvailability()).toBe('error');
    expect(service.isCheckingAvailability()).toBe(false);
  });

  it('should detect simultaneous checks', () => {
    usernameControl.setValue('david');
    emailControl.setValue('david@example.com');

    expect(service.isCheckingAvailability()).toBe(true);

    vi.advanceTimersByTime(1000);

    expect(service.usernameAvailability()).toBe('available');
    expect(service.emailAvailability()).toBe('available');
    expect(service.isCheckingAvailability()).toBe(false);
  });

  it('should mark username duplicates returned during registration', () => {
    service.markUsernameUnavailable(usernameControl);

    expect(usernameControl.hasError('usernameTaken')).toBe(true);
    expect(service.usernameAvailability()).toBe('unavailable');
  });

  it('should mark email duplicates returned during registration', () => {
    service.markEmailUnavailable(emailControl);

    expect(emailControl.hasError('emailTaken')).toBe(true);
    expect(service.emailAvailability()).toBe('unavailable');
  });
});
