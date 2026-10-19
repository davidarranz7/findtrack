import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { finalize } from 'rxjs';

import { ToastService } from '../../../../shared/ui/toast/toast.service';
import { AuthService } from '../../../auth/services/auth.service';
import { passwordStrengthValidator } from '../../../auth/validators/password.validator';

const passwordsMatchValidator: ValidatorFn = (
  control: AbstractControl,
): ValidationErrors | null => {
  const newPassword = control.get('newPassword')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;

  return newPassword === confirmPassword ? null : { passwordsMismatch: true };
};

@Injectable()
export class SettingsPasswordService {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly toastService = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  readonly isChangingPassword = signal(false);
  readonly isPasswordEditorOpen = signal(false);

  readonly showCurrentPassword = signal(false);
  readonly showNewPassword = signal(false);
  readonly showConfirmPassword = signal(false);

  readonly form = this.formBuilder.nonNullable.group(
    {
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.minLength(8), passwordStrengthValidator]],
      confirmPassword: ['', Validators.required],
    },
    {
      validators: passwordsMatchValidator,
    },
  );

  private readonly newPasswordValue = toSignal(this.form.controls.newPassword.valueChanges, {
    initialValue: this.form.controls.newPassword.value,
  });

  readonly passwordRequirements = computed(() => {
    const password = this.newPasswordValue();

    return {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      number: /\d/.test(password),
      specialCharacter: /[^A-Za-z0-9]/.test(password),
    };
  });

  readonly passwordStrength = computed(() => {
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
    this.watchCurrentPassword();
  }

  openPasswordEditor(): void {
    this.isPasswordEditorOpen.set(true);
  }

  cancelPasswordChange(): void {
    this.form.reset();

    this.showCurrentPassword.set(false);
    this.showNewPassword.set(false);
    this.showConfirmPassword.set(false);

    this.isPasswordEditorOpen.set(false);
  }

  changePassword(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    if (this.isChangingPassword()) {
      return;
    }

    const user = this.authService.currentUser();

    if (!user) {
      return;
    }

    const { currentPassword, newPassword } = this.form.getRawValue();

    this.isChangingPassword.set(true);

    this.authService
      .changePassword(user.id, currentPassword, newPassword)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isChangingPassword.set(false)),
      )
      .subscribe({
        next: () => {
          this.form.reset();

          this.showCurrentPassword.set(false);
          this.showNewPassword.set(false);
          this.showConfirmPassword.set(false);
          this.isPasswordEditorOpen.set(false);

          this.toastService.success('Contraseña actualizada correctamente.');
        },
        error: (error: Error) => {
          if (error.message === 'INVALID_CURRENT_PASSWORD') {
            const currentPasswordControl = this.form.controls.currentPassword;

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

  toggleCurrentPasswordVisibility(): void {
    this.showCurrentPassword.update((visible) => !visible);
  }

  toggleNewPasswordVisibility(): void {
    this.showNewPassword.update((visible) => !visible);
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword.update((visible) => !visible);
  }

  private watchCurrentPassword(): void {
    const currentPasswordControl = this.form.controls.currentPassword;

    currentPasswordControl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.removeControlError(currentPasswordControl, 'invalidCurrentPassword');
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
