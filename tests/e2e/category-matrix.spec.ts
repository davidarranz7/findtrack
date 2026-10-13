import { test, expect, type TestCategory, type TestTransaction } from './fixtures/finora.fixture';
import { categoryCard } from './helpers/ui';

const names = [
  ['acentos', 'Educación y café'],
  ['emoji', 'Viajes ✈'],
  ['símbolos', 'Luz & Agua (2026)'],
  ['espacios internos', 'Super Mercado'],
  ['cuarenta caracteres', 'C'.repeat(40)],
  ['caracteres no latinos', '旅行日記'],
  ['guiones', 'Casa-Gastos'],
] as const;

for (const [label, name] of names) {
  test(`categorías: nombre ${label} se crea y persiste sin corrupción`, async ({ page, data }) => {
    const user = await data.createUser();
    await data.authenticated(page, user, '/categories');
    await page.getByRole('button', { name: 'Nueva categoría' }).click();
    const dialog = page.getByRole('dialog', { name: 'Nueva categoría' });
    await dialog.locator('#category-name').fill(name);
    await dialog.getByRole('button', { name: 'Crear categoría' }).click();
    await expect(categoryCard(page, name)).toBeVisible();
    const created = await data.list<TestCategory>('categories', user.id);
    expect(created).toHaveLength(1);
    expect(created[0].name).toBe(name);
    await page.reload();
    await expect(categoryCard(page, name)).toBeVisible();
  });
}

for (const input of ['  ', '\t', '\n', '     \t    ']) {
  test(`categorías: nombre solo whitespace (${JSON.stringify(input)}) no se guarda`, async ({
    page,
    data,
  }) => {
    const user = await data.createUser();
    await data.authenticated(page, user, '/categories');
    await page.getByRole('button', { name: 'Nueva categoría' }).click();
    const dialog = page.getByRole('dialog', { name: 'Nueva categoría' });
    await dialog.locator('#category-name').fill(input);
    await dialog.getByRole('button', { name: 'Crear categoría' }).click();
    await expect(dialog).toBeVisible();
    expect(await data.list<TestCategory>('categories', user.id)).toHaveLength(0);
  });
}

test('categorías: 41 caracteres no deben superar el máximo de 40', async ({ page, data }) => {
  const user = await data.createUser();
  await data.authenticated(page, user, '/categories');
  await page.getByRole('button', { name: 'Nueva categoría' }).click();
  const dialog = page.getByRole('dialog', { name: 'Nueva categoría' });
  await dialog.locator('#category-name').fill('D'.repeat(41));
  await dialog.getByRole('button', { name: 'Crear categoría' }).click();
  const categories = await data.list<TestCategory>('categories', user.id);
  expect(categories.every((cat) => cat.name.length <= 40)).toBeTruthy();
});

test('categoría sin vínculos se borra y reaparece tras crear otra con el mismo nombre', async ({
  page,
  data,
}) => {
  const user = await data.createUser();
  const category = await data.category(user, { name: 'Reutilizable después de borrar' });
  await data.authenticated(page, user, '/categories');
  await categoryCard(page, category.name)
    .getByRole('button', { name: `Eliminar categoría ${category.name}` })
    .click();
  await page
    .getByRole('dialog', { name: 'Eliminar categoría' })
    .getByRole('button', { name: 'Eliminar categoría' })
    .click();
  await expect(categoryCard(page, category.name)).toHaveCount(0);
  await page.getByRole('button', { name: 'Nueva categoría' }).click();
  const dialog = page.getByRole('dialog', { name: 'Nueva categoría' });
  await dialog.locator('#category-name').fill(category.name);
  await dialog.getByRole('button', { name: 'Crear categoría' }).click();
  await expect(categoryCard(page, category.name)).toBeVisible();
  const [newCategory] = await data.list<TestCategory>('categories', user.id);
  expect(newCategory.id).not.toBe(category.id);
});

test('categorías: no se pierden transacciones de otra persona al borrar categoría propia', async ({
  page,
  data,
}) => {
  const one = await data.createUser();
  const two = await data.createUser();
  const own = await data.category(one, { name: 'Solo propia' });
  const other = await data.category(two, { name: 'La otra cuenta' });
  const otherTransaction = await data.transaction(two, {
    categoryId: other.id,
    description: 'Movimiento ajeno intacto',
  });
  const ownTransaction = await data.transaction(one, {
    categoryId: own.id,
    description: 'Movimiento propio desvinculado',
  });
  await data.authenticated(page, one, '/categories');
  await categoryCard(page, own.name)
    .getByRole('button', { name: `Eliminar categoría ${own.name}` })
    .click();
  await page
    .getByRole('dialog', { name: 'Eliminar categoría' })
    .getByRole('button', { name: 'Eliminar categoría' })
    .click();
  await expect(categoryCard(page, own.name)).toHaveCount(0);
  expect((await data.get<TestTransaction>('transactions', otherTransaction.id)).categoryId).toBe(
    other.id,
  );
  expect(
    (await data.get<TestTransaction>('transactions', ownTransaction.id)).categoryId,
  ).toBeNull();
});
