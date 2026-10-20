import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { OverviewAnalysisService } from '../services/overview-analysis';
import { OverviewStateService } from '../services/overview-state';

@Component({
  selector: 'app-overview-summary',
  templateUrl: './overview-summary.html',
  styleUrl: './overview-summary.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OverviewSummary {
  protected readonly state = inject(OverviewStateService);
  protected readonly analysis = inject(OverviewAnalysisService);
}
