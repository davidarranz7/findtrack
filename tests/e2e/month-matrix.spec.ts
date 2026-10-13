import { test, expect, type TestTransaction, type TestBudget } from './fixtures/finora.fixture';
import { dateInMonth, monthShift, euros } from './helpers/dates';
import { transactionRow, budgetCard } from './helpers/ui';

const reportKpi = (page: import('@playwright/test').Page, title: string) =>
  page.locator('.reports-kpis .report-kpi').filter({ hasText: title });

for (const offset of [-24, -13, -12, -7, -3, -1, 0]) {
  test(`mes ${offset}: los movimientos se filtran y no se mezclan con el mes actual`, async ({
    page,
    data,
  }) => {
    const user = await data.createUser();
    const historical = await data.transaction(user, {
      description: `Histórico ${offset}`,
      amount: 101.31,
      date: dateInMonth(offset),
    });
    const current = await data.transaction(user, {
      description: `Actual ${offset}`,
      amount: 7.19,
      date: dateInMonth(0),
    });
    await data.authenticated(page, user, `/transactions?month=${monthShift(offset)}`);
    await expect(transactionRow(page, historical.description)).toBeVisible();
    if (offset !== 0) await expect(transactionRow(page, current.description)).toHaveCount(0);
    await page.locator('input[type="month"]').fill(monthShift(0));
    await expect(transactionRow(page, current.description)).toBeVisible();
    const records = await data.list<TestTransaction>('transactions', user.id);
    expect(records.map((record) => record.id).sort()).toEqual([historical.id, current.id].sort());
  });
}

for (const offset of [-12, -3, -1, 0]) {
  for (const type of ['expense', 'income'] as const) {
    test(`mes ${offset}: ${type} mantiene importe, tipo y fecha incluso tras recargar`, async ({
      page,
      data,
    }) => {
      const user = await data.createUser();
      const category = await data.category(user, { name: `Categoría ${offset} ${type}` });
      const record = await data.transaction(user, {
        categoryId: category.id,
        type,
        date: dateInMonth(offset),
        amount: 53.27,
        description: `Persistencia ${offset} ${type}`,
      });
      await data.authenticated(page, user, `/transactions?month=${monthShift(offset)}`);
      await expect(transactionRow(page, record.description)).toBeVisible();
      await page.reload();
      await expect(transactionRow(page, record.description)).toBeVisible();
      expect(await data.get<TestTransaction>('transactions', record.id)).toMatchObject({
        id: record.id,
        categoryId: category.id,
        type,
        date: dateInMonth(offset),
        amount: 53.27,
      });
    });
  }
}

for (const offset of [-12, -6, -1, 0]) {
  test(`presupuesto del mes ${offset} solo computa los gastos de ese mes`, async ({
    page,
    data,
  }) => {
    const user = await data.createUser();
    const category = await data.category(user, { name: `Presupuesto multi-mes ${offset}` });
    const selectedBudget = await data.budget(user, category, {
      month: monthShift(offset),
      amount: 200,
    });
    await data.transaction(user, {
      categoryId: category.id,
      type: 'expense',
      amount: 40.25,
      date: dateInMonth(offset),
    });
    if (offset !== 0)
      await data.transaction(user, {
        categoryId: category.id,
        type: 'expense',
        amount: 900,
        date: dateInMonth(0),
      });
    await data.authenticated(page, user, `/budgets`);
    await page.locator('.budget-month-input').fill(monthShift(offset));
    const card = budgetCard(page, category.name);
    await expect(card).toBeVisible();
    await expect(card).toContainText('40,25');
    await expect(card).toContainText('159,75');
    expect((await data.get<TestBudget>('budgets', selectedBudget.id)).month).toBe(
      monthShift(offset),
    );
  });
}

for (const previousOffset of [-18, -12, -6, -1]) {
  test(`informes: cambio de año y periodo conserva histórico de ${Math.abs(previousOffset)} meses`, async ({
    page,
    data,
  }) => {
    const user = await data.createUser();
    const date = dateInMonth(previousOffset);
    const record = await data.transaction(user, {
      type: 'income',
      amount: 264.25,
      description: `Ingreso año histórico ${previousOffset}`,
      date,
    });
    await data.authenticated(page, user, '/reports');
    await expect(
      page.locator('#report-year option').filter({ hasText: date.slice(0, 4) }),
    ).toBeAttached();
    await page.locator('#report-year').selectOption(date.slice(0, 4));
    await page.locator('#report-period').selectOption('12');
    await expect(reportKpi(page, 'Ingresos totales')).toContainText('264,25');
    expect((await data.get<TestTransaction>('transactions', record.id)).date).toBe(date);
  });
}

for (const amount of [0.01, 0.09, 0.1, 0.99, 1, 10.5, 100.99, 999.99]) {
  test(`cálculos monetarios: importe ${amount} € conserva céntimos en gastos e ingresos`, async ({
    page,
    data,
  }) => {
    const user = await data.createUser();
    await data.transaction(user, { type: 'income', amount: amount + 1000, date: dateInMonth(0) });
    await data.transaction(user, { type: 'expense', amount, date: dateInMonth(0) });
    await data.authenticated(page, user, '/overview');
    await expect(
      page.locator('.summary-grid .summary-card').filter({ hasText: 'Gastos totales' }),
    ).toContainText(euros(amount));
    await expect(
      page.locator('.summary-grid .summary-card').filter({ hasText: 'Ahorro del mes' }),
    ).toContainText(euros(1000));
  });
}

test('histórico largo: 36 meses, movimientos y presupuestos aislados por mes', async ({
  page,
  data,
}) => {
  test.setTimeout(180_000);
  const user = await data.createUser();
  const category = await data.category(user, { name: 'Archivo 3 años E2E' });
  const months = Array.from({ length: 36 }, (_, index) => monthShift(-index));
  for (const [index, month] of months.entries()) {
    await data.transaction(user, {
      categoryId: category.id,
      date: `${month}-15`,
      description: `Archivo E2E ${month}`,
      amount: index + 0.25,
    });
    await data.budget(user, category, { month, amount: 200 + index });
  }
  const records = await data.list<TestTransaction>('transactions', user.id);
  const budgets = await data.list<TestBudget>('budgets', user.id);
  expect(records).toHaveLength(36);
  expect(budgets).toHaveLength(36);
  expect(new Set(records.map((entry) => entry.date.slice(0, 7))).size).toBe(36);
  await data.authenticated(page, user, `/transactions?month=${months[23]}`);
  await expect(transactionRow(page, `Archivo E2E ${months[23]}`)).toBeVisible();
  await expect(transactionRow(page, `Archivo E2E ${months[24]}`)).toHaveCount(0);
  await page.goto('/budgets');
  await page.locator('.budget-month-input').fill(months[23]);
  await expect(budgetCard(page, category.name)).toContainText(euros(223));
});
