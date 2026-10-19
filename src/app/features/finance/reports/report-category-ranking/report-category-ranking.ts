import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { ReportAnalysisService } from '../services/report-analysis';
import { ReportChartDataService } from '../services/report-chart-data';
import { ReportStateService } from '../services/report-state';

@Component({
  selector: 'app-report-category-ranking',
  imports: [],
  templateUrl: './report-category-ranking.html',
  styleUrl: './report-category-ranking.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportCategoryRanking {
  protected readonly state = inject(ReportStateService);
  protected readonly analysis = inject(ReportAnalysisService);
  protected readonly charts = inject(ReportChartDataService);
}
