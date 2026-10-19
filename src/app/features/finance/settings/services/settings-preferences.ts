import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder } from '@angular/forms';
import { finalize } from 'rxjs';

import { AuthService } from '../../../auth/services/auth.service';
import { PreferencesService } from '../../services/preferences.service';
import { UserPreferences } from '../user-preferences';

@Injectable()
export class SettingsPreferencesService {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly preferencesService = inject(PreferencesService);
  private readonly destroyRef = inject(DestroyRef);

  readonly preferences = signal<UserPreferences | null>(null);
  readonly isLoadingPreferences = signal(true);
  readonly preferencesLoadError = signal<string | null>(null);

  readonly currencyOptions = [
    {
      value: 'EUR',
      label: 'EUR - Euro (€)',
    },
  ] as const;

  readonly localeOptions = [
    {
      value: 'es-ES',
      label: 'Español',
    },
  ] as const;

  readonly dateFormatOptions = [
    {
      value: 'DD/MM/YYYY',
      label: 'DD/MM/YYYY',
    },
  ] as const;

  readonly form = this.formBuilder.nonNullable.group({
    currency: ['EUR' as const],
    locale: ['es-ES' as const],
    dateFormat: ['DD/MM/YYYY' as const],
    budgetWarningEnabled: [true],
    budgetExceededEnabled: [true],
    savingsGoalEnabled: [true],
  });

  private readonly preferencesValue = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });

  readonly isPreferencesUnchanged = computed(() => {
    const savedPreferences = this.preferences();

    if (!savedPreferences) {
      return true;
    }

    const currentPreferences = this.preferencesValue();

    return (
      currentPreferences.currency === savedPreferences.currency &&
      currentPreferences.locale === savedPreferences.locale &&
      currentPreferences.dateFormat === savedPreferences.dateFormat &&
      currentPreferences.budgetWarningEnabled === savedPreferences.budgetWarningEnabled &&
      currentPreferences.budgetExceededEnabled === savedPreferences.budgetExceededEnabled &&
      currentPreferences.savingsGoalEnabled === savedPreferences.savingsGoalEnabled
    );
  });

  constructor() {
    this.loadPreferences();
  }

  setSavedPreferences(preferences: UserPreferences): void {
    this.preferences.set(preferences);
  }

  discardChanges(): void {
    const savedPreferences = this.preferences();

    if (savedPreferences) {
      this.form.reset({
        currency: savedPreferences.currency,
        locale: savedPreferences.locale,
        dateFormat: savedPreferences.dateFormat,
        budgetWarningEnabled: savedPreferences.budgetWarningEnabled,
        budgetExceededEnabled: savedPreferences.budgetExceededEnabled,
        savingsGoalEnabled: savedPreferences.savingsGoalEnabled,
      });
    }

    this.form.markAsPristine();
  }

  private loadPreferences(): void {
    const userId = this.authService.currentUser()?.id;

    if (!userId) {
      this.isLoadingPreferences.set(false);
      this.preferencesLoadError.set('No se ha podido identificar al usuario actual.');
      return;
    }

    this.isLoadingPreferences.set(true);
    this.preferencesLoadError.set(null);

    this.preferencesService
      .getOrCreatePreferences(userId)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isLoadingPreferences.set(false)),
      )
      .subscribe({
        next: (preferences) => {
          this.preferences.set(preferences);

          this.form.setValue({
            currency: preferences.currency,
            locale: preferences.locale,
            dateFormat: preferences.dateFormat,
            budgetWarningEnabled: preferences.budgetWarningEnabled,
            budgetExceededEnabled: preferences.budgetExceededEnabled,
            savingsGoalEnabled: preferences.savingsGoalEnabled,
          });

          this.form.markAsPristine();
        },
        error: () => {
          this.preferencesLoadError.set('No se han podido cargar tus preferencias.');
        },
      });
  }
}
