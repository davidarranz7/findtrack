import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize, forkJoin, timer } from 'rxjs';

import { AppBrand } from '../../../shared/app-brand/app-brand';
import { AuthBackground } from '../auth-background/auth-background';
import { AuthService } from '../services/auth.service';
import { passwordsMatchValidator } from '../validators/passwords-match.validator';
import { RegisterAvailabilityService } from './services/register-availability';
import { getPasswordRequirements, getPasswordStrength } from './utils/password-strength.utils';

const USERNAME_PATTERN = /^[a-z0-9._]+$/;

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink, AuthBackground, AppBrand],
  providers: [RegisterAvailabilityService],
  templateUrl: './register.html',
  styleUrl: './register.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Register {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly availability = inject(RegisterAvailabilityService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly showPassword = signal(false);
  protected readonly showConfirmPassword = signal(false);

  protected readonly isSubmitting = signal(false);
  protected readonly submitError = signal<string | null>(null);

  protected readonly usernameAvailability = this.availability.usernameAvailability;

  protected readonly emailAvailability = this.availability.emailAvailability;

  protected readonly isCheckingAvailability = this.availability.isCheckingAvailability;

  protected readonly registerForm = this.formBuilder.nonNullable.group(
    {
      username: [
        '',
        [Validators.required, Validators.minLength(4), Validators.pattern(USERNAME_PATTERN)],
      ],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', Validators.required],
    },
    {
      validators: passwordsMatchValidator,
    },
  );

  private readonly passwordValue = toSignal(this.registerForm.controls.password.valueChanges, {
    initialValue: this.registerForm.controls.password.value,
  });

  protected readonly passwordRequirements = computed(() =>
    getPasswordRequirements(this.passwordValue()),
  );

  protected readonly passwordStrength = computed(() => getPasswordStrength(this.passwordValue()));

  constructor() {
    this.availability.watchUsernameAvailability(this.registerForm.controls.username);

    this.availability.watchEmailAvailability(this.registerForm.controls.email);
  }

  protected togglePasswordVisibility(): void {
    this.showPassword.update((visible) => !visible);
  }

  protected toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword.update((visible) => !visible);
  }

  protected onSubmit(): void {
    if (this.isSubmitting() || this.isCheckingAvailability()) {
      return;
    }

    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
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
      .pipe(
        finalize(() => this.isSubmitting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          void this.router.navigate(['/login']);
        },
        error: (error: Error) => {
          this.handleRegistrationError(error);
        },
      });
  }

  private handleRegistrationError(error: Error): void {
    if (error.message === 'USERNAME_ALREADY_EXISTS') {
      this.availability.markUsernameUnavailable(this.registerForm.controls.username);
      return;
    }

    if (error.message === 'EMAIL_ALREADY_EXISTS') {
      this.availability.markEmailUnavailable(this.registerForm.controls.email);
      return;
    }

    this.submitError.set('No se ha podido crear la cuenta. Inténtalo de nuevo.');
  }
}
