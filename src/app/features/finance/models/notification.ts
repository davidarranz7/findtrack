export type NotificationType = 'budgetWarning' | 'budgetExceeded' | 'savingsGoal' | 'budgetUpdated';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  createdAt: string;
  isRead: boolean;
  eventKey: string;
  budgetId: string | null;
  categoryId: string | null;
}
