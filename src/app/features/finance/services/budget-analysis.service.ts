import { Injectable } from '@angular/core';

import { Budget, Category, Transaction } from '../models';

export type BudgetStatus = 'safe' | 'warning' | 'exceeded';

export type BudgetAlertStatus = 'none' | 'safe' | 'warning' | 'exceeded';

export interface BudgetProgressItem {
  budgetId: string;
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  limit: number;
  spent: number;
  remaining: number;
  percentage: number;
  status: BudgetStatus;
}

export interface BudgetAlertState {
  status: BudgetAlertStatus;
  budget: BudgetProgressItem | null;
}

@Injectable({
  providedIn: 'root',
})
export class BudgetAnalysisService {
  getBudgetProgress(
    budgets: Budget[],
    transactions: Transaction[],
    categories: Category[],
    month: string,
  ): BudgetProgressItem[] {
    const expenses = transactions.filter(
      (transaction) => transaction.type === 'expense' && transaction.date.startsWith(month),
    );

    return budgets
      .map((budget) => {
        const category = categories.find(
          (currentCategory) => currentCategory.id === budget.categoryId,
        );

        const spent = expenses
          .filter((transaction) => transaction.categoryId === budget.categoryId)
          .reduce((total, transaction) => total + transaction.amount, 0);

        const percentage = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;

        let status: BudgetStatus = 'safe';

        if (percentage >= 100) {
          status = 'exceeded';
        } else if (percentage >= 80) {
          status = 'warning';
        }

        return {
          budgetId: budget.id,
          categoryId: budget.categoryId,
          categoryName: category?.name ?? 'Sin categoría',
          categoryColor: category?.color ?? '#6c757d',
          limit: budget.amount,
          spent,
          remaining: budget.amount - spent,
          percentage,
          status,
        };
      })
      .sort((firstBudget, secondBudget) => secondBudget.percentage - firstBudget.percentage);
  }

  getBudgetAlert(budgets: BudgetProgressItem[]): BudgetAlertState {
    if (budgets.length === 0) {
      return {
        status: 'none',
        budget: null,
      };
    }

    const exceededBudget = budgets.find((budget) => budget.status === 'exceeded');

    if (exceededBudget) {
      return {
        status: 'exceeded',
        budget: exceededBudget,
      };
    }

    const warningBudget = budgets.find((budget) => budget.status === 'warning');

    if (warningBudget) {
      return {
        status: 'warning',
        budget: warningBudget,
      };
    }

    return {
      status: 'safe',
      budget: budgets[0],
    };
  }
}
