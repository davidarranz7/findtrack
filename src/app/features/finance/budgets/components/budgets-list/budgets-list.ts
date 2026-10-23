import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';

import { Budget, Category } from '../../../models';
import { BudgetAnalysisService } from '../../../services/budget-analysis.service';
import { BudgetsStateService } from '../../services/budgets-state';
import {
  formatBudgetCurrency,
  formatBudgetMonth,
  formatBudgetPercentage,
} from '../../utils/budget-format.utils';

type BudgetListStatus = 'normal' | 'warning' | 'exceeded';

interface BudgetListItem {
  budget: Budget;
  category: Category | null;
  spent: number;
  remaining: number;
  percentage: number;
  progressBarPercentage: number;
  status: BudgetListStatus;
}

@Component({
  selector: 'app-budgets-list',
  templateUrl: './budgets-list.html',
  styleUrl: './budgets-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BudgetsList {
  protected readonly state = inject(BudgetsStateService);
  private readonly analysis = inject(BudgetAnalysisService);

  readonly isDeletingBudget = input(false);

  readonly createRequested = output<void>();
  readonly editRequested = output<Budget>();
  readonly deleteRequested = output<Budget>();

  protected readonly formatCurrency = formatBudgetCurrency;
  protected readonly formatPercentage = formatBudgetPercentage;

  protected readonly selectedMonthLabel = computed(() =>
    formatBudgetMonth(this.state.selectedMonth()),
  );

  private readonly budgetProgress = computed(() =>
    this.analysis.getBudgetProgress(
      this.state.budgets(),
      this.state.transactions(),
      this.state.categories(),
      this.state.selectedMonth(),
    ),
  );

  protected readonly budgetItems = computed<BudgetListItem[]>(() => {
    const progressById = new Map(this.budgetProgress().map((item) => [item.budgetId, item]));

    return this.state.budgets().map((budget) => {
      const progress = progressById.get(budget.id);

      const category =
        this.state.categories().find((item) => item.id === budget.categoryId) ?? null;

      const percentage = progress?.percentage ?? 0;

      const status: BudgetListStatus =
        progress?.status === 'safe' ? 'normal' : (progress?.status ?? 'normal');

      return {
        budget,
        category,
        spent: progress?.spent ?? 0,
        remaining: progress?.remaining ?? budget.amount,
        percentage,
        progressBarPercentage: Math.min(percentage, 100),
        status,
      };
    });
  });
}
