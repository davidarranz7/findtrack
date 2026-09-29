import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize, forkJoin, timer } from 'rxjs';

import { AppBrand } from '../../../shared/app-brand/app-brand';
import { AuthBackground } from '../auth-background/auth-background';
import { AuthService } from '../services/auth.service';

type LoginView = 'remembered-account' | 'remembered-password' | 'credentials';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, AuthBackground, AppBrand],
  templateUrl: './login.html',
  styleUrl: './login.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Login {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly rememberedAccount = this.authService.rememberedAccount;

  protected readonly loginView = signal<LoginView>(
    this.rememberedAccount() ? 'remembered-account' : 'credentials',
  );

  protected readonly showPassword = signal(false);
  protected readonly isSubmitting = signal(false);
  protected readonly loginError = signal<string | null>(null);

  protected readonly loginForm = this.formBuilder.nonNullable.group({
    identifier: ['', Validators.required],
    password: ['', Validators.required],
    rememberMe: [false],
  });

  protected continueWithRememberedAccount(): void {
    const account = this.rememberedAccount();

    if (!account) {
      this.loginView.set('credentials');
      return;
    }

    this.loginForm.reset({
      identifier: account.email,
      password: '',
      rememberMe: true,
    });

    this.loginError.set(null);
    this.loginView.set('remembered-password');
  }

  protected useAnotherAccount(): void {
    this.loginForm.reset({
      identifier: '',
      password: '',
      rememberMe: false,
    });

    this.loginError.set(null);
    this.showPassword.set(false);
    this.loginView.set('credentials');
  }

  protected togglePasswordVisibility(): void {
    this.showPassword.update((visible) => !visible);
  }

  protected onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    const { identifier, password, rememberMe } = this.loginForm.getRawValue();

    this.isSubmitting.set(true);
    this.loginError.set(null);

    forkJoin({
      user: this.authService.login(identifier, password, rememberMe),
      minimumDelay: timer(1200),
    })
      .pipe(finalize(() => this.isSubmitting.set(false)))
      .subscribe({
        next: () => {
          void this.router.navigate(['/overview']);
        },
        error: (error: Error) => {
          if (error.message === 'INVALID_CREDENTIALS') {
            this.loginError.set('Usuario, correo electrónico o contraseña incorrectos.');
            return;
          }

          this.loginError.set('No se ha podido iniciar sesión. Inténtalo de nuevo.');
        },
      });
  }
}
