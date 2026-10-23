import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { ReportAnalysisService } from '../../services/report-analysis';
import { ReportChartDataService } from '../../services/report-chart-data';

@Component({
  selector: 'app-report-summary',
  imports: [],
  templateUrl: './report-summary.html',
  styleUrl: './report-summary.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportSummary {
  protected readonly analysis = inject(ReportAnalysisService);
  protected readonly charts = inject(ReportChartDataService);
}
