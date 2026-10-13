import {
  test,
  expect,
  monthNow,
  type FinoraData,
  type TestBudget,
} from './fixtures/finora.fixture';
import { budgetCard, budgetDialog } from './helpers/ui';
import type { Page } from '@playwright/test';

async function setup(data: FinoraData, page: Page) {
  const user = await data.createUser();
  const category = await data.category(user, { name: 'Comida presupuestos E2E' });
  await data.authenticated(page, user, '/budgets');
  return { user, category };
}

async function newBudget(page: Page) {
  await page.getByRole('button', { name: 'Nuevo presupuesto' }).click();
  const dialog = budgetDialog(page);
  await expect(dialog).toBeVisible();
  return dialog;
}

test('@smoke crea presupuesto y almacena categoría, cantidad y mes', async ({ page, data }) => {
  const { user, category } = await setup(data, page);
  const dialog = await newBudget(page);
  await dialog.locator('#budget-category').selectOption(category.id);
  await dialog.locator('#budget-amount').fill('200.50');
  await dialog.getByRole('button', { name: 'Crear presupuesto' }).click();
  await expect(budgetCard(page, category.name)).toBeVisible();
  const [budget] = await data.list<TestBudget>('budgets', user.id);
  expect(budget).toMatchObject({ categoryId: category.id, amount: 200.5, month: monthNow() });
});

test('impide presupuesto sin categoría ni importe', async ({ page, data }) => {
  const { user } = await setup(data, page);
  const dialog = await newBudget(page);
  await dialog.getByRole('button', { name: 'Crear presupuesto' }).click();
  await expect(dialog.getByText('Selecciona una categoría.')).toBeVisible();
  await expect(dialog.getByText('El importe debe ser mayor que 0 €.')).toBeVisible();
  expect(await data.list<TestBudget>('budgets', user.id)).toHaveLength(0);
});

for (const amount of ['-40', '0']) {
  test(`rechaza presupuesto con límite ${amount}`, async ({ page, data }) => {
    const { user, category } = await setup(data, page);
    const dialog = await newBudget(page);
    await dialog.locator('#budget-category').selectOption(category.id);
    await dialog.locator('#budget-amount').fill(amount);
    await dialog.getByRole('button', { name: 'Crear presupuesto' }).click();
    await expect(dialog).toBeVisible();
    expect(await data.list<TestBudget>('budgets', user.id)).toHaveLength(0);
  });
}

test('cancelar creación no guarda presupuesto', async ({ page, data }) => {
  const { user, category } = await setup(data, page);
  const dialog = await newBudget(page);
  await dialog.locator('#budget-category').selectOption(category.id);
  await dialog.locator('#budget-amount').fill('450');
  await dialog.getByRole('button', { name: 'Cancelar' }).click();
  await expect(dialog).not.toBeVisible();
  expect(await data.list<TestBudget>('budgets', user.id)).toHaveLength(0);
});

test('edita cantidad pero mantiene la categoría de presupuesto', async ({ page, data }) => {
  const user = await data.createUser();
  const category = await data.category(user, { name: 'Editar presupuesto E2E' });
  const budget = await data.budget(user, category, { amount: 100 });
  await data.authenticated(page, user, '/budgets');
  await budgetCard(page, category.name).getByRole('button', { name: 'Editar presupuesto' }).click();
  const dialog = budgetDialog(page);
  await expect(dialog.locator('#budget-category')).toBeDisabled();
  await dialog.locator('#budget-amount').fill('175.75');
  await dialog.getByRole('button', { name: 'Guardar cambios' }).click();
  expect(await data.get<TestBudget>('budgets', budget.id)).toMatchObject({
    amount: 175.75,
    categoryId: category.id,
  });
});

test('evita dos presupuestos para la misma categoría y mes', async ({ page, data }) => {
  const { user, category } = await setup(data, page);
  await data.budget(user, category);
  await page.reload();
  const creation = page.getByRole('button', { name: 'Nuevo presupuesto' });
  await expect(creation).toBeDisabled();
  expect(await data.list<TestBudget>('budgets', user.id)).toHaveLength(1);
});

test('avisa cuando el gasto alcanza el 80% del presupuesto', async ({ page, data }) => {
  const user = await data.createUser();
  const category = await data.category(user, { name: 'Umbral E2E' });
  await data.budget(user, category, { amount: 100 });
  await data.transaction(user, { categoryId: category.id, amount: 80 });
  await data.authenticated(page, user, '/budgets');
  await expect(budgetCard(page, category.name)).toContainText('Cerca del límite');
  await expect(budgetCard(page, category.name).getByRole('progressbar')).toHaveAttribute(
    'aria-valuenow',
    '80',
  );
});

test('cuando el gasto supera el presupuesto muestra exceso y limita barra a 100%', async ({
  page,
  data,
}) => {
  const user = await data.createUser();
  const category = await data.category(user, { name: 'Excedido E2E' });
  await data.budget(user, category, { amount: 100 });
  await data.transaction(user, { categoryId: category.id, amount: 150 });
  await data.authenticated(page, user, '/budgets');
  await expect(budgetCard(page, category.name)).toContainText('Presupuesto superado');
  await expect(budgetCard(page, category.name).getByRole('progressbar')).toHaveAttribute(
    'aria-valuenow',
    '100',
  );
});

test('cancelar borrado conserva el presupuesto', async ({ page, data }) => {
  const user = await data.createUser();
  const category = await data.category(user, { name: 'No borrar presupuesto' });
  const budget = await data.budget(user, category);
  await data.authenticated(page, user, '/budgets');
  await budgetCard(page, category.name)
    .getByRole('button', { name: 'Eliminar presupuesto' })
    .click();
  await page
    .getByRole('dialog', { name: 'Eliminar presupuesto' })
    .getByRole('button', { name: 'Cancelar' })
    .click();
  expect((await data.get<TestBudget>('budgets', budget.id)).id).toBe(budget.id);
});

test('eliminar presupuesto no elimina categoría ni transacciones', async ({ page, data }) => {
  const user = await data.createUser();
  const category = await data.category(user, { name: 'Conservar categoría E2E' });
  await data.budget(user, category);
  await data.transaction(user, { categoryId: category.id, description: 'No borrar gasto' });
  await data.authenticated(page, user, '/budgets');
  await budgetCard(page, category.name)
    .getByRole('button', { name: 'Eliminar presupuesto' })
    .click();
  await page
    .getByRole('dialog', { name: 'Eliminar presupuesto' })
    .getByRole('button', { name: 'Eliminar presupuesto' })
    .click();
  await expect(budgetCard(page, category.name)).toHaveCount(0);
  expect(await data.list<TestBudget>('budgets', user.id)).toHaveLength(0);
  expect(await data.list('categories', user.id)).toHaveLength(1);
  expect(await data.list('transactions', user.id)).toHaveLength(1);
});

test('presupuestos de meses distintos no se mezclan', async ({ page, data }) => {
  const user = await data.createUser();
  const category = await data.category(user, { name: 'Mensual E2E' });
  await data.budget(user, category, { month: '2025-01', amount: 20 });
  await data.authenticated(page, user, '/budgets');
  await expect(budgetCard(page, category.name)).toHaveCount(0);
  await page.locator('.budget-month-input').fill('2025-01');
  await page.locator('.budget-month-input').dispatchEvent('change');
  await expect(budgetCard(page, category.name)).toBeVisible();
});
