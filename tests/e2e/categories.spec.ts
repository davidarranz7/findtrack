import { test, expect, type TestCategory, type TestTransaction } from './fixtures/finora.fixture';
import { categoryCard, categoryDialog } from './helpers/ui';

async function openNewCategory(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Nueva categoría' }).click();
  const dialog = categoryDialog(page);
  await expect(dialog).toBeVisible();
  return dialog;
}

test('crea categoría con nombre, icono y color', async ({ page, data }) => {
  const user = await data.createUser();
  await data.authenticated(page, user, '/categories');
  const dialog = await openNewCategory(page);
  await dialog.locator('#category-name').fill('Música E2E');
  await dialog.getByRole('button', { name: 'Seleccionar icono bi-controller' }).click();
  await dialog.getByRole('button', { name: 'Seleccionar color #16a34a' }).click();
  await dialog.getByRole('button', { name: 'Crear categoría' }).click();
  await expect(categoryCard(page, 'Música E2E')).toBeVisible();
  const [item] = await data.list<TestCategory>('categories', user.id);
  expect(item).toMatchObject({ name: 'Música E2E', icon: 'bi-controller', color: '#16a34a' });
});

test('nombre vacío impide crear categoría', async ({ page, data }) => {
  const user = await data.createUser();
  await data.authenticated(page, user, '/categories');
  const dialog = await openNewCategory(page);
  await dialog.getByRole('button', { name: 'Crear categoría' }).click();
  await expect(dialog.getByText('El nombre de la categoría es obligatorio.')).toBeVisible();
  expect(await data.list<TestCategory>('categories', user.id)).toHaveLength(0);
});

test('nombre de solo espacios se rechaza', async ({ page, data }) => {
  const user = await data.createUser();
  await data.authenticated(page, user, '/categories');
  const dialog = await openNewCategory(page);
  await dialog.locator('#category-name').fill('    ');
  await dialog.getByRole('button', { name: 'Crear categoría' }).click();
  await expect(dialog.getByText('El nombre de la categoría es obligatorio.')).toBeVisible();
  expect(await data.list<TestCategory>('categories', user.id)).toHaveLength(0);
});

test('duplicados con cambios de mayúsculas y espacios son rechazados', async ({ page, data }) => {
  const user = await data.createUser();
  await data.category(user, { name: 'Alimentación' });
  await data.authenticated(page, user, '/categories');
  const dialog = await openNewCategory(page);
  await dialog.locator('#category-name').fill(' ALIMENTACIÓN  ');
  await dialog.getByRole('button', { name: 'Crear categoría' }).click();
  await expect(dialog.getByRole('alert')).toContainText('Ya existe una categoría con ese nombre.');
  expect(await data.list<TestCategory>('categories', user.id)).toHaveLength(1);
});

test('cancelar creación no añade categoría', async ({ page, data }) => {
  const user = await data.createUser();
  await data.authenticated(page, user, '/categories');
  const dialog = await openNewCategory(page);
  await dialog.locator('#category-name').fill('Temporal no creada');
  await dialog.getByRole('button', { name: 'Cancelar' }).click();
  await expect(dialog).not.toBeVisible();
  expect(await data.list<TestCategory>('categories', user.id)).toHaveLength(0);
});

test('editar categoría conserva ID y actualiza nombre', async ({ page, data }) => {
  const user = await data.createUser();
  const original = await data.category(user, { name: 'Antes E2E' });
  await data.authenticated(page, user, '/categories');
  await categoryCard(page, 'Antes E2E')
    .getByRole('button', { name: 'Editar categoría Antes E2E' })
    .click();
  const dialog = categoryDialog(page);
  await dialog.locator('#category-name').fill('Después E2E');
  await dialog.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(categoryCard(page, 'Después E2E')).toBeVisible();
  expect((await data.get<TestCategory>('categories', original.id)).name).toBe('Después E2E');
});

