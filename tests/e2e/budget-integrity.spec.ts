import { test, expect, type TestBudget, type TestTransaction } from './fixtures/finora.fixture';
import { dateInMonth, monthShift } from './helpers/dates';
import { budgetCard } from './helpers/ui';

for (const [name, spent, expectedClass] of [
  ['cero por ciento', 0, 'budget-card'],
  ['79,99 por ciento', 79.99, 'budget-card'],
  ['80 por ciento', 80, 'budget-card-warning'],
  ['99,99 por ciento', 99.99, 'budget-card-warning'],
  ['100 por ciento', 100, 'budget-card-exceeded'],
  ['100,01 por ciento', 100.01, 'budget-card-exceeded'],
  ['250 por ciento', 250, 'budget-card-exceeded'],
] as const) {
  test(`umbrales presupuesto: ${name} debe clasificarse de forma coherente`, async ({
    page,
    data,
  }) => {
    const user = await data.createUser();
    const category = await data.category(user, { name: `Umbral ${name}` });
    await data.budget(user, category, { amount: 100 });
    if (spent !== 0)
      await data.transaction(user, {
        categoryId: category.id,
        amount: spent,
        date: dateInMonth(0),
      });
    await data.authenticated(page, user, '/budgets');
    const card = budgetCard(page, category.name);
    await expect(card).toBeVisible();
    await expect(card).toHaveClass(new RegExp(`(?:^|\\s)${expectedClass}(?:\\s|$)`));
    const progress = card.getByRole('progressbar');
    await expect(progress).toHaveAttribute('aria-valuenow', String(Math.min(spent, 100)));
  });
}

for (const offset of [-12, -6, -1, 0]) {
  test(`un ingreso de otro mes (${offset}) no reduce el gasto presupuestado`, async ({
    page,
    data,
  }) => {
    const user = await data.createUser();
    const category = await data.category(user, { name: `Gastos reales ${offset}` });
    await data.budget(user, category, { amount: 100, month: monthShift(offset) });
    await data.transaction(user, {
      type: 'income',
      categoryId: category.id,
      amount: 500,
      date: dateInMonth(offset),
    });
    await data.transaction(user, {
      type: 'expense',
      categoryId: category.id,
      amount: 25,
      date: dateInMonth(offset),
    });
    await data.transaction(user, {
      type: 'expense',
      categoryId: category.id,
      amount: 80,
      date: dateInMonth(offset - 1),
    });
    await data.authenticated(page, user, '/budgets');
    await page.locator('.budget-month-input').fill(monthShift(offset));
    const card = budgetCard(page, category.name);
    await expect(card).toContainText('25,00');
    await expect(card).toContainText('75,00');
  });
}

for (const offset of [-2, -1, 0]) {
  test(`eliminar movimiento del mes ${offset} no borra presupuesto ni categoría`, async ({
    page,
    data,
  }) => {
    const user = await data.createUser();
    const category = await data.category(user, { name: `Gasto eliminable ${offset}` });
    const budget = await data.budget(user, category, { amount: 100, month: monthShift(offset) });
    const transaction = await data.transaction(user, {
      categoryId: category.id,
      amount: 85,
      date: dateInMonth(offset),
    });
    await data.authenticated(page, user, `/transactions?month=${monthShift(offset)}`);
    const row = page
      .locator('.transactions-table tbody tr')
      .filter({ hasText: transaction.description });
    await expect(row).toBeVisible();
    await row.getByRole('button', { name: 'Eliminar transacción' }).click();
    await page
      .getByRole('dialog', { name: 'Eliminar transacción' })
      .getByRole('button', { name: 'Eliminar transacción' })
      .click();
    await expect(row).toHaveCount(0);
    expect(await data.list<TestTransaction>('transactions', user.id)).toHaveLength(0);
    expect((await data.get<TestBudget>('budgets', budget.id)).amount).toBe(100);
    await page.goto('/budgets');
    await page.locator('.budget-month-input').fill(monthShift(offset));
    await expect(budgetCard(page, category.name)).toContainText('0,00');
  });
}

for (const offset of [-12, -1, 0]) {
  test(`presupuesto: cambiar a mes ${offset} y volver no duplica registros`, async ({
    page,
    data,
  }) => {
    const user = await data.createUser();
    const category = await data.category(user, { name: `Sin duplicar ${offset}` });
    const budget = await data.budget(user, category, { month: monthShift(offset), amount: 125 });
    await data.authenticated(page, user, '/budgets');
    for (let index = 0; index < 3; index++) {
      await page.locator('.budget-month-input').fill(monthShift(0));
      await page.locator('.budget-month-input').fill(monthShift(offset));
    }
    await expect(budgetCard(page, category.name)).toBeVisible();
    expect((await data.list<TestBudget>('budgets', user.id)).map((item) => item.id)).toEqual([
      budget.id,
    ]);
  });
}

test('dos presupuestos de categoría distinta y mismo mes permanecen independientes', async ({
  page,
  data,
}) => {
  const user = await data.createUser();
  const food = await data.category(user, { name: 'Comida independiente' });
  const rent = await data.category(user, { name: 'Casa independiente' });
  await data.budget(user, food, { amount: 100 });
  await data.budget(user, rent, { amount: 200 });
  await data.transaction(user, { categoryId: food.id, amount: 91, date: dateInMonth(0) });
  await data.transaction(user, { categoryId: rent.id, amount: 13, date: dateInMonth(0) });
  await data.authenticated(page, user, '/budgets');
  await expect(budgetCard(page, food.name)).toContainText('91,00');
  await expect(budgetCard(page, rent.name)).toContainText('13,00');
  await expect(budgetCard(page, food.name)).toContainText('9,00');
  await expect(budgetCard(page, rent.name)).toContainText('187,00');
});
