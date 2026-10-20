import { FormControl, FormGroup, Validators } from '@angular/forms';

import { passwordsMatchValidator } from './passwords-match.validator';

describe('passwordsMatchValidator', () => {
  const createForm = (password: string, confirmPassword: string) =>
    new FormGroup(
      {
        password: new FormControl(password, {
          nonNullable: true,
          validators: [Validators.required, Validators.minLength(8)],
        }),
        confirmPassword: new FormControl(confirmPassword, {
          nonNullable: true,
          validators: Validators.required,
        }),
      },
      {
        validators: passwordsMatchValidator,
      },
    );

  it('should accept matching passwords', () => {
    const form = createForm('abcdefgh', 'abcdefgh');

    expect(form.valid).toBe(true);
    expect(form.hasError('passwordsMismatch')).toBe(false);
  });

  it('should reject different passwords', () => {
    const form = createForm('abcdefgh', 'abcdefgi');

    expect(form.invalid).toBe(true);
    expect(form.hasError('passwordsMismatch')).toBe(true);
  });

  it('should compare passwords case sensitively', () => {
    const form = createForm('Abcdefgh', 'abcdefgh');

    expect(form.hasError('passwordsMismatch')).toBe(true);
  });

  it('should update validation when confirmation changes', () => {
    const form = createForm('abcdefgh', 'different');

    form.controls.confirmPassword.setValue('abcdefgh');

    expect(form.valid).toBe(true);
  });

  it('should update validation when the password changes', () => {
    const form = createForm('abcdefgh', 'abcdefgh');

    form.controls.password.setValue('newpassword');

    expect(form.hasError('passwordsMismatch')).toBe(true);
  });

  it('should keep the minimum length validation independent', () => {
    const form = createForm('abc', 'abc');

    expect(form.hasError('passwordsMismatch')).toBe(false);
    expect(form.controls.password.hasError('minlength')).toBe(true);
    expect(form.invalid).toBe(true);
  });

  it('should accept passwords without optional complexity', () => {
    const form = createForm('abcdefgh', 'abcdefgh');

    expect(form.valid).toBe(true);
  });
});