test('cancelar borrado conserva categoría', async ({ page, data }) => {
  const user = await data.createUser();
  const item = await data.category(user, { name: 'No borrar E2E' });
  await data.authenticated(page, user, '/categories');
  await categoryCard(page, item.name)
    .getByRole('button', { name: `Eliminar categoría ${item.name}` })
    .click();
  const confirm = page.getByRole('dialog', { name: 'Eliminar categoría' });
  await expect(confirm).toContainText('no tiene transacciones asociadas');
  await confirm.getByRole('button', { name: 'Cancelar' }).click();
  await expect(categoryCard(page, item.name)).toBeVisible();
});

test('eliminar categoría sin movimientos la borra', async ({ page, data }) => {
  const user = await data.createUser();
  const item = await data.category(user, { name: 'Eliminar vacía E2E' });
  await data.authenticated(page, user, '/categories');
  await categoryCard(page, item.name)
    .getByRole('button', { name: `Eliminar categoría ${item.name}` })
    .click();
  await page
    .getByRole('dialog', { name: 'Eliminar categoría' })
    .getByRole('button', { name: 'Eliminar categoría' })
    .click();
  await expect(categoryCard(page, item.name)).toHaveCount(0);
  expect(await data.list<TestCategory>('categories', user.id)).toHaveLength(0);
});

test('@smoke eliminar categoría en uso conserva movimientos y su nombre histórico', async ({
  page,
  data,
}) => {
  const user = await data.createUser();
  const item = await data.category(user, { name: 'Borrado en uso E2E' });
  const movement1 = await data.transaction(user, {
    categoryId: item.id,
    description: 'Asociada A',
  });
  const movement2 = await data.transaction(user, {
    categoryId: item.id,
    description: 'Asociada B',
  });
  await data.authenticated(page, user, '/categories');
  await expect(categoryCard(page, item.name)).toContainText('2 transacciones');
  await categoryCard(page, item.name)
    .getByRole('button', { name: `Eliminar categoría ${item.name}` })
    .click();
  const confirm = page.getByRole('dialog', { name: 'Eliminar categoría' });
  await expect(confirm).toContainText('2 transacciones asociadas');
  await expect(confirm).toContainText(`${item.name} (eliminada)`);
  await confirm.getByRole('button', { name: 'Eliminar categoría' }).click();
  await expect(categoryCard(page, item.name)).toHaveCount(0);
  const movements = await data.list<TestTransaction>('transactions', user.id);
  expect(movements).toHaveLength(2);
  expect(movements.map((t) => t.id).sort()).toEqual([movement1.id, movement2.id].sort());
  expect(movements.every((t) => t.categoryId === null)).toBeTruthy();
  await page.goto('/transactions');
  await expect(
    page.locator('.transaction-category').filter({ hasText: `${item.name} (eliminada)` }),
  ).toHaveCount(2);
});

test('categoría con presupuesto no se puede eliminar sin borrar antes el presupuesto', async ({
  page,
  data,
}) => {
  const user = await data.createUser();
  const item = await data.category(user, { name: 'Presupuestada E2E' });
  await data.budget(user, item);
  await data.authenticated(page, user, '/categories');
  await categoryCard(page, item.name)
    .getByRole('button', { name: `Eliminar categoría ${item.name}` })
    .click();
  await expect(page.getByText(/tiene un presupuesto asociado/)).toBeVisible();
  expect((await data.get<TestCategory>('categories', item.id)).id).toBe(item.id);
});

test('error en la API al crear categoría muestra aviso y permite reintentar', async ({
  page,
  data,
}) => {
  const user = await data.createUser();
  await data.authenticated(page, user, '/categories');
  await page.route('**/api/categories', async (route) => {
    if (route.request().method() === 'POST')
      await route.fulfill({ status: 503, body: 'Fallo E2E' });
    else await route.continue();
  });
  const dialog = await openNewCategory(page);
  await dialog.locator('#category-name').fill('Error E2E');
  await dialog.getByRole('button', { name: 'Crear categoría' }).click();
  await expect(dialog.getByRole('alert')).toContainText('No se ha podido crear');
  expect(await data.list<TestCategory>('categories', user.id)).toHaveLength(0);
});
