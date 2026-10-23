import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { finalize, map, of, switchMap } from 'rxjs';

import { PageHeader } from '../../../shared/ui/page-header/page-header';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { AuthService } from '../../auth/services/auth.service';
import { PreferencesService } from '../services/preferences.service';
import { SettingsProfileService } from './services/settings-profile';
import { SettingsPreferencesService } from './services/settings-preferences';
import { SettingsPasswordService } from './services/settings-password';
import { SettingsProfile } from './components/settings-profile/settings-profile';
import { SettingsPreferences } from './components/settings-preferences/settings-preferences';
import { SettingsAlerts } from './components/settings-alerts/settings-alerts';

@Component({
  selector: 'app-settings',
  imports: [PageHeader, SettingsProfile, SettingsPreferences, SettingsAlerts],
  providers: [SettingsProfileService, SettingsPreferencesService, SettingsPasswordService],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Settings {
  private readonly authService = inject(AuthService);
  private readonly preferencesService = inject(PreferencesService);
  private readonly toastService = inject(ToastService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly profile = inject(SettingsProfileService);
  protected readonly preferencesState = inject(SettingsPreferencesService);

  protected readonly isSavingChanges = signal(false);

  protected readonly hasUnsavedChanges = computed(
    () => !this.profile.isProfileUnchanged() || !this.preferencesState.isPreferencesUnchanged(),
  );

  protected saveChanges(): void {
    if (this.profile.form.invalid || this.preferencesState.form.invalid) {
      this.profile.form.markAllAsTouched();
      this.preferencesState.form.markAllAsTouched();
      return;
    }

    if (
      !this.hasUnsavedChanges() ||
      this.profile.isCheckingAvailability() ||
      this.isSavingChanges()
    ) {
      return;
    }

    const user = this.authService.currentUser();
    const savedPreferences = this.preferencesState.preferences();

    if (!user || !savedPreferences) {
      return;
    }

    const profileChanged = !this.profile.isProfileUnchanged();
    const preferencesChanged = !this.preferencesState.isPreferencesUnchanged();
    const { username, email } = this.profile.form.getRawValue();

    this.isSavingChanges.set(true);

    const profileUpdate$ = profileChanged
      ? this.authService.updateProfile(user.id, { username, email })
      : of(user);

    profileUpdate$
      .pipe(
        switchMap((updatedUser) => {
          if (!preferencesChanged) {
            return of({
              updatedUser,
              updatedPreferences: savedPreferences,
            });
          }

          return this.preferencesService
            .updatePreferences(savedPreferences.id, this.preferencesState.form.getRawValue())
            .pipe(
              map((updatedPreferences) => ({
                updatedUser,
                updatedPreferences,
              })),
            );
        }),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isSavingChanges.set(false)),
      )
      .subscribe({
        next: ({ updatedUser, updatedPreferences }) => {
          this.preferencesState.setSavedPreferences(updatedPreferences);

          this.profile.applySavedProfile(updatedUser.username, updatedUser.email);

          this.preferencesState.form.markAsPristine();

          this.toastService.success('Configuración guardada correctamente.');
        },
        error: (error: Error) => {
          if (!this.profile.handleSaveError(error)) {
            this.toastService.error('No se ha podido guardar la configuración.');
          }
        },
      });
  }

  protected discardChanges(): void {
    this.profile.discardChanges();
    this.preferencesState.discardChanges();
  }

  protected logout(): void {
    this.authService.clearCurrentUser();
    void this.router.navigate(['/login']);
  }
}
