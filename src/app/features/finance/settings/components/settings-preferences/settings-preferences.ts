import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';

import { SettingsPreferencesService } from '../../services/settings-preferences';

@Component({
  selector: 'app-settings-preferences',
  imports: [ReactiveFormsModule],
  templateUrl: './settings-preferences.html',
  styleUrl: './settings-preferences.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPreferences {
  protected readonly preferences = inject(SettingsPreferencesService);
}
