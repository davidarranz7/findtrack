import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';

import { SettingsPasswordService } from '../../services/settings-password';

@Component({
  selector: 'app-settings-password',
  imports: [ReactiveFormsModule],
  templateUrl: './settings-password.html',
  styleUrl: './settings-password.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPassword {
  protected readonly password = inject(SettingsPasswordService);
}
