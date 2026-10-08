export type AppTheme = 'system' | 'light' | 'dark';

export interface UserPreferences {
  id: string;
  userId: string;
  currency: 'EUR';
  locale: 'es-ES';
  dateFormat: 'DD/MM/YYYY';
  theme: AppTheme;
  budgetWarningEnabled: boolean;
  budgetExceededEnabled: boolean;
  savingsGoalEnabled: boolean;
}
