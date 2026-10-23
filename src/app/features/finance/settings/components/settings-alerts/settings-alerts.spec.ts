import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { AuthService } from '../../../../auth/services/auth.service';
import { PreferencesService } from '../../../services/preferences.service';
import { SettingsPreferencesService } from '../../services/settings-preferences';
import { UserPreferences } from '../../user-preferences';
import { SettingsAlerts } from './settings-alerts';

describe('SettingsAlerts', () => {
  let fixture: ComponentFixture<SettingsAlerts>;
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
    budgetExceededEnabled: false,
    savingsGoalEnabled: true,
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SettingsAlerts],
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

    fixture = TestBed.createComponent(SettingsAlerts);
    preferencesService = TestBed.inject(SettingsPreferencesService);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should display the three notification switches', () => {
    const warning = fixture.nativeElement.querySelector('#budget-warning-enabled');
    const exceeded = fixture.nativeElement.querySelector('#budget-exceeded-enabled');
    const savings = fixture.nativeElement.querySelector('#savings-goal-enabled');

    expect(warning).not.toBeNull();
    expect(exceeded).not.toBeNull();
    expect(savings).not.toBeNull();
  });

  it('should reflect the saved notification preferences', () => {
    const warning = fixture.nativeElement.querySelector(
      '#budget-warning-enabled',
    ) as HTMLInputElement;

    const exceeded = fixture.nativeElement.querySelector(
      '#budget-exceeded-enabled',
    ) as HTMLInputElement;

    const savings = fixture.nativeElement.querySelector(
      '#savings-goal-enabled',
    ) as HTMLInputElement;

    expect(warning.checked).toBe(true);
    expect(exceeded.checked).toBe(false);
    expect(savings.checked).toBe(true);
  });

  it('should update the shared preferences form when a switch changes', () => {
    const warning = fixture.nativeElement.querySelector(
      '#budget-warning-enabled',
    ) as HTMLInputElement;

    expect(preferencesService.isPreferencesUnchanged()).toBe(true);

    warning.click();
    fixture.detectChanges();

    expect(preferencesService.form.controls.budgetWarningEnabled.value).toBe(false);
    expect(preferencesService.isPreferencesUnchanged()).toBe(false);
  });

  it('should restore the notification switches when discarding changes', () => {
    preferencesService.form.controls.budgetWarningEnabled.setValue(false);
    preferencesService.form.controls.savingsGoalEnabled.setValue(false);

    preferencesService.discardChanges();
    fixture.detectChanges();

    const warning = fixture.nativeElement.querySelector(
      '#budget-warning-enabled',
    ) as HTMLInputElement;

    const savings = fixture.nativeElement.querySelector(
      '#savings-goal-enabled',
    ) as HTMLInputElement;

    expect(warning.checked).toBe(true);
    expect(savings.checked).toBe(true);
    expect(preferencesService.isPreferencesUnchanged()).toBe(true);
  });
});
