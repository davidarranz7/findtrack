import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { PageHeader } from '../../../shared/ui/page-header/page-header';
import { Transaction } from '../models';
import { TransactionForm } from '../transactions/transaction-form/transaction-form';
import { OverviewBudgets } from './components/overview-budgets/overview-budgets';
import { OverviewCharts } from './components/overview-charts/overview-charts';
import { OverviewRecentTransactions } from './components/overview-recent-transactions/overview-recent-transactions';
import { OverviewSummary } from './components/overview-summary/overview-summary';
import { OverviewAnalysisService } from './services/overview-analysis';
import { OverviewStateService } from './services/overview-state';

@Component({
  selector: 'app-overview',
  imports: [
    PageHeader,
    TransactionForm,
    OverviewSummary,
    OverviewCharts,
    OverviewBudgets,
    OverviewRecentTransactions,
  ],
  providers: [OverviewStateService, OverviewAnalysisService],
  templateUrl: './overview.html',
  styleUrl: './overview.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Overview {
  protected readonly state = inject(OverviewStateService);
  protected readonly analysis = inject(OverviewAnalysisService);

  protected readonly isTransactionFormOpen = signal(false);

  protected openTransactionForm(): void {
    this.isTransactionFormOpen.set(true);
  }

  protected closeTransactionForm(): void {
    this.isTransactionFormOpen.set(false);
  }

  protected handleTransactionCreated(transaction: Transaction): void {
    this.state.addTransaction(transaction);
    this.closeTransactionForm();
  }
}
