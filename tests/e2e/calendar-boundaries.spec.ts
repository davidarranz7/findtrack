import { test, expect, type TestTransaction, type TestBudget } from './fixtures/finora.fixture';
import { fillTransaction, openTransactionForm, transactionRow, budgetCard } from './helpers/ui';

const cases = [
  ['fin de enero', '2024-01-31'],
  ['29 de febrero año bisiesto', '2024-02-29'],
  ['fin de febrero año no bisiesto', '2025-02-28'],
  ['inicio de marzo', '2024-03-01'],
  ['fin de abril', '2024-04-30'],
  ['inicio de junio', '2025-06-01'],
  ['fin de septiembre', '2025-09-30'],
  ['fin de año', '2025-12-31'],
  ['principio de año', '2026-01-01'],
  ['último día de año bisiesto', '2024-12-31'],
] as const;

for (const [label, date] of cases) {
  test(`fecha frontera ${label}: guardar y consultar en su mes correcto`, async ({
    page,
    data,
  }) => {
    const user = await data.createUser();
    const category = await data.category(user, { name: 'Fechas límite' });
    await data.authenticated(page, user, '/transactions');
    const dialog = await openTransactionForm(page);
    await fillTransaction(dialog, {
      amount: '15.75',
      categoryLabel: category.name,
      description: `Fecha ${label}`,
      date,
    });
    await dialog.getByRole('button', { name: 'Guardar transacción' }).click();
    const records = await data.list<TestTransaction>('transactions', user.id);
    expect(records).toHaveLength(1);
    expect(records[0].date).toBe(date);
    await page.goto(`/transactions?month=${date.slice(0, 7)}`);
    await expect(transactionRow(page, `Fecha ${label}`)).toBeVisible();
  });
}

for (const month of ['2024-12', '2025-01', '2025-12', '2026-01']) {
  test(`presupuesto en ${month} se mantiene sin mezclarse con diciembre/enero adyacentes`, async ({
    page,
    data,
  }) => {
    const user = await data.createUser();
    const category = await data.category(user, { name: `Cambio de año ${month}` });
    const budget = await data.budget(user, category, { amount: 75, month });
    const record = await data.transaction(user, {
      categoryId: category.id,
      amount: 35.2,
      date: `${month}-15`,
    });
    await data.authenticated(page, user, '/budgets');
    await page.locator('.budget-month-input').fill(month);
    await expect(budgetCard(page, category.name)).toContainText('35,20');
    await expect(budgetCard(page, category.name)).toContainText('39,80');
    expect((await data.get<TestBudget>('budgets', budget.id)).month).toBe(month);
    expect((await data.get<TestTransaction>('transactions', record.id)).date).toBe(`${month}-15`);
  });
}

test('dos fechas en mismo mes pero diferente año no comparten el filtro', async ({
  page,
  data,
}) => {
  const user = await data.createUser();
  await data.transaction(user, { description: 'Enero viejo', date: '2025-01-13' });
  await data.transaction(user, { description: 'Enero nuevo', date: '2026-01-13' });
  await data.authenticated(page, user, '/transactions?month=2025-01');
  await expect(transactionRow(page, 'Enero viejo')).toBeVisible();
  await expect(transactionRow(page, 'Enero nuevo')).toHaveCount(0);
  await page.locator('input[type="month"]').fill('2026-01');
  await expect(transactionRow(page, 'Enero nuevo')).toBeVisible();
  await expect(transactionRow(page, 'Enero viejo')).toHaveCount(0);
});
