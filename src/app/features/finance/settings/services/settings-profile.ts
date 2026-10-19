import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, Validators } from '@angular/forms';
import { catchError, EMPTY, switchMap, tap, timer } from 'rxjs';

import { AuthService } from '../../../auth/services/auth.service';

export type AvailabilityStatus = 'idle' | 'checking' | 'available' | 'unavailable' | 'error';

@Injectable()
export class SettingsProfileService {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  readonly currentUser = this.authService.currentUser;

  readonly usernameAvailability = signal<AvailabilityStatus>('idle');
  readonly emailAvailability = signal<AvailabilityStatus>('idle');

  readonly form = this.formBuilder.nonNullable.group({
    username: [this.currentUser()?.username ?? '', [Validators.required, Validators.minLength(4)]],
    email: [this.currentUser()?.email ?? '', [Validators.required, Validators.email]],
  });

  private readonly usernameValue = toSignal(this.form.controls.username.valueChanges, {
    initialValue: this.form.controls.username.value,
  });

  private readonly emailValue = toSignal(this.form.controls.email.valueChanges, {
    initialValue: this.form.controls.email.value,
  });

  readonly userInitial = computed(() => {
    const username = this.currentUser()?.username.trim();

    if (!username) {
      return '?';
    }

    return username.charAt(0).toUpperCase();
  });

  readonly isCheckingAvailability = computed(
    () => this.usernameAvailability() === 'checking' || this.emailAvailability() === 'checking',
  );

  readonly isProfileUnchanged = computed(() => {
    const user = this.currentUser();

    if (!user) {
      return true;
    }

    return (
      this.usernameValue().trim() === user.username &&
      this.emailValue().trim().toLowerCase() === user.email.toLowerCase()
    );
  });

  constructor() {
    this.watchUsernameAvailability();
    this.watchEmailAvailability();
  }

  applySavedProfile(username: string, email: string): void {
    this.form.patchValue({
      username,
      email,
    });

    this.form.markAsPristine();
    this.resetAvailability();
  }

  discardChanges(): void {
    const user = this.currentUser();

    if (user) {
      this.form.reset({
        username: user.username,
        email: user.email,
      });
    }

    this.resetAvailability();
    this.form.markAsPristine();
  }

  handleSaveError(error: Error): boolean {
    if (error.message === 'USERNAME_ALREADY_EXISTS') {
      const usernameControl = this.form.controls.username;

      usernameControl.setErrors({
        ...(usernameControl.errors ?? {}),
        usernameTaken: true,
      });

      this.usernameAvailability.set('unavailable');
      return true;
    }

    if (error.message === 'EMAIL_ALREADY_EXISTS') {
      const emailControl = this.form.controls.email;

      emailControl.setErrors({
        ...(emailControl.errors ?? {}),
        emailTaken: true,
      });

      this.emailAvailability.set('unavailable');
      return true;
    }

    return false;
  }

  private resetAvailability(): void {
    this.usernameAvailability.set('idle');
    this.emailAvailability.set('idle');
  }

  private watchUsernameAvailability(): void {
    const usernameControl = this.form.controls.username;

    usernameControl.valueChanges
      .pipe(
        tap(() => {
          this.usernameAvailability.set('idle');
          this.removeControlError(usernameControl, 'usernameTaken');
        }),
        switchMap((username) => {
          const user = this.currentUser();
          const normalizedUsername = username.trim();

          if (
            !user ||
            normalizedUsername.toLowerCase() === user.username.toLowerCase() ||
            normalizedUsername.length < 4 ||
            usernameControl.hasError('required') ||
            usernameControl.hasError('minlength')
          ) {
            return EMPTY;
          }

          return timer(700).pipe(
            tap(() => this.usernameAvailability.set('checking')),
            switchMap(() =>
              this.authService.checkUsernameAvailability(normalizedUsername, user.id),
            ),
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
    const emailControl = this.form.controls.email;

    emailControl.valueChanges
      .pipe(
        tap(() => {
          this.emailAvailability.set('idle');
          this.removeControlError(emailControl, 'emailTaken');
        }),
        switchMap((email) => {
          const user = this.currentUser();
          const normalizedEmail = email.trim().toLowerCase();

          if (
            !user ||
            normalizedEmail === user.email.toLowerCase() ||
            !normalizedEmail ||
            emailControl.hasError('required') ||
            emailControl.hasError('email')
          ) {
            return EMPTY;
          }

          return timer(700).pipe(
            tap(() => this.emailAvailability.set('checking')),
            switchMap(() => this.authService.checkEmailAvailability(normalizedEmail, user.id)),
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
          this.usernameAvailability.set('idle');
          this.emailAvailability.set('available');
          return;
        }

        emailControl.setErrors({
          ...(emailControl.errors ?? {}),
          emailTaken: true,
        });

        this.usernameAvailability.set('idle');
        this.emailAvailability.set('unavailable');
      });
  }

  private removeControlError(control: AbstractControl, errorKey: string): void {
    if (!control.hasError(errorKey)) {
      return;
    }

    const errors = {
      ...(control.errors ?? {}),
    };

    delete errors[errorKey];

    control.setErrors(Object.keys(errors).length > 0 ? errors : null);
  }
}
