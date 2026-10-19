import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { AuthService } from '../../../auth/services/auth.service';
import { PreferencesService } from '../../services/preferences.service';
import { SettingsPreferencesService } from '../services/settings-preferences';
import { UserPreferences } from '../user-preferences';
import { SettingsPreferences } from './settings-preferences';

describe('SettingsPreferences', () => {
  let fixture: ComponentFixture<SettingsPreferences>;
  let preferencesService: SettingsPreferencesService;

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

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SettingsPreferences],
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
    }).compileComponents();

    fixture = TestBed.createComponent(SettingsPreferences);
    preferencesService = TestBed.inject(SettingsPreferencesService);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should display all preference fields', () => {
    const currency = fixture.nativeElement.querySelector('#settings-currency');
    const language = fixture.nativeElement.querySelector('#settings-language');
    const dateFormat = fixture.nativeElement.querySelector('#settings-date-format');

    expect(currency).not.toBeNull();
    expect(language).not.toBeNull();
    expect(dateFormat).not.toBeNull();
  });

  it('should load the saved preferences', () => {
    expect(preferencesService.preferences()).toEqual(savedPreferences);

    expect(preferencesService.form.getRawValue()).toEqual({
      currency: 'EUR',
      locale: 'es-ES',
      dateFormat: 'DD/MM/YYYY',
      budgetWarningEnabled: true,
      budgetExceededEnabled: true,
      savingsGoalEnabled: true,
    });
  });

  it('should detect changes in preferences', () => {
    expect(preferencesService.isPreferencesUnchanged()).toBe(true);

    preferencesService.form.controls.budgetWarningEnabled.setValue(false);

    expect(preferencesService.isPreferencesUnchanged()).toBe(false);
  });

  it('should restore saved preferences when discarding changes', () => {
    preferencesService.form.controls.budgetWarningEnabled.setValue(false);
    preferencesService.form.controls.savingsGoalEnabled.setValue(false);

    preferencesService.discardChanges();

    expect(preferencesService.form.controls.budgetWarningEnabled.value).toBe(true);
    expect(preferencesService.form.controls.savingsGoalEnabled.value).toBe(true);
    expect(preferencesService.isPreferencesUnchanged()).toBe(true);
  });
});
