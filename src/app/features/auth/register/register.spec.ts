import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormGroup, FormGroupDirective } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { AuthService } from '../services/auth.service';
import { Register } from './register';

interface RegistrationData {
  username: string;
  email: string;
  password: string;
}

describe('Register', () => {
  let fixture: ComponentFixture<Register>;
  let registrationRequests: RegistrationData[];
  let registrationError: string | null;

  const getForm = (): FormGroup =>
    fixture.debugElement.query(By.directive(FormGroupDirective)).injector.get(FormGroupDirective)
      .form;

  const getSubmitButton = (): HTMLButtonElement =>
    fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement;

  const submit = (): void => {
    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;

    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    fixture.detectChanges();
  };

  const fillForm = (
    username = 'david123',
    email = 'david@example.com',
    password = 'abcdefgh',
    confirmPassword = password,
  ): void => {
    getForm().setValue({
      username,
      email,
      password,
      confirmPassword,
    });

    fixture.detectChanges();
  };

  beforeEach(async () => {
    vi.useFakeTimers();
    registrationRequests = [];
    registrationError = null;

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    await TestBed.configureTestingModule({
      imports: [Register],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            checkUsernameAvailability: (username: string) => of(username !== 'taken'),
            checkEmailAvailability: (email: string) => of(email !== 'used@example.com'),
            register: (data: RegistrationData) => {
              registrationRequests.push(data);

              return registrationError
                ? throwError(() => new Error(registrationError!))
                : of({ id: 'user-1', ...data });
            },
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Register);
    fixture.detectChanges();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should create and render the registration form', () => {
    expect(fixture.componentInstance).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Crear cuenta');
    expect(getForm()).toBeTruthy();
  });

  it('should require the mandatory fields', () => {
    expect(getForm().invalid).toBe(true);

    submit();

    expect(getForm().controls['username'].touched).toBe(true);
    expect(getForm().controls['email'].touched).toBe(true);
    expect(registrationRequests).toEqual([]);
  });

  it('should enforce the username format', () => {
    fillForm('David');

    expect(getForm().controls['username'].hasError('pattern')).toBe(true);

    fillForm('david_123');

    expect(getForm().controls['username'].hasError('pattern')).toBe(false);
  });

  it('should require at least eight password characters', () => {
    fillForm('david123', 'david@example.com', 'abc', 'abc');

    expect(getForm().controls['password'].hasError('minlength')).toBe(true);
    expect(getForm().invalid).toBe(true);
  });

  it('should allow passwords without optional complexity', () => {
    fillForm();

    expect(getForm().valid).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Mínima');
  });

  it('should display excellent password strength', () => {
    fillForm('david123', 'david@example.com', 'Abcdefg1!');

    const label = fixture.nativeElement.querySelector('.password-strength-label') as HTMLElement;

    expect(label.textContent).toContain('Excelente');
  });

  it('should reject mismatched passwords', () => {
    fillForm('david123', 'david@example.com', 'abcdefgh', 'different');
    vi.advanceTimersByTime(1000);

    submit();

    expect(getForm().hasError('passwordsMismatch')).toBe(true);
    expect(registrationRequests).toEqual([]);
  });

  it('should disable submission during availability checks', () => {
    fillForm();

    expect(getSubmitButton().disabled).toBe(true);

    submit();

    expect(registrationRequests).toEqual([]);

    vi.advanceTimersByTime(1000);
    fixture.detectChanges();

    expect(getSubmitButton().disabled).toBe(false);
  });

  it('should detect an unavailable username', () => {
    fillForm('taken');
    vi.advanceTimersByTime(1000);
    fixture.detectChanges();

    expect(getForm().controls['username'].hasError('usernameTaken')).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Este nombre de usuario ya está en uso.');
  });

  it('should detect an unavailable email', () => {
    fillForm('david123', 'used@example.com');
    vi.advanceTimersByTime(1000);
    fixture.detectChanges();

    expect(getForm().controls['email'].hasError('emailTaken')).toBe(true);
    expect(fixture.nativeElement.textContent).toContain(
      'Este correo electrónico ya está registrado.',
    );
  });

  it('should register and navigate to login', () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    fillForm();
    vi.advanceTimersByTime(1000);
    submit();

    expect(registrationRequests).toEqual([
      {
        username: 'david123',
        email: 'david@example.com',
        password: 'abcdefgh',
      },
    ]);

    expect(fixture.nativeElement.textContent).toContain('Creando cuenta...');

    vi.advanceTimersByTime(1800);

    expect(navigate).toHaveBeenCalledWith(['/login']);
  });

  it('should handle duplicate usernames returned during registration', () => {
    registrationError = 'USERNAME_ALREADY_EXISTS';

    fillForm();
    vi.advanceTimersByTime(1000);
    submit();

    expect(getForm().controls['username'].hasError('usernameTaken')).toBe(true);
  });

  it('should handle duplicate emails returned during registration', () => {
    registrationError = 'EMAIL_ALREADY_EXISTS';

    fillForm();
    vi.advanceTimersByTime(1000);
    submit();

    expect(getForm().controls['email'].hasError('emailTaken')).toBe(true);
  });

  it('should display an error when registration fails', () => {
    registrationError = 'SERVER_ERROR';

    fillForm();
    vi.advanceTimersByTime(1000);
    submit();

    expect(fixture.nativeElement.textContent).toContain('No se ha podido crear la cuenta.');
  });

  it('should toggle password visibility', () => {
    const passwordInput = fixture.nativeElement.querySelector('#password') as HTMLInputElement;

    const toggle = fixture.nativeElement.querySelector(
      '[aria-label="Mostrar contraseña"]',
    ) as HTMLButtonElement;

    expect(passwordInput.type).toBe('password');

    toggle.click();
    fixture.detectChanges();

    expect(passwordInput.type).toBe('text');
  });
});
