import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';

import { SettingsProfileService } from '../services/settings-profile';
import { SettingsPassword } from '../settings-password/settings-password';

@Component({
  selector: 'app-settings-profile',
  imports: [ReactiveFormsModule, SettingsPassword],
  templateUrl: './settings-profile.html',
  styleUrl: './settings-profile.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsProfile {
  protected readonly profile = inject(SettingsProfileService);
}
