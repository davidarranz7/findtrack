import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { catchError, EMPTY, finalize, forkJoin, switchMap, tap, timer } from 'rxjs';

import { AppBrand } from '../../../shared/app-brand/app-brand';
import { AuthBackground } from '../auth-background/auth-background';
import { AuthService } from '../services/auth.service';
import { passwordStrengthValidator } from '../validators/password.validator';

type AvailabilityStatus = 'idle' | 'checking' | 'available' | 'unavailable' | 'error';

const passwordsMatchValidator: ValidatorFn = (
  control: AbstractControl,
): ValidationErrors | null => {
  const password = control.get('password')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;

  return password === confirmPassword ? null : { passwordsMismatch: true };
};

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink, AuthBackground, AppBrand],
  templateUrl: './register.html',
  styleUrl: './register.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Register {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly showPassword = signal(false);
  protected readonly showConfirmPassword = signal(false);

  protected readonly isSubmitting = signal(false);
  protected readonly submitError = signal<string | null>(null);

  protected readonly usernameAvailability = signal<AvailabilityStatus>('idle');

  protected readonly emailAvailability = signal<AvailabilityStatus>('idle');

  protected readonly isCheckingAvailability = computed(
    () => this.usernameAvailability() === 'checking' || this.emailAvailability() === 'checking',
  );

  protected readonly registerForm = this.formBuilder.nonNullable.group(
    {
      username: ['', [Validators.required, Validators.minLength(4)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8), passwordStrengthValidator]],
      confirmPassword: ['', Validators.required],
    },
    {
      validators: passwordsMatchValidator,
    },
  );

  private readonly passwordValue = toSignal(this.registerForm.controls.password.valueChanges, {
    initialValue: this.registerForm.controls.password.value,
  });

  protected readonly passwordRequirements = computed(() => {
    const password = this.passwordValue();

    return {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      number: /\d/.test(password),
      specialCharacter: /[^A-Za-z0-9]/.test(password),
    };
  });

  protected readonly passwordStrength = computed(() => {
    const password = this.passwordValue();

    if (password.length < 8) {
      return {
        percentage: 25,
        label: 'Débil',
        level: 'weak',
      };
    }

    const requirements = this.passwordRequirements();

    const improvements = [
      requirements.uppercase,
      requirements.number,
      requirements.specialCharacter,
    ].filter(Boolean).length;

    if (improvements === 0) {
      return {
        percentage: 50,
        label: 'Mínima',
        level: 'minimum',
      };
    }

    if (improvements === 1) {
      return {
        percentage: 75,
        label: 'Media',
        level: 'medium',
      };
    }

    if (improvements === 2) {
      return {
        percentage: 90,
        label: 'Fuerte',
        level: 'strong',
      };
    }

    return {
      percentage: 100,
      label: 'Excelente',
      level: 'excellent',
    };
  });

  constructor() {
    this.watchUsernameAvailability();
    this.watchEmailAvailability();
  }

  protected togglePasswordVisibility(): void {
    this.showPassword.update((visible) => !visible);
  }

  protected toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword.update((visible) => !visible);
  }

  protected onSubmit(): void {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    if (this.isCheckingAvailability()) {
      return;
    }

    const { username, email, password } = this.registerForm.getRawValue();

    this.isSubmitting.set(true);
    this.submitError.set(null);

    forkJoin({
      user: this.authService.register({
        username,
        email,
        password,
      }),
      minimumDelay: timer(1800),
    })
      .pipe(finalize(() => this.isSubmitting.set(false)))
      .subscribe({
        next: () => {
          void this.router.navigate(['/login']);
        },
        error: (error: Error) => {
          if (error.message === 'USERNAME_ALREADY_EXISTS') {
            const usernameControl = this.registerForm.controls.username;

            usernameControl.setErrors({
              ...(usernameControl.errors ?? {}),
              usernameTaken: true,
            });

            this.usernameAvailability.set('unavailable');
            return;
          }

          if (error.message === 'EMAIL_ALREADY_EXISTS') {
            const emailControl = this.registerForm.controls.email;

            emailControl.setErrors({
              ...(emailControl.errors ?? {}),
              emailTaken: true,
            });

            this.emailAvailability.set('unavailable');
            return;
          }

          this.submitError.set('No se ha podido crear la cuenta. Inténtalo de nuevo.');
        },
      });
  }

  private watchUsernameAvailability(): void {
    const usernameControl = this.registerForm.controls.username;

    usernameControl.valueChanges
      .pipe(
        tap(() => {
          this.usernameAvailability.set('idle');
          this.removeControlError(usernameControl, 'usernameTaken');
        }),
        switchMap((username) => {
          const normalizedUsername = username.trim();

          if (
            normalizedUsername.length < 4 ||
            usernameControl.hasError('required') ||
            usernameControl.hasError('minlength')
          ) {
            return EMPTY;
          }

          return timer(1000).pipe(
            tap(() => this.usernameAvailability.set('checking')),
            switchMap(() => this.authService.checkUsernameAvailability(normalizedUsername)),
            catchError(() => {
              this.usernameAvailability.set('error');
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((available) => {
        if (available) {
          this.usernameAvailability.set('available');
          return;
        }

        usernameControl.setErrors({
          ...(usernameControl.errors ?? {}),
          usernameTaken: true,
        });

        this.usernameAvailability.set('unavailable');
      });
  }

  private watchEmailAvailability(): void {
    const emailControl = this.registerForm.controls.email;

    emailControl.valueChanges
      .pipe(
        tap(() => {
          this.emailAvailability.set('idle');
          this.removeControlError(emailControl, 'emailTaken');
        }),
        switchMap((email) => {
          const normalizedEmail = email.trim();

          if (
            !normalizedEmail ||
            emailControl.hasError('required') ||
            emailControl.hasError('email')
          ) {
            return EMPTY;
          }

          return timer(1000).pipe(
            tap(() => this.emailAvailability.set('checking')),
            switchMap(() => this.authService.checkEmailAvailability(normalizedEmail)),
            catchError(() => {
              this.emailAvailability.set('error');
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((available) => {
        if (available) {
          this.emailAvailability.set('available');
          return;
        }

        emailControl.setErrors({
          ...(emailControl.errors ?? {}),
          emailTaken: true,
        });

        this.emailAvailability.set('unavailable');
      });
  }

  private removeControlError(control: AbstractControl, errorKey: string): void {
    if (!control.hasError(errorKey)) {
      return;
    }

    const errors = { ...(control.errors ?? {}) };

    delete errors[errorKey];

    control.setErrors(Object.keys(errors).length > 0 ? errors : null);
  }
}
