import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { PageHeader } from '../../../shared/ui/page-header/page-header';
import { BalanceEvolutionChart } from '../charts/balance-evolution-chart/balance-evolution-chart';
import { ExpenseDistributionChart } from '../charts/expense-distribution-chart/expense-distribution-chart';
import { IncomeExpenseChart } from '../charts/income-expense-chart/income-expense-chart';
import { ReportCategoryRanking } from './report-category-ranking/report-category-ranking';
import { ReportKpis } from './report-kpis/report-kpis';
import { ReportSummary } from './report-summary/report-summary';
import { ReportAnalysisService } from './services/report-analysis';
import { ReportChartDataService } from './services/report-chart-data';
import { ReportPdfService } from './services/report-pdf';
import { ReportStateService } from './services/report-state';

@Component({
  selector: 'app-reports',
  imports: [
    PageHeader,
    IncomeExpenseChart,
    ExpenseDistributionChart,
    BalanceEvolutionChart,
    ReportKpis,
    ReportCategoryRanking,
    ReportSummary,
  ],
  providers: [ReportStateService, ReportAnalysisService, ReportChartDataService, ReportPdfService],
  templateUrl: './reports.html',
  styleUrl: './reports.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Reports {
  private readonly state = inject(ReportStateService);
  private readonly analysis = inject(ReportAnalysisService);
  private readonly charts = inject(ReportChartDataService);
  private readonly reportPdfService = inject(ReportPdfService);

  protected readonly isLoading = this.state.isLoading;
  protected readonly loadError = this.state.loadError;
  protected readonly isExportingPdf = this.reportPdfService.isExportingPdf;
  protected readonly selectedPeriod = this.state.selectedPeriod;
  protected readonly selectedYear = this.state.selectedYear;
  protected readonly selectedCategoryIds = this.state.selectedCategoryIds;
  protected readonly selectedCategoryId = this.state.selectedCategoryId;
  protected readonly selectedPaymentMethod = this.state.selectedPaymentMethod;
  protected readonly comparisonEnabled = this.state.comparisonEnabled;
  protected readonly periodOptions = this.state.periodOptions;
  protected readonly paymentMethodOptions = this.state.paymentMethodOptions;
  protected readonly sortedCategories = this.state.sortedCategories;
  protected readonly availableYears = this.state.availableYears;
  protected readonly selectedCategoryLabel = this.state.selectedCategoryLabel;
  protected readonly selectedPaymentMethodLabel = this.state.selectedPaymentMethodLabel;
  protected readonly activeFilterCount = this.state.activeFilterCount;
  protected readonly generatedAtLabel = this.state.generatedAtLabel;

  protected readonly reportRangeLabel = this.analysis.reportRangeLabel;
  protected readonly previousReportRangeLabel = this.analysis.previousReportRangeLabel;
  protected readonly hasReportData = this.analysis.hasReportData;
  protected readonly totalExpenses = this.analysis.totalExpenses;
  protected readonly netBalance = this.analysis.netBalance;
  protected readonly formattedBalance = this.analysis.formattedBalance;

  protected readonly incomeExpenseHistory = this.charts.incomeExpenseHistory;
  protected readonly expenseDistribution = this.charts.expenseDistribution;
  protected readonly balanceEvolution = this.charts.balanceEvolution;
  protected readonly balanceCategorySeries = this.charts.balanceCategorySeries;

  protected changePeriod(event: Event): void {
    this.state.changePeriod(Number((event.target as HTMLSelectElement).value));
  }

  protected changeYear(event: Event): void {
    this.state.changeYear(Number((event.target as HTMLSelectElement).value));
  }

  protected changeCategory(event: Event): void {
    this.state.changeCategory((event.target as HTMLSelectElement).value);
  }

  protected changePaymentMethod(event: Event): void {
    this.state.changePaymentMethod((event.target as HTMLSelectElement).value);
  }

  protected toggleComparison(event: Event): void {
    this.state.toggleComparison((event.target as HTMLInputElement).checked);
  }

  protected clearAnalysisFilters(): void {
    this.state.clearAnalysisFilters();
  }

  protected exportReportPdf(): Promise<void> {
    if (!this.hasReportData()) {
      return Promise.resolve();
    }

    return this.reportPdfService.exportReportPdf(this.reportRangeLabel(), this.getExportFileName());
  }

  private getExportFileName(): string {
    const months = this.analysis.reportMonths();
    const start = months[0]?.key ?? 'inicio';
    const end = months[months.length - 1]?.key ?? 'fin';

    return `finora-informe-${start}-${end}.pdf`;
  }
}
