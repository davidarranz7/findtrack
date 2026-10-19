import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { ToastService } from '../../../../shared/ui/toast/toast.service';
import { AuthService } from '../../../auth/services/auth.service';
import { SettingsPasswordService } from './settings-password';

describe('SettingsPasswordService', () => {
  let service: SettingsPasswordService;
  let updates: string[];
  let successMessages: string[];
  let invalidCurrentPassword: boolean;

  const currentUser = signal({
    id: 'user-1',
    username: 'usuario',
    email: 'usuario@example.com',
  });

  beforeEach(() => {
    updates = [];
    successMessages = [];
    invalidCurrentPassword = false;

    TestBed.configureTestingModule({
      providers: [
        SettingsPasswordService,
        {
          provide: AuthService,
          useValue: {
            currentUser,
            changePassword: (userId: string, currentPassword: string, newPassword: string) => {
              updates.push(`${userId}:${currentPassword}:${newPassword}`);

              return invalidCurrentPassword
                ? throwError(() => new Error('INVALID_CURRENT_PASSWORD'))
                : of(undefined);
            },
          },
        },
        {
          provide: ToastService,
          useValue: {
            success: (message: string) => successMessages.push(message),
            error: () => undefined,
          },
        },
      ],
    });

    service = TestBed.inject(SettingsPasswordService);
  });

  it('should create', () => {
    expect(service).toBeTruthy();
  });

  it('should open and close the password editor', () => {
    service.openPasswordEditor();

    expect(service.isPasswordEditorOpen()).toBe(true);

    service.cancelPasswordChange();

    expect(service.isPasswordEditorOpen()).toBe(false);
  });

  it('should reject an invalid password', () => {
    service.form.controls.newPassword.setValue('abc');

    expect(service.form.invalid).toBe(true);
  });

  it('should change the password when the form is valid', () => {
    service.form.setValue({
      currentPassword: 'Anterior123!',
      newPassword: 'Nueva123!',
      confirmPassword: 'Nueva123!',
    });

    service.changePassword();

    expect(updates).toEqual(['user-1:Anterior123!:Nueva123!']);

    expect(successMessages).toContain('Contraseña actualizada correctamente.');
  });

  it('should detect an incorrect current password', () => {
    invalidCurrentPassword = true;

    service.form.setValue({
      currentPassword: 'Incorrecta123!',
      newPassword: 'Nueva123!',
      confirmPassword: 'Nueva123!',
    });

    service.changePassword();

    expect(service.form.controls.currentPassword.hasError('invalidCurrentPassword')).toBe(true);
  });
});
