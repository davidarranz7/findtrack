import {
  test,
  expect,
  type TestCategory,
  type TestTransaction,
  type TestBudget,
} from './fixtures/finora.fixture';
import { monthShift, dateInMonth } from './helpers/dates';
import { categoryCard, transactionRow } from './helpers/ui';

async function eraseCategory(page: import('@playwright/test').Page, name: string) {
  await categoryCard(page, name)
    .getByRole('button', { name: `Eliminar categoría ${name}` })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Eliminar categoría' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Eliminar categoría' }).click();
  await expect(categoryCard(page, name)).toHaveCount(0);
}

for (const count of [1, 2, 5, 15]) {
  test(`histórico: eliminar categoría usada en ${count} movimientos conserva IDs, importes, fechas y notas`, async ({
    page,
    data,
  }) => {
    test.setTimeout(count > 5 ? 120_000 : 60_000);
    const user = await data.createUser();
    const category = await data.category(user, { name: `Histórica ${count} E2E` });
    const originals = [] as TestTransaction[];
    for (let index = 0; index < count; index++) {
      originals.push(
        await data.transaction(user, {
          categoryId: category.id,
          amount: 10.2 + index,
          date: dateInMonth(-index),
          description: `Conservar histórico ${index}`,
          notes: `Nota histórica ${index}`,
        }),
      );
    }
    await data.authenticated(page, user, '/categories');
    await categoryCard(page, category.name)
      .getByRole('button', { name: `Eliminar categoría ${category.name}` })
      .click();
    const confirmation = page.getByRole('dialog', { name: 'Eliminar categoría' });
    await expect(confirmation).toContainText(
      `${count} ${count === 1 ? 'transacción asociada' : 'transacciones asociadas'}`,
    );
    await expect(confirmation).toContainText(`${category.name} (eliminada)`);
    await confirmation.getByRole('button', { name: 'Eliminar categoría' }).click();
    await expect(categoryCard(page, category.name)).toHaveCount(0);
    const actual = await data.list<TestTransaction>('transactions', user.id);
    expect(actual).toHaveLength(count);
    for (const original of originals) {
      expect(actual.find((entry) => entry.id === original.id)).toEqual({
        ...original,
        categoryId: null,
        categoryNameSnapshot: category.name,
      });
    }
    expect(await data.list<TestCategory>('categories', user.id)).toHaveLength(0);
    for (const original of originals) {
      await page.goto(`/transactions?month=${original.date.slice(0, 7)}`);
      const row = transactionRow(page, original.description);
      await expect(row).toBeVisible();
      await expect(row).toContainText(`${category.name} (eliminada)`);
    }
  });
}

for (const offset of [-18, -12, -6, -1, 0]) {
  test(`histórico: borrar categoría afecta movimientos de hace ${Math.abs(offset)} meses sin eliminar otras categorías`, async ({
    page,
    data,
  }) => {
    const user = await data.createUser();
    const erased = await data.category(user, { name: `Borrada mes ${Math.abs(offset)}` });
    const retained = await data.category(user, { name: `Otra mes ${Math.abs(offset)}` });
    const old = await data.transaction(user, {
      categoryId: erased.id,
      description: 'Movimiento antiguo',
      date: dateInMonth(offset),
    });
    const other = await data.transaction(user, {
      categoryId: retained.id,
      description: 'Movimiento conservado',
      date: dateInMonth(offset),
    });
    await data.authenticated(page, user, '/categories');
    await eraseCategory(page, erased.name);
    const after = await data.list<TestTransaction>('transactions', user.id);
    expect(after.find((entry) => entry.id === old.id)?.categoryId).toBeNull();
    expect(after.find((entry) => entry.id === other.id)?.categoryId).toBe(retained.id);
    await page.goto(`/transactions?month=${monthShift(offset)}`);
    await expect(transactionRow(page, 'Movimiento antiguo')).toContainText(
      `${erased.name} (eliminada)`,
    );
    await expect(transactionRow(page, 'Movimiento conservado')).toContainText(retained.name);
  });
}

test('histórico: cancelar la eliminación no cambia ni vínculos ni transacciones', async ({
  page,
  data,
}) => {
  const user = await data.createUser();
  const category = await data.category(user, { name: 'Cancelar desvinculación' });
  const old = await data.transaction(user, { categoryId: category.id, date: dateInMonth(-4) });
  await data.authenticated(page, user, '/categories');
  await categoryCard(page, category.name)
    .getByRole('button', { name: `Eliminar categoría ${category.name}` })
    .click();
  await page
    .getByRole('dialog', { name: 'Eliminar categoría' })
    .getByRole('button', { name: 'Cancelar' })
    .click();
  await expect(categoryCard(page, category.name)).toBeVisible();
  expect((await data.get<TestTransaction>('transactions', old.id)).categoryId).toBe(category.id);
});

test('histórico: la edición de categoría mantiene el ID vinculado a movimientos de otros meses', async ({
  page,
  data,
}) => {
  const user = await data.createUser();
  const category = await data.category(user, { name: 'Antes de renombrar' });
  const old = await data.transaction(user, {
    categoryId: category.id,
    date: dateInMonth(-3),
    description: 'Categoría renombrable',
  });
  await data.authenticated(page, user, '/categories');
  await categoryCard(page, category.name)
    .getByRole('button', { name: `Editar categoría ${category.name}` })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Editar categoría' });
  await dialog.locator('#category-name').fill('Después de renombrar');
  await dialog.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(categoryCard(page, 'Después de renombrar')).toBeVisible();
  expect((await data.get<TestTransaction>('transactions', old.id)).categoryId).toBe(category.id);
  await page.goto(`/transactions?month=${monthShift(-3)}`);
  await expect(transactionRow(page, old.description)).toContainText('Después de renombrar');
});

test('histórico: una categoría con presupuesto antiguo tampoco se borra silenciosamente', async ({
  page,
  data,
}) => {
  const user = await data.createUser();
  const category = await data.category(user, { name: 'Categoría con presupuesto anterior' });
  const budget = await data.budget(user, category, { month: monthShift(-3) });
  const old = await data.transaction(user, { categoryId: category.id, date: dateInMonth(-3) });
  await data.authenticated(page, user, '/categories');
  await categoryCard(page, category.name)
    .getByRole('button', { name: `Eliminar categoría ${category.name}` })
    .click();
  await expect(page.getByText(/tiene un presupuesto asociado/)).toBeVisible();
  expect((await data.get<TestBudget>('budgets', budget.id)).categoryId).toBe(category.id);
  expect((await data.get<TestTransaction>('transactions', old.id)).categoryId).toBe(category.id);
});

test('contrato futuro: conservar el nombre histórico de una categoría eliminada en la transacción', async ({
  page,
  data,
}) => {
  const user = await data.createUser();
  const category = await data.category(user, { name: 'Nombre histórico de 2024' });
  const old = await data.transaction(user, {
    categoryId: category.id,
    date: '2024-02-15',
    description: 'Factura histórica',
  });
  await data.authenticated(page, user, '/categories');
  await eraseCategory(page, category.name);
  await page.goto('/transactions?month=2024-02');
  await expect(transactionRow(page, old.description)).toContainText('Nombre histórico de 2024');
});
