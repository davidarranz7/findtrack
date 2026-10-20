import { FormControl } from '@angular/forms';

import { passwordStrengthValidator } from './password.validator';

describe('passwordStrengthValidator', () => {
  const createControl = (password: string) =>
    new FormControl(password, {
      nonNullable: true,
      validators: passwordStrengthValidator,
    });

  it('should accept a password with all complexity requirements', () => {
    const control = createControl('Abcdefg1!');

    expect(control.valid).toBe(true);
    expect(control.errors).toBeNull();
  });

  it('should detect missing uppercase, number and special character', () => {
    const control = createControl('abcdefgh');

    expect(control.errors).toEqual({
      uppercase: true,
      number: true,
      specialCharacter: true,
    });
  });

  it('should detect a missing uppercase letter', () => {
    const control = createControl('abcdefg1!');

    expect(control.errors).toEqual({
      uppercase: true,
    });
  });

  it('should detect a missing number', () => {
    const control = createControl('Abcdefgh!');

    expect(control.errors).toEqual({
      number: true,
    });
  });

  it('should detect a missing special character', () => {
    const control = createControl('Abcdefg1');

    expect(control.errors).toEqual({
      specialCharacter: true,
    });
  });

  it('should ignore empty passwords', () => {
    const control = createControl('');

    expect(control.errors).toBeNull();
  });

  it('should update errors when the password changes', () => {
    const control = createControl('abcdefgh');

    expect(control.invalid).toBe(true);

    control.setValue('Abcdefg1!');

    expect(control.valid).toBe(true);
    expect(control.errors).toBeNull();
  });

  it('should not enforce a minimum length', () => {
    const control = createControl('A1!');

    expect(control.valid).toBe(true);
  });
});
