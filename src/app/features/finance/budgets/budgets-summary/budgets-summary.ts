import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { BudgetAnalysisService } from '../../services/budget-analysis.service';
import { BudgetsStateService } from '../services/budgets-state';
import {
  formatBudgetCurrency,
  formatBudgetMonth,
  formatBudgetPercentage,
} from '../utils/budget-format.utils';

@Component({
  selector: 'app-budgets-summary',
  templateUrl: './budgets-summary.html',
  styleUrl: './budgets-summary.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BudgetsSummary {
  protected readonly state = inject(BudgetsStateService);
  private readonly budgetAnalysisService = inject(BudgetAnalysisService);

  protected readonly formatCurrency = formatBudgetCurrency;
  protected readonly formatPercentage = formatBudgetPercentage;

  protected readonly selectedMonthLabel = computed(() =>
    formatBudgetMonth(this.state.selectedMonth()),
  );

  private readonly budgetProgress = computed(() =>
    this.budgetAnalysisService.getBudgetProgress(
      this.state.budgets(),
      this.state.transactions(),
      this.state.categories(),
      this.state.selectedMonth(),
    ),
  );

  protected readonly totalBudget = computed(() =>
    this.state.budgets().reduce((total, budget) => total + budget.amount, 0),
  );

  protected readonly totalSpent = computed(() =>
    this.budgetProgress().reduce((total, budget) => total + budget.spent, 0),
  );

  protected readonly totalRemaining = computed(() => this.totalBudget() - this.totalSpent());

  protected readonly totalPercentage = computed(() => {
    const totalBudget = this.totalBudget();

    return totalBudget > 0 ? (this.totalSpent() / totalBudget) * 100 : 0;
  });
}
