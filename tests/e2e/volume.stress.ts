import { test, expect, type TestTransaction, type TestCategory } from './fixtures/finora.fixture';
import { dateInMonth, monthShift } from './helpers/dates';
import { transactionRow } from './helpers/ui';

function seeded(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

test('volumen: 720 transacciones combinando 36 meses, 8 categorías, 3 métodos y 2 tipos sin pérdidas', async ({
  page,
  data,
}) => {
  test.setTimeout(300_000);
  const user = await data.createUser();
  const categories: TestCategory[] = [];
  for (let index = 0; index < 8; index++) {
    categories.push(await data.category(user, { name: `Volumen categoría ${index}` }));
  }
  const amounts = [0.01, 0.09, 0.5, 1, 3.2, 10, 99.99, 100, 199.5, 999.99];
  const payments: Array<TestTransaction['paymentMethod']> = ['cash', 'card', 'bankTransfer'];
  const random = seeded(20261011);
  const expected: TestTransaction[] = [];
  for (let index = 0; index < 720; index++) {
    const offset = -(index % 36);
    const categoryId = categories[Math.floor(random() * categories.length)].id;
    const type = index % 2 === 0 ? 'expense' : 'income';
    const amount = amounts[Math.floor(random() * amounts.length)];
    const paymentMethod = payments[index % payments.length];
    expected.push(
      await data.transaction(user, {
        categoryId,
        type,
        amount,
        paymentMethod,
        date: dateInMonth(offset),
        description: `Prueba volumen ${String(index).padStart(4, '0')}`,
      }),
    );
  }
  const actual = await data.list<TestTransaction>('transactions', user.id);
  expect(actual).toHaveLength(720);
  expect(new Set(actual.map((record) => record.id)).size).toBe(720);
  expect(new Set(actual.map((record) => record.date.slice(0, 7))).size).toBe(36);
  expect(new Set(actual.map((record) => record.categoryId)).size).toBeGreaterThan(1);
  for (const original of expected) {
    const saved = actual.find((entry) => entry.id === original.id);
    expect(saved).toMatchObject({
      amount: original.amount,
      type: original.type,
      categoryId: original.categoryId,
      date: original.date,
      paymentMethod: original.paymentMethod,
    });
  }
  await data.authenticated(page, user, `/transactions?month=${monthShift(-17)}`);
  await page.locator('#pageSize').selectOption('20');
  await expect(transactionRow(page, 'Prueba volumen 0017')).toBeVisible();
  await expect(page.locator('.transactions-table tbody tr')).toHaveCount(20);
});

test('volumen: 180 presupuestos históricos no se duplican al navegar por meses', async ({
  page,
  data,
}) => {
  test.setTimeout(180_000);
  const user = await data.createUser();
  const categories: TestCategory[] = [];
  for (let index = 0; index < 5; index++)
    categories.push(await data.category(user, { name: `Límite ${index}` }));
  for (let offset = 0; offset < 36; offset++) {
    for (const category of categories) {
      await data.budget(user, category, { month: monthShift(-offset), amount: 75 + offset });
    }
  }
  const budgets = await data.list<{ id: string; month: string; categoryId: string }>(
    'budgets',
    user.id,
  );
  expect(budgets).toHaveLength(180);
  expect(new Set(budgets.map((budget) => `${budget.month}:${budget.categoryId}`)).size).toBe(180);
  await data.authenticated(page, user, '/budgets');
  for (const offset of [0, -7, -20, -35]) {
    await page.locator('.budget-month-input').fill(monthShift(offset));
    await expect(page.locator('.budget-card')).toHaveCount(5);
  }
});
