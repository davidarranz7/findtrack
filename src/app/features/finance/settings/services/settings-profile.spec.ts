import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { AuthService } from '../../../auth/services/auth.service';
import { SettingsProfileService } from './settings-profile';

describe('SettingsProfileService', () => {
  let service: SettingsProfileService;

  const currentUser = signal({
    id: 'user-1',
    username: 'usuario',
    email: 'usuario@example.com',
  });

  beforeEach(() => {
    currentUser.set({
      id: 'user-1',
      username: 'usuario',
      email: 'usuario@example.com',
    });

    TestBed.configureTestingModule({
      providers: [
        SettingsProfileService,
        {
          provide: AuthService,
          useValue: {
            currentUser,
            checkUsernameAvailability: () => of(true),
            checkEmailAvailability: () => of(true),
          },
        },
      ],
    });

    service = TestBed.inject(SettingsProfileService);
  });

  it('should create', () => {
    expect(service).toBeTruthy();
  });

  it('should initialize the profile form', () => {
    expect(service.form.getRawValue()).toEqual({
      username: 'usuario',
      email: 'usuario@example.com',
    });
  });

  it('should detect profile changes', () => {
    expect(service.isProfileUnchanged()).toBe(true);

    service.form.controls.username.setValue('nuevo_usuario');

    expect(service.isProfileUnchanged()).toBe(false);
  });

  it('should discard profile changes', () => {
    service.form.controls.username.setValue('nuevo_usuario');
    service.form.controls.email.setValue('nuevo@example.com');

    service.discardChanges();

    expect(service.form.getRawValue()).toEqual({
      username: 'usuario',
      email: 'usuario@example.com',
    });

    expect(service.isProfileUnchanged()).toBe(true);
  });

  it('should handle an existing username', () => {
    const handled = service.handleSaveError(new Error('USERNAME_ALREADY_EXISTS'));

    expect(handled).toBe(true);

    expect(service.form.controls.username.hasError('usernameTaken')).toBe(true);

    expect(service.usernameAvailability()).toBe('unavailable');
  });

  it('should synchronize the saved profile', () => {
    currentUser.set({
      id: 'user-1',
      username: 'nuevo_usuario',
      email: 'nuevo@example.com',
    });

    service.applySavedProfile('nuevo_usuario', 'nuevo@example.com');

    expect(service.isProfileUnchanged()).toBe(true);
    expect(service.form.pristine).toBe(true);
  });
});
