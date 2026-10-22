import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { ExpenseDistributionChart } from '../../../charts/expense-distribution-chart/expense-distribution-chart';
import { IncomeExpenseChart } from '../../../charts/income-expense-chart/income-expense-chart';
import { OverviewAnalysisService } from '../../services/overview-analysis';
import { OverviewStateService } from '../../services/overview-state';

@Component({
  selector: 'app-overview-charts',
  imports: [IncomeExpenseChart, ExpenseDistributionChart],
  templateUrl: './overview-charts.html',
  styleUrl: './overview-charts.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OverviewCharts {
  protected readonly state = inject(OverviewStateService);
  protected readonly analysis = inject(OverviewAnalysisService);
}
