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
import { Router } from '@angular/router';
import { catchError, EMPTY, finalize, map, of, switchMap, tap, timer } from 'rxjs';

import { PageHeader } from '../../../shared/ui/page-header/page-header';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { AuthService } from '../../auth/services/auth.service';
import { passwordStrengthValidator } from '../../auth/validators/password.validator';
import { PreferencesService } from '../services/preferences.service';
import { UserPreferences } from './user-preferences';

type AvailabilityStatus = 'idle' | 'checking' | 'available' | 'unavailable' | 'error';

const passwordsMatchValidator: ValidatorFn = (
  control: AbstractControl,
): ValidationErrors | null => {
  const newPassword = control.get('newPassword')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;

  return newPassword === confirmPassword ? null : { passwordsMismatch: true };
};

@Component({
  selector: 'app-settings',
  imports: [PageHeader, ReactiveFormsModule],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Settings {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly preferencesService = inject(PreferencesService);
  private readonly toastService = inject(ToastService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly currentUser = this.authService.currentUser;

  protected readonly preferences = signal<UserPreferences | null>(null);
  protected readonly isLoadingPreferences = signal(true);
  protected readonly preferencesLoadError = signal<string | null>(null);

  protected readonly isSavingChanges = signal(false);
  protected readonly isChangingPassword = signal(false);
  protected readonly isPasswordEditorOpen = signal(false);

  protected readonly usernameAvailability = signal<AvailabilityStatus>('idle');
  protected readonly emailAvailability = signal<AvailabilityStatus>('idle');

  protected readonly showCurrentPassword = signal(false);
  protected readonly showNewPassword = signal(false);
  protected readonly showConfirmPassword = signal(false);

  protected readonly currencyOptions = [
    {
      value: 'EUR',
      label: 'EUR - Euro (€)',
    },
  ] as const;

  protected readonly localeOptions = [
    {
      value: 'es-ES',
      label: 'Español',
    },
  ] as const;

  protected readonly dateFormatOptions = [
    {
      value: 'DD/MM/YYYY',
      label: 'DD/MM/YYYY',
    },
  ] as const;

  protected readonly profileForm = this.formBuilder.nonNullable.group({
    username: [this.currentUser()?.username ?? '', [Validators.required, Validators.minLength(4)]],
    email: [this.currentUser()?.email ?? '', [Validators.required, Validators.email]],
  });

  protected readonly preferencesForm = this.formBuilder.nonNullable.group({
    currency: ['EUR' as const],
    locale: ['es-ES' as const],
    dateFormat: ['DD/MM/YYYY' as const],
    budgetWarningEnabled: [true],
    budgetExceededEnabled: [true],
    savingsGoalEnabled: [true],
  });

  protected readonly passwordForm = this.formBuilder.nonNullable.group(
    {
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.minLength(8), passwordStrengthValidator]],
      confirmPassword: ['', Validators.required],
    },
    {
      validators: passwordsMatchValidator,
    },
  );

  private readonly usernameValue = toSignal(this.profileForm.controls.username.valueChanges, {
    initialValue: this.profileForm.controls.username.value,
  });

  private readonly emailValue = toSignal(this.profileForm.controls.email.valueChanges, {
    initialValue: this.profileForm.controls.email.value,
  });

  private readonly preferencesValue = toSignal(this.preferencesForm.valueChanges, {
    initialValue: this.preferencesForm.getRawValue(),
  });

  private readonly newPasswordValue = toSignal(
    this.passwordForm.controls.newPassword.valueChanges,
    {
      initialValue: this.passwordForm.controls.newPassword.value,
    },
  );

  protected readonly userInitial = computed(() => {
    const username = this.currentUser()?.username.trim();

    if (!username) {
      return '?';
    }

    return username.charAt(0).toUpperCase();
  });

  protected readonly isCheckingAvailability = computed(
    () => this.usernameAvailability() === 'checking' || this.emailAvailability() === 'checking',
  );

  protected readonly isProfileUnchanged = computed(() => {
    const user = this.currentUser();

    if (!user) {
      return true;
    }

    return (
      this.usernameValue().trim() === user.username &&
      this.emailValue().trim().toLowerCase() === user.email.toLowerCase()
    );
  });

  protected readonly isPreferencesUnchanged = computed(() => {
    const savedPreferences = this.preferences();

    if (!savedPreferences) {
      return true;
    }

    const currentPreferences = this.preferencesValue();

    return (
      currentPreferences.currency === savedPreferences.currency &&
      currentPreferences.locale === savedPreferences.locale &&
      currentPreferences.dateFormat === savedPreferences.dateFormat &&
      currentPreferences.budgetWarningEnabled === savedPreferences.budgetWarningEnabled &&
      currentPreferences.budgetExceededEnabled === savedPreferences.budgetExceededEnabled &&
      currentPreferences.savingsGoalEnabled === savedPreferences.savingsGoalEnabled
    );
  });

  protected readonly hasUnsavedChanges = computed(
    () => !this.isProfileUnchanged() || !this.isPreferencesUnchanged(),
  );

  protected readonly passwordRequirements = computed(() => {
    const password = this.newPasswordValue();

    return {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      number: /\d/.test(password),
      specialCharacter: /[^A-Za-z0-9]/.test(password),
    };
  });

  protected readonly passwordStrength = computed(() => {
    const password = this.newPasswordValue();

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
    this.watchCurrentPassword();
    this.loadPreferences();
  }

  protected saveChanges(): void {
    if (this.profileForm.invalid || this.preferencesForm.invalid) {
      this.profileForm.markAllAsTouched();
      this.preferencesForm.markAllAsTouched();
      return;
    }

    if (!this.hasUnsavedChanges() || this.isCheckingAvailability() || this.isSavingChanges()) {
      return;
    }

    const user = this.currentUser();
    const savedPreferences = this.preferences();

    if (!user || !savedPreferences) {
      return;
    }

    const profileChanged = !this.isProfileUnchanged();
    const preferencesChanged = !this.isPreferencesUnchanged();
    const { username, email } = this.profileForm.getRawValue();

    this.isSavingChanges.set(true);

    const profileUpdate$ = profileChanged
      ? this.authService.updateProfile(user.id, {
          username,
          email,
        })
      : of(user);

    profileUpdate$
      .pipe(
        switchMap((updatedUser) => {
          if (!preferencesChanged) {
            return of({
              updatedUser,
              updatedPreferences: savedPreferences,
            });
          }

          return this.preferencesService
            .updatePreferences(savedPreferences.id, this.preferencesForm.getRawValue())
            .pipe(
              map((updatedPreferences) => ({
                updatedUser,
                updatedPreferences,
              })),
            );
        }),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isSavingChanges.set(false)),
      )
      .subscribe({
        next: ({ updatedUser, updatedPreferences }) => {
          this.preferences.set(updatedPreferences);

          this.profileForm.patchValue(
            {
              username: updatedUser.username,
              email: updatedUser.email,
            },
            {
              emitEvent: false,
            },
          );

          this.profileForm.markAsPristine();
          this.preferencesForm.markAsPristine();

          this.usernameAvailability.set('idle');
          this.emailAvailability.set('idle');

          this.toastService.success('Configuración guardada correctamente.');
        },
        error: (error: Error) => {
          this.handleSaveError(error);
        },
      });
  }

  protected discardChanges(): void {
    const user = this.currentUser();
    const savedPreferences = this.preferences();

    if (user) {
      this.profileForm.reset({
        username: user.username,
        email: user.email,
      });
    }

    if (savedPreferences) {
      this.preferencesForm.reset({
        currency: savedPreferences.currency,
        locale: savedPreferences.locale,
        dateFormat: savedPreferences.dateFormat,
        budgetWarningEnabled: savedPreferences.budgetWarningEnabled,
        budgetExceededEnabled: savedPreferences.budgetExceededEnabled,
        savingsGoalEnabled: savedPreferences.savingsGoalEnabled,
      });
    }

    this.usernameAvailability.set('idle');
    this.emailAvailability.set('idle');
    this.profileForm.markAsPristine();
    this.preferencesForm.markAsPristine();
  }

  protected openPasswordEditor(): void {
    this.isPasswordEditorOpen.set(true);
  }

  protected cancelPasswordChange(): void {
    this.passwordForm.reset();

    this.showCurrentPassword.set(false);
    this.showNewPassword.set(false);
    this.showConfirmPassword.set(false);

    this.isPasswordEditorOpen.set(false);
  }

  protected changePassword(): void {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    if (this.isChangingPassword()) {
      return;
    }

    const user = this.currentUser();

    if (!user) {
      return;
    }

    const { currentPassword, newPassword } = this.passwordForm.getRawValue();

    this.isChangingPassword.set(true);

    this.authService
      .changePassword(user.id, currentPassword, newPassword)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isChangingPassword.set(false)),
      )
      .subscribe({
        next: () => {
          this.passwordForm.reset();

          this.showCurrentPassword.set(false);
          this.showNewPassword.set(false);
          this.showConfirmPassword.set(false);
          this.isPasswordEditorOpen.set(false);

          this.toastService.success('Contraseña actualizada correctamente.');
        },
        error: (error: Error) => {
          if (error.message === 'INVALID_CURRENT_PASSWORD') {
            const currentPasswordControl = this.passwordForm.controls.currentPassword;

            currentPasswordControl.setErrors({
              ...(currentPasswordControl.errors ?? {}),
              invalidCurrentPassword: true,
            });

            return;
          }

          this.toastService.error('No se ha podido actualizar la contraseña.');
        },
      });
  }

  protected logout(): void {
    this.authService.clearCurrentUser();
    void this.router.navigate(['/login']);
  }

  protected toggleCurrentPasswordVisibility(): void {
    this.showCurrentPassword.update((visible) => !visible);
  }

  protected toggleNewPasswordVisibility(): void {
    this.showNewPassword.update((visible) => !visible);
  }

  protected toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword.update((visible) => !visible);
  }

  private loadPreferences(): void {
    const userId = this.currentUser()?.id;

    if (!userId) {
      this.isLoadingPreferences.set(false);
      this.preferencesLoadError.set('No se ha podido identificar al usuario actual.');
      return;
    }

    this.isLoadingPreferences.set(true);
    this.preferencesLoadError.set(null);

    this.preferencesService
      .getOrCreatePreferences(userId)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isLoadingPreferences.set(false)),
      )
      .subscribe({
        next: (preferences) => {
          this.preferences.set(preferences);

          this.preferencesForm.setValue({
            currency: preferences.currency,
            locale: preferences.locale,
            dateFormat: preferences.dateFormat,
            budgetWarningEnabled: preferences.budgetWarningEnabled,
            budgetExceededEnabled: preferences.budgetExceededEnabled,
            savingsGoalEnabled: preferences.savingsGoalEnabled,
          });

          this.preferencesForm.markAsPristine();
        },
        error: () => {
          this.preferencesLoadError.set('No se han podido cargar tus preferencias.');
        },
      });
  }

  private watchUsernameAvailability(): void {
    const usernameControl = this.profileForm.controls.username;

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
    const emailControl = this.profileForm.controls.email;

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

  private watchCurrentPassword(): void {
    const currentPasswordControl = this.passwordForm.controls.currentPassword;

    currentPasswordControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.removeControlError(currentPasswordControl, 'invalidCurrentPassword');
    });
  }

  private handleSaveError(error: Error): void {
    if (error.message === 'USERNAME_ALREADY_EXISTS') {
      const usernameControl = this.profileForm.controls.username;

      usernameControl.setErrors({
        ...(usernameControl.errors ?? {}),
        usernameTaken: true,
      });

      this.usernameAvailability.set('unavailable');
      return;
    }

    if (error.message === 'EMAIL_ALREADY_EXISTS') {
      const emailControl = this.profileForm.controls.email;

      emailControl.setErrors({
        ...(emailControl.errors ?? {}),
        emailTaken: true,
      });

      this.emailAvailability.set('unavailable');
      return;
    }

    this.toastService.error('No se ha podido guardar la configuración.');
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
