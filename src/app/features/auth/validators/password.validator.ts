import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export const passwordStrengthValidator: ValidatorFn = (
  control: AbstractControl,
): ValidationErrors | null => {
  const password = String(control.value ?? '');

  if (!password) {
    return null;
  }

  const errors: ValidationErrors = {};

  if (!/[A-Z]/.test(password)) {
    errors['uppercase'] = true;
  }

  if (!/\d/.test(password)) {
    errors['number'] = true;
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    errors['specialCharacter'] = true;
  }

  return Object.keys(errors).length > 0 ? errors : null;
};
