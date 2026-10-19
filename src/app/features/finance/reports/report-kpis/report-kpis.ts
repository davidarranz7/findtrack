import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { ReportAnalysisService } from '../services/report-analysis';
import { ReportStateService } from '../services/report-state';

@Component({
  selector: 'app-report-kpis',
  imports: [],
  templateUrl: './report-kpis.html',
  styleUrl: './report-kpis.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportKpis {
  protected readonly analysis = inject(ReportAnalysisService);
  protected readonly state = inject(ReportStateService);
}
