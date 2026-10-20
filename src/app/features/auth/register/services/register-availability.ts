import { computed, DestroyRef, inject, Injectable, signal, WritableSignal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormControl } from '@angular/forms';
import { catchError, EMPTY, Observable, switchMap, tap, timer } from 'rxjs';

import { AuthService } from '../../services/auth.service';

export type AvailabilityStatus = 'idle' | 'checking' | 'available' | 'unavailable' | 'error';

type AvailabilityError = 'usernameTaken' | 'emailTaken';

@Injectable()
export class RegisterAvailabilityService {
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  readonly usernameAvailability = signal<AvailabilityStatus>('idle');
  readonly emailAvailability = signal<AvailabilityStatus>('idle');

  readonly isCheckingAvailability = computed(
    () => this.usernameAvailability() === 'checking' || this.emailAvailability() === 'checking',
  );

  watchUsernameAvailability(control: FormControl<string>): void {
    this.watchAvailability(control, this.usernameAvailability, 'usernameTaken', (username) =>
      this.authService.checkUsernameAvailability(username),
    );
  }

  watchEmailAvailability(control: FormControl<string>): void {
    this.watchAvailability(
      control,
      this.emailAvailability,
      'emailTaken',
      (email) => this.authService.checkEmailAvailability(email),
      true,
    );
  }

  markUsernameUnavailable(control: AbstractControl): void {
    this.markUnavailable(control, 'usernameTaken', this.usernameAvailability);
  }

  markEmailUnavailable(control: AbstractControl): void {
    this.markUnavailable(control, 'emailTaken', this.emailAvailability);
  }

  private watchAvailability(
    control: FormControl<string>,
    status: WritableSignal<AvailabilityStatus>,
    errorKey: AvailabilityError,
    checkAvailability: (value: string) => Observable<boolean>,
    trimValue = false,
  ): void {
    control.valueChanges
      .pipe(
        tap(() => {
          status.set('idle');
          this.removeControlError(control, errorKey);
        }),
        switchMap((value) => {
          const normalizedValue = trimValue ? value.trim() : value;

          if (control.invalid || !normalizedValue) {
            return EMPTY;
          }

          status.set('checking');

          return timer(1000).pipe(
            switchMap(() => checkAvailability(normalizedValue)),
            catchError(() => {
              status.set('error');
              return EMPTY;
            }),
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((available) => {
        if (available) {
          status.set('available');
          return;
        }

        this.markUnavailable(control, errorKey, status);
      });
  }

  private markUnavailable(
    control: AbstractControl,
    errorKey: AvailabilityError,
    status: WritableSignal<AvailabilityStatus>,
  ): void {
    control.setErrors({
      ...(control.errors ?? {}),
      [errorKey]: true,
    });

    status.set('unavailable');
  }

  private removeControlError(control: AbstractControl, errorKey: AvailabilityError): void {
    if (!control.hasError(errorKey)) {
      return;
    }

    const errors = { ...(control.errors ?? {}) };

    delete errors[errorKey];

    control.setErrors(Object.keys(errors).length > 0 ? errors : null);
  }
}
