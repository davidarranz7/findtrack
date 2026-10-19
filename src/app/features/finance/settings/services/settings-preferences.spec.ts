import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { AuthService } from '../../../auth/services/auth.service';
import { PreferencesService } from '../../services/preferences.service';
import { UserPreferences } from '../user-preferences';
import { SettingsPreferencesService } from './settings-preferences';

describe('SettingsPreferencesService', () => {
  let service: SettingsPreferencesService;

  const currentUser = signal({
    id: 'user-1',
    username: 'usuario',
    email: 'usuario@example.com',
  });

  const savedPreferences: UserPreferences = {
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

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        SettingsPreferencesService,
        {
          provide: AuthService,
          useValue: {
            currentUser,
          },
        },
        {
          provide: PreferencesService,
          useValue: {
            getOrCreatePreferences: () => of({ ...savedPreferences }),
          },
        },
      ],
    });

    service = TestBed.inject(SettingsPreferencesService);
  });

  it('should create', () => {
    expect(service).toBeTruthy();
  });

  it('should load preferences', () => {
    expect(service.preferences()).toEqual(savedPreferences);
    expect(service.isLoadingPreferences()).toBe(false);
    expect(service.preferencesLoadError()).toBeNull();
  });

  it('should detect changes in the form', () => {
    expect(service.isPreferencesUnchanged()).toBe(true);

    service.form.controls.budgetWarningEnabled.setValue(false);

    expect(service.isPreferencesUnchanged()).toBe(false);
  });

  it('should restore preferences when discarding changes', () => {
    service.form.controls.budgetWarningEnabled.setValue(false);
    service.form.controls.savingsGoalEnabled.setValue(false);

    service.discardChanges();

    expect(service.form.controls.budgetWarningEnabled.value).toBe(true);
    expect(service.form.controls.savingsGoalEnabled.value).toBe(true);
    expect(service.isPreferencesUnchanged()).toBe(true);
  });
});
