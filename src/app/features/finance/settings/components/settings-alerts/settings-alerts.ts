import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';

import { SettingsPreferencesService } from '../../services/settings-preferences';

@Component({
  selector: 'app-settings-alerts',
  imports: [ReactiveFormsModule],
  templateUrl: './settings-alerts.html',
  styleUrl: './settings-alerts.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsAlerts {
  protected readonly preferences = inject(SettingsPreferencesService);
}
