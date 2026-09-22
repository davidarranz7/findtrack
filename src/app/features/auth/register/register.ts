import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AppBrand } from '../../../shared/ui/app-brand/app-brand';
import { AuthBackground } from '../auth-background/auth-background';

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
})
export class Register {
  private readonly formBuilder = inject(FormBuilder);

  protected readonly showPassword = signal(false);
  protected readonly showConfirmPassword = signal(false);

  protected readonly registerForm = this.formBuilder.nonNullable.group(
    {
      username: ['', [Validators.required, Validators.minLength(4)]],
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

    return {
      percentage: 100,
      label: 'Excelente',
      level: 'excellent',
    };
  });

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

    console.log(this.registerForm.getRawValue());
  }
}
