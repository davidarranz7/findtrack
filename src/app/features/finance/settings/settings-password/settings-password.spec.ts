import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';

import { ToastService } from '../../../../shared/ui/toast/toast.service';
import { AuthService } from '../../../auth/services/auth.service';
import { SettingsPasswordService } from '../services/settings-password';
import { SettingsPassword } from './settings-password';

describe('SettingsPassword', () => {
  let fixture: ComponentFixture<SettingsPassword>;
  let passwordService: SettingsPasswordService;

  let changePasswordCalls: {
    userId: string;
    currentPassword: string;
    newPassword: string;
  }[];

  let changePasswordResponse: Observable<void>;
  let successMessages: string[];
  let errorMessages: string[];

  const currentUser = signal({
    id: 'user-1',
    username: 'usuario',
    email: 'usuario@example.com',
  });

  beforeEach(async () => {
    changePasswordCalls = [];
    changePasswordResponse = of(undefined);
    successMessages = [];
    errorMessages = [];

    await TestBed.configureTestingModule({
      imports: [SettingsPassword],
      providers: [
        SettingsPasswordService,
        {
          provide: AuthService,
          useValue: {
            currentUser,
            changePassword: (
              userId: string,
              currentPassword: string,
              newPassword: string,
            ): Observable<void> => {
              changePasswordCalls.push({
                userId,
                currentPassword,
                newPassword,
              });

              return changePasswordResponse;
            },
          },
        },
        {
          provide: ToastService,
          useValue: {
            success: (message: string) => successMessages.push(message),
            error: (message: string) => errorMessages.push(message),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SettingsPassword);
    passwordService = TestBed.inject(SettingsPasswordService);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should open and close the password editor', () => {
    const openButton = fixture.nativeElement.querySelector(
      '.settings-secondary-action',
    ) as HTMLButtonElement;

    openButton.click();
    fixture.detectChanges();

    expect(passwordService.isPasswordEditorOpen()).toBe(true);
    expect(fixture.nativeElement.querySelector('.password-editor')).not.toBeNull();

    const cancelButton = fixture.nativeElement.querySelector(
      '.password-editor-actions .btn-outline-secondary',
    ) as HTMLButtonElement;

    cancelButton.click();
    fixture.detectChanges();

    expect(passwordService.isPasswordEditorOpen()).toBe(false);
    expect(fixture.nativeElement.querySelector('.password-editor')).toBeNull();
  });

  it('should reject a password without the required complexity', () => {
    passwordService.form.setValue({
      currentPassword: 'Anterior123!',
      newPassword: 'contrasena',
      confirmPassword: 'contrasena',
    });

    expect(passwordService.form.invalid).toBe(true);
    expect(passwordService.form.controls.newPassword.hasError('uppercase')).toBe(true);
    expect(passwordService.form.controls.newPassword.hasError('number')).toBe(true);
  });

  it('should update the password when the form is valid', () => {
    passwordService.form.setValue({
      currentPassword: 'Anterior123!',
      newPassword: 'Nueva123!',
      confirmPassword: 'Nueva123!',
    });

    passwordService.changePassword();

    expect(changePasswordCalls).toEqual([
      {
        userId: 'user-1',
        currentPassword: 'Anterior123!',
        newPassword: 'Nueva123!',
      },
    ]);

    expect(successMessages).toContain('Contraseña actualizada correctamente.');

    expect(passwordService.isPasswordEditorOpen()).toBe(false);
  });

  it('should report an incorrect current password', () => {
    changePasswordResponse = throwError(() => new Error('INVALID_CURRENT_PASSWORD'));

    passwordService.form.setValue({
      currentPassword: 'Incorrecta123!',
      newPassword: 'Nueva123!',
      confirmPassword: 'Nueva123!',
    });

    passwordService.changePassword();

    expect(passwordService.form.controls.currentPassword.hasError('invalidCurrentPassword')).toBe(
      true,
    );

    expect(successMessages).toEqual([]);
    expect(errorMessages).toEqual([]);
  });
});
