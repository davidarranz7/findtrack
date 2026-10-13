import { test, expect, type TestTransaction, type TestCategory } from './fixtures/finora.fixture';
import { loginViaUI, transactionRow, categoryCard } from './helpers/ui';
import { dateInMonth, monthShift } from './helpers/dates';

for (const path of [
  '/overview',
  '/transactions',
  '/categories',
  '/budgets',
  '/reports',
  '/settings',
]) {
  test(`login UI + recarga permite permanecer en ${path} sin perder identidad`, async ({
    page,
    data,
  }) => {
    const user = await data.createUser();
    await loginViaUI(page, user);
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(`${path}(?:[/?#]|$)`));
    await page.reload();
    await expect(page).toHaveURL(new RegExp(`${path}(?:[/?#]|$)`));
    await expect
      .poll(() =>
        page.evaluate(
          () => JSON.parse(sessionStorage.getItem('finora-auth-session') ?? 'null')?.id,
        ),
      )
      .toBe(user.id);
  });
}

for (const monthOffset of [-12, -1, 0]) {
  test(`dos usuarios con datos en mes ${monthOffset} nunca ven los movimientos del otro`, async ({
    page,
    data,
  }) => {
    const first = await data.createUser();
    const second = await data.createUser();
    const firstCategory = await data.category(first, { name: `Categoría cuenta A ${monthOffset}` });
    const secondCategory = await data.category(second, {
      name: `Categoría cuenta B ${monthOffset}`,
    });
    const a = await data.transaction(first, {
      categoryId: firstCategory.id,
      date: dateInMonth(monthOffset),
      description: 'Privado exclusivo A',
    });
    const b = await data.transaction(second, {
      categoryId: secondCategory.id,
      date: dateInMonth(monthOffset),
      description: 'Privado exclusivo B',
    });
    await data.authenticated(page, first, `/transactions?month=${monthShift(monthOffset)}`);
    await expect(transactionRow(page, a.description)).toBeVisible();
    await expect(transactionRow(page, b.description)).toHaveCount(0);
    await page.getByRole('button', { name: 'Cerrar sesión' }).click();
    await expect(page).toHaveURL(/\/login(?:[/?#]|$)/);
    await loginViaUI(page, second);
    await page.goto(`/transactions?month=${monthShift(monthOffset)}`);
    await expect(transactionRow(page, b.description)).toBeVisible();
    await expect(transactionRow(page, a.description)).toHaveCount(0);
    expect((await data.get<TestTransaction>('transactions', a.id)).userId).toBe(first.id);
    expect((await data.get<TestTransaction>('transactions', b.id)).userId).toBe(second.id);
    await page.goto('/categories');
    await expect(categoryCard(page, secondCategory.name)).toBeVisible();
    await expect(categoryCard(page, firstCategory.name)).toHaveCount(0);
    expect((await data.get<TestCategory>('categories', firstCategory.id)).userId).toBe(first.id);
  });
}

test('sesión: cerrar sesión e ir atrás no vuelve a mostrar la aplicación privada', async ({
  page,
  data,
}) => {
  const user = await data.createUser();
  await loginViaUI(page, user);
  await page.goto('/transactions');
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page).toHaveURL(/\/login(?:[/?#]|$)/);
  await page.goBack();
  await expect(page).toHaveURL(/\/login(?:[/?#]|$)/);
});

test('sesión: un usuario recordado no está autenticado automáticamente al cerrar la sesión', async ({
  page,
  data,
}) => {
  const user = await data.createUser();
  await loginViaUI(page, user, true);
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page).toHaveURL(/\/login(?:[/?#]|$)/);
  await page.goto('/overview');
  await expect(page).toHaveURL(/\/login(?:[/?#]|$)/);
});
