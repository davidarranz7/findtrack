import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { Login } from './login';

describe('Login', () => {
  let component: Login;
  let fixture: ComponentFixture<Login>;

  beforeEach(async () => {
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
      imports: [Login],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Login);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display the identifier field', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const identifierInput = compiled.querySelector<HTMLInputElement>('#identifier');

    expect(identifierInput).toBeTruthy();
    expect(identifierInput?.getAttribute('type')).toBe('text');
    expect(identifierInput?.getAttribute('autocomplete')).toBe('username');
  });

  it('should show validation errors when submitting an empty form', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const form = compiled.querySelector<HTMLFormElement>('form');

    form?.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(compiled.textContent).toContain('Introduce tu usuario o correo electrónico.');
    expect(compiled.textContent).toContain('La contraseña es obligatoria.');
  });

  it('should toggle password visibility', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const passwordInput = compiled.querySelector<HTMLInputElement>('#password');
    const toggleButton = compiled.querySelector<HTMLButtonElement>('.password-toggle');

    expect(passwordInput?.type).toBe('password');

    toggleButton?.click();
    fixture.detectChanges();

    expect(passwordInput?.type).toBe('text');

    toggleButton?.click();
    fixture.detectChanges();

    expect(passwordInput?.type).toBe('password');
  });
});
