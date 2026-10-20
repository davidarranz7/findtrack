import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { OverviewAnalysisService } from '../services/overview-analysis';
import { OverviewStateService } from '../services/overview-state';

@Component({
  selector: 'app-overview-budgets',
  templateUrl: './overview-budgets.html',
  styleUrl: './overview-budgets.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OverviewBudgets {
  protected readonly state = inject(OverviewStateService);
  protected readonly analysis = inject(OverviewAnalysisService);
}
