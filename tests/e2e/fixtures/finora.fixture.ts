import { test as base, expect, type APIRequestContext, type Page } from '@playwright/test';

export const E2E_API_URL = 'http://127.0.0.1:3001';
const E2E_APP_URL = 'http://127.0.0.1:4201';

export interface TestUser {
  id: string;
  username: string;
  email: string;
  password: string;
}
export interface TestCategory {
  id: string;
  userId: string;
  name: string;
  color: string;
  icon: string;
}
export interface TestTransaction {
  id: string;
  userId: string;
  type: 'expense' | 'income';
  amount: number;
  description: string;
  categoryId: string | null;
  date: string;
  paymentMethod: 'card' | 'cash' | 'bankTransfer';
  notes: string;
}
export interface TestBudget {
  id: string;
  userId: string;
  categoryId: string;
  amount: number;
  month: string;
}
export interface TestNotification {
  id: string;
  userId: string;
  title: string;
  type: 'budgetWarning' | 'budgetExceeded';
  message: string;
  createdAt: string;
  isRead: boolean;
  eventKey: string;
  budgetId: string | null;
  categoryId: string | null;
}

const nonce = () => `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
export const today = () => {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Europe/Madrid',
  }).format(new Date());
};
export const monthNow = () => today().slice(0, 7);

export class FinoraData {
  private readonly ownedUsers = new Set<string>();
  constructor(private readonly request: APIRequestContext) {}

  async create<T extends { id: string }>(collection: string, data: object): Promise<T> {
    const response = await this.request.post(`${E2E_API_URL}/${collection}`, { data });
    expect(response.ok(), `POST E2E /${collection}: ${response.status()}`).toBeTruthy();
    return (await response.json()) as T;
  }

  async get<T>(collection: string, id: string): Promise<T> {
    const response = await this.request.get(
      `${E2E_API_URL}/${collection}/${encodeURIComponent(id)}`,
    );
    expect(response.ok(), `GET E2E /${collection}/${id}: ${response.status()}`).toBeTruthy();
    return (await response.json()) as T;
  }

  async list<T>(collection: string, userId: string): Promise<T[]> {
    const url = `${E2E_API_URL}/${collection}?userId=${encodeURIComponent(userId)}`;
    const response = await this.request.get(url);
    expect(response.ok(), `GET E2E /${collection}: ${response.status()}`).toBeTruthy();
    return (await response.json()) as T[];
  }

  trackUser(id: string) {
    this.ownedUsers.add(id);
  }

  async createUser(overrides: Partial<Omit<TestUser, 'id'>> = {}): Promise<TestUser> {
    const unique = nonce();
    const user = await this.create<TestUser>('users', {
      username: `e2e_${unique}`,
      email: `e2e_${unique}@example.test`,
      password: 'E2Epass123!',
      ...overrides,
    });
    this.ownedUsers.add(user.id);
    return user;
  }

  async category(user: TestUser, overrides: Partial<Omit<TestCategory, 'id' | 'userId'>> = {}) {
    return this.create<TestCategory>('categories', {
      userId: user.id,
      name: `Categoría ${nonce()}`,
      icon: 'bi-tag',
      color: '#2563eb',
      ...overrides,
    });
  }

  async transaction(
    user: TestUser,
    overrides: Partial<Omit<TestTransaction, 'id' | 'userId'>> = {},
  ) {
    return this.create<TestTransaction>('transactions', {
      userId: user.id,
      type: 'expense',
      amount: 12.5,
      description: `Compra ${nonce()}`,
      categoryId: null,
      date: today(),
      paymentMethod: 'card',
      notes: '',
      ...overrides,
    });
  }

  async budget(
    user: TestUser,
    category: TestCategory,
    overrides: Partial<Omit<TestBudget, 'id' | 'userId' | 'categoryId'>> = {},
  ) {
    return this.create<TestBudget>('budgets', {
      userId: user.id,
      categoryId: category.id,
      amount: 100,
      month: monthNow(),
      ...overrides,
    });
  }

  async notification(
    user: TestUser,
    overrides: Partial<Omit<TestNotification, 'id' | 'userId'>> = {},
  ) {
    return this.create<TestNotification>('notifications', {
      userId: user.id,
      type: 'budgetWarning',
      title: 'Presupuesto próximo al límite',
      message: 'Has utilizado el 80% de tu presupuesto.',
      createdAt: new Date().toISOString(),
      isRead: false,
      eventKey: `e2e:${nonce()}`,
      budgetId: null,
      categoryId: null,
      ...overrides,
    });
  }

  async authenticated(page: Page, user: TestUser, path = '/overview') {
    await page.goto('/login');
    await page.evaluate(({ id, username, email }) => {
      sessionStorage.setItem('finora-auth-session', JSON.stringify({ id, username, email }));
    }, user);
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(`${path.replace('/', '\\/')}(?:[/?#]|$)`));
  }

  async checkProxyIsolated() {
    const probe = await this.createUser();
    const response = await this.request.get(
      `${E2E_APP_URL}/api/users/${encodeURIComponent(probe.id)}`,
    );
    if (!response.ok()) {
      throw new Error(
        'PROXY E2E INCORRECTO: Angular 4201 no conecta con JSON Server 3001. No ejecutes tests destructivos.',
      );
    }
    const throughProxy = (await response.json()) as Partial<TestUser>;
    if (throughProxy.id !== probe.id || throughProxy.username !== probe.username) {
      throw new Error(
        'PROXY E2E INCORRECTO: el servidor de la app no devuelve el usuario de la base aislada.',
      );
    }
  }

  async cleanup() {
    const errors: string[] = [];
    for (const userId of this.ownedUsers) {
      for (const collection of [
        'notifications',
        'budgets',
        'transactions',
        'categories',
        'preferences',
      ]) {
        try {
          const entries = await this.list<{ id: string }>(collection, userId);
          for (const entry of entries) {
            const result = await this.request.delete(
              `${E2E_API_URL}/${collection}/${encodeURIComponent(entry.id)}`,
            );
            if (!result.ok() && result.status() !== 404)
              errors.push(`${collection}/${entry.id}: ${result.status()}`);
          }
        } catch (error) {
          errors.push(`${collection}/${userId}: ${String(error)}`);
        }
      }
      const response = await this.request.delete(
        `${E2E_API_URL}/users/${encodeURIComponent(userId)}`,
      );
      if (!response.ok() && response.status() !== 404)
        errors.push(`users/${userId}: ${response.status()}`);
    }
    if (errors.length) throw new Error(`Fallo limpiando db.e2e.json: ${errors.join('; ')}`);
  }
}

export const test = base.extend<{ data: FinoraData }>({
  data: async ({ request }, use) => {
    const data = new FinoraData(request);
    try {
      await data.checkProxyIsolated();
      await use(data);
    } finally {
      await data.cleanup();
    }
  },
});
export { expect };
