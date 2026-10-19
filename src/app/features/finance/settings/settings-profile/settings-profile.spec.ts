import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { ToastService } from '../../../../shared/ui/toast/toast.service';
import { AuthService } from '../../../auth/services/auth.service';
import { SettingsPasswordService } from '../services/settings-password';
import { SettingsProfileService } from '../services/settings-profile';
import { SettingsProfile } from './settings-profile';

describe('SettingsProfile', () => {
  let fixture: ComponentFixture<SettingsProfile>;
  let profileService: SettingsProfileService;

  const currentUser = signal({
    id: 'user-1',
    username: 'usuario',
    email: 'usuario@example.com',
  });

  beforeEach(async () => {
    currentUser.set({
      id: 'user-1',
      username: 'usuario',
      email: 'usuario@example.com',
    });

    await TestBed.configureTestingModule({
      imports: [SettingsProfile],
      providers: [
        SettingsProfileService,
        SettingsPasswordService,
        {
          provide: AuthService,
          useValue: {
            currentUser,
            checkUsernameAvailability: () => of(true),
            checkEmailAvailability: () => of(true),
          },
        },
        {
          provide: ToastService,
          useValue: {
            success: () => undefined,
            error: () => undefined,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SettingsProfile);
    profileService = TestBed.inject(SettingsProfileService);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should display the current user', () => {
    const content = fixture.nativeElement.textContent as string;

    expect(content).toContain('usuario');
    expect(content).toContain('usuario@example.com');
  });

  it('should display the profile form fields', () => {
    const usernameInput = fixture.nativeElement.querySelector(
      '#settings-username',
    ) as HTMLInputElement;

    const emailInput = fixture.nativeElement.querySelector('#settings-email') as HTMLInputElement;

    expect(usernameInput).not.toBeNull();
    expect(emailInput).not.toBeNull();
  });

  it('should show an error when the username is required', () => {
    profileService.form.controls.username.setValue('');
    profileService.form.controls.username.markAsTouched();

    fixture.changeDetectorRef.markForCheck();
    fixture.detectChanges();

    const content = fixture.nativeElement.textContent as string;

    expect(content).toContain('El nombre de usuario es obligatorio.');
  });

  it('should detect changes in the profile', () => {
    expect(profileService.isProfileUnchanged()).toBe(true);

    profileService.form.controls.username.setValue('nuevo_usuario');

    expect(profileService.isProfileUnchanged()).toBe(false);
  });

  it('should restore the original profile when discarding changes', () => {
    profileService.form.controls.username.setValue('nuevo_usuario');
    profileService.form.controls.email.setValue('nuevo@example.com');

    profileService.discardChanges();

    expect(profileService.form.getRawValue()).toEqual({
      username: 'usuario',
      email: 'usuario@example.com',
    });

    expect(profileService.isProfileUnchanged()).toBe(true);
  });
});
