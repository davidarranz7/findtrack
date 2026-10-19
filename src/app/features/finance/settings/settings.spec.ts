import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, tap, throwError } from 'rxjs';

import { ToastService } from '../../../shared/ui/toast/toast.service';
import { AuthService } from '../../auth/services/auth.service';
import { PreferencesService } from '../services/preferences.service';
import { SettingsPreferencesService } from './services/settings-preferences';
import { SettingsProfileService } from './services/settings-profile';
import { Settings } from './settings';
import { UserPreferences } from './user-preferences';

describe('Settings', () => {
  let fixture: ComponentFixture<Settings>;
  let profile: SettingsProfileService;
  let preferences: SettingsPreferencesService;

  const initialUser = {
    id: 'user-1',
    username: 'usuario',
    email: 'usuario@example.com',
  };

  const currentUser = signal<typeof initialUser | null>(initialUser);

  const initialPreferences: UserPreferences = {
    id: 'preferences-1',
    userId: 'user-1',
    currency: 'EUR',
    locale: 'es-ES',
    dateFormat: 'DD/MM/YYYY',
    theme: 'light',
    budgetWarningEnabled: true,
    budgetExceededEnabled: true,
    savingsGoalEnabled: true,
  };

  let profileUpdates: {
    userId: string;
    username: string;
    email: string;
  }[];

  let preferenceUpdates: {
    preferencesId: string;
    changes: Partial<UserPreferences>;
  }[];

  let profileError: Error | null;
  let successMessages: string[];
  let errorMessages: string[];

  beforeEach(async () => {
    currentUser.set({ ...initialUser });
    profileUpdates = [];
    preferenceUpdates = [];
    profileError = null;
    successMessages = [];
    errorMessages = [];

    await TestBed.configureTestingModule({
      imports: [Settings],
      providers: [
        {
          provide: AuthService,
          useValue: {
            currentUser,
            checkUsernameAvailability: () => of(true),
            checkEmailAvailability: () => of(true),
            changePassword: () => of(undefined),
            clearCurrentUser: () => currentUser.set(null),
            updateProfile: (userId: string, data: { username: string; email: string }) => {
              profileUpdates.push({ userId, ...data });

              if (profileError) {
                return throwError(() => profileError);
              }

              const updatedUser = {
                id: userId,
                username: data.username.trim(),
                email: data.email.trim().toLowerCase(),
              };

              return of(updatedUser).pipe(tap((user) => currentUser.set(user)));
            },
          },
        },
        {
          provide: PreferencesService,
          useValue: {
            getOrCreatePreferences: () => of({ ...initialPreferences }),
            updatePreferences: (preferencesId: string, changes: Partial<UserPreferences>) => {
              preferenceUpdates.push({ preferencesId, changes });

              return of({
                ...initialPreferences,
                ...changes,
              });
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
        {
          provide: Router,
          useValue: {
            navigate: () => Promise.resolve(true),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Settings);
    profile = fixture.debugElement.injector.get(SettingsProfileService);
    preferences = fixture.debugElement.injector.get(SettingsPreferencesService);

    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render the three settings cards', () => {
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('.settings-profile-card')).not.toBeNull();
    expect(element.querySelector('.settings-preferences-card')).not.toBeNull();
    expect(element.querySelector('.settings-alerts-card')).not.toBeNull();
  });

  it('should save profile and preferences together', () => {
    profile.form.controls.username.setValue('nuevo_usuario');
    preferences.form.controls.budgetWarningEnabled.setValue(false);

    fixture.detectChanges();

    const saveButton = fixture.nativeElement.querySelector(
      '.settings-header-actions .btn-primary',
    ) as HTMLButtonElement;

    saveButton.click();
    fixture.detectChanges();

    expect(profileUpdates).toEqual([
      {
        userId: 'user-1',
        username: 'nuevo_usuario',
        email: 'usuario@example.com',
      },
    ]);

    expect(preferenceUpdates.length).toBe(1);
    expect(preferenceUpdates[0].preferencesId).toBe('preferences-1');
    expect(preferenceUpdates[0].changes.budgetWarningEnabled).toBe(false);

    expect(profile.isProfileUnchanged()).toBe(true);
    expect(preferences.isPreferencesUnchanged()).toBe(true);

    expect(successMessages).toContain('Configuración guardada correctamente.');

    expect(saveButton.disabled).toBe(true);
  });

  it('should save preferences without updating the profile', () => {
    preferences.form.controls.savingsGoalEnabled.setValue(false);

    fixture.detectChanges();

    const saveButton = fixture.nativeElement.querySelector(
      '.settings-header-actions .btn-primary',
    ) as HTMLButtonElement;

    saveButton.click();

    expect(profileUpdates.length).toBe(0);
    expect(preferenceUpdates.length).toBe(1);
    expect(preferenceUpdates[0].changes.savingsGoalEnabled).toBe(false);
  });

  it('should discard changes in both forms', () => {
    profile.form.controls.username.setValue('otro_usuario');
    preferences.form.controls.budgetExceededEnabled.setValue(false);

    fixture.detectChanges();

    const discardButton = fixture.nativeElement.querySelector(
      '.settings-header-actions .btn-outline-secondary',
    ) as HTMLButtonElement;

    discardButton.click();
    fixture.detectChanges();

    expect(profile.form.controls.username.value).toBe('usuario');
    expect(preferences.form.controls.budgetExceededEnabled.value).toBe(true);
    expect(profile.isProfileUnchanged()).toBe(true);
    expect(preferences.isPreferencesUnchanged()).toBe(true);

    expect(profileUpdates.length).toBe(0);
    expect(preferenceUpdates.length).toBe(0);
  });

  it('should disable saving when the profile is invalid', () => {
    profile.form.controls.username.setValue('');

    fixture.detectChanges();

    const saveButton = fixture.nativeElement.querySelector(
      '.settings-header-actions .btn-primary',
    ) as HTMLButtonElement;

    expect(saveButton.disabled).toBe(true);
  });

  it('should show an error when the username already exists', () => {
    profileError = new Error('USERNAME_ALREADY_EXISTS');

    profile.form.controls.username.setValue('usuario_ocupado');

    fixture.detectChanges();

    const saveButton = fixture.nativeElement.querySelector(
      '.settings-header-actions .btn-primary',
    ) as HTMLButtonElement;

    saveButton.click();
    fixture.detectChanges();

    expect(profile.form.controls.username.hasError('usernameTaken')).toBe(true);
    expect(profile.usernameAvailability()).toBe('unavailable');
    expect(successMessages).toEqual([]);
    expect(preferenceUpdates.length).toBe(0);
  });
});
