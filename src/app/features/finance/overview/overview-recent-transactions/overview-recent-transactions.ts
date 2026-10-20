import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { OverviewAnalysisService } from '../services/overview-analysis';
import { OverviewStateService } from '../services/overview-state';

@Component({
  selector: 'app-overview-recent-transactions',
  imports: [RouterLink],
  templateUrl: './overview-recent-transactions.html',
  styleUrl: './overview-recent-transactions.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OverviewRecentTransactions {
  protected readonly state = inject(OverviewStateService);
  protected readonly analysis = inject(OverviewAnalysisService);
}
