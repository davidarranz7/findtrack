import { test, expect, type TestTransaction, type FinoraData } from './fixtures/finora.fixture';
import type { Page } from '@playwright/test';
import {
  fillTransaction,
  openTransactionForm,
  transactionDialog,
  transactionRow,
} from './helpers/ui';

async function setupTransactions(data: FinoraData, page: Page) {
  const user = await data.createUser();
  const category = await data.category(user, { name: 'Alimentación E2E' });
  await data.authenticated(page, user, '/transactions');
  return { user, category };
}

test('no permite guardar transacción vacía', async ({ page, data }) => {
  const { user } = await setupTransactions(data, page);
  const dialog = await openTransactionForm(page);
  await dialog.getByRole('button', { name: 'Guardar transacción' }).click();
  await expect(dialog.getByText('Debe ser mayor que 0 €')).toBeVisible();
  await expect(dialog.getByText('Introduce un concepto para la transacción.')).toBeVisible();
  await expect(dialog.getByText('Selecciona una categoría.')).toBeVisible();
  expect(await data.list<TestTransaction>('transactions', user.id)).toHaveLength(0);
});

for (const value of ['-50', '0', '0.001']) {
  test(`rechaza importe ${value} (mínimo monetario 0,01 €)`, async ({ page, data }) => {
    const { user } = await setupTransactions(data, page);
    const dialog = await openTransactionForm(page);
    await fillTransaction(dialog, {
      amount: value,
      description: 'Prueba inválida',
      categoryLabel: 'Alimentación E2E',
    });
    await dialog.getByRole('button', { name: 'Guardar transacción' }).click();
    await expect(dialog).toBeVisible();
    expect(await data.list<TestTransaction>('transactions', user.id)).toHaveLength(0);
  });
}

test('@smoke crea gasto decimal y conserva 12.50 como número', async ({ page, data }) => {
  const { user, category } = await setupTransactions(data, page);
  const dialog = await openTransactionForm(page);
  await fillTransaction(dialog, {
    amount: '12.50',
    description: 'Factura decimal E2E',
    categoryLabel: category.name,
    notes: 'Nota de compra',
  });
  await dialog.getByRole('button', { name: 'Guardar transacción' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(transactionRow(page, 'Factura decimal E2E')).toContainText('12,50');
  const items = await data.list<TestTransaction>('transactions', user.id);
  expect(items).toHaveLength(1);
  expect(items[0]).toMatchObject({
    amount: 12.5,
    type: 'expense',
    categoryId: category.id,
    notes: 'Nota de compra',
  });
});

test('crea ingreso por transferencia', async ({ page, data }) => {
  const { user, category } = await setupTransactions(data, page);
  const dialog = await openTransactionForm(page);
  await fillTransaction(dialog, {
    type: 'Ingreso',
    amount: '2750.40',
    description: 'Nómina de prueba',
    categoryLabel: category.name,
    method: 'Transferencia',
  });
  await dialog.getByRole('button', { name: 'Guardar transacción' }).click();
  const [item] = await data.list<TestTransaction>('transactions', user.id);
  expect(item).toMatchObject({ type: 'income', amount: 2750.4, paymentMethod: 'bankTransfer' });
});

test('recorta espacios en concepto y notas antes de guardar', async ({ page, data }) => {
  const { user, category } = await setupTransactions(data, page);
  const dialog = await openTransactionForm(page);
  await fillTransaction(dialog, {
    amount: '8',
    description: '   Compra   ',
    categoryLabel: category.name,
    notes: '   detalle   ',
  });
  await dialog.getByRole('button', { name: 'Guardar transacción' }).click();
  const [item] = await data.list<TestTransaction>('transactions', user.id);
  expect(item.description).toBe('Compra');
  expect(item.notes).toBe('detalle');
});

test('no guarda descripción compuesta solo de espacios', async ({ page, data }) => {
  const { user, category } = await setupTransactions(data, page);
  const dialog = await openTransactionForm(page);
  await fillTransaction(dialog, { amount: '10', description: '   ', categoryLabel: category.name });
  await dialog.getByRole('button', { name: 'Guardar transacción' }).click();
  expect(await data.list<TestTransaction>('transactions', user.id)).toHaveLength(0);
});

test('la fecha vacía impide guardar', async ({ page, data }) => {
  const { user, category } = await setupTransactions(data, page);
  const dialog = await openTransactionForm(page);
  await fillTransaction(dialog, {
    amount: '25',
    description: 'Sin fecha',
    categoryLabel: category.name,
    date: '',
  });
  await dialog.getByRole('button', { name: 'Guardar transacción' }).click();
  await expect(dialog.getByText('Selecciona una fecha.')).toBeVisible();
  expect(await data.list<TestTransaction>('transactions', user.id)).toHaveLength(0);
});

test('cancelar alta no crea un movimiento', async ({ page, data }) => {
  const { user, category } = await setupTransactions(data, page);
  const dialog = await openTransactionForm(page);
  await fillTransaction(dialog, {
    amount: '50',
    description: 'Nunca se guarda',
    categoryLabel: category.name,
  });
  await dialog.getByRole('button', { name: 'Cancelar' }).click();
  await expect(dialog).not.toBeVisible();
  expect(await data.list<TestTransaction>('transactions', user.id)).toHaveLength(0);
});

test('edita cantidad y concepto manteniendo el ID', async ({ page, data }) => {
  const user = await data.createUser();
  const category = await data.category(user, { name: 'Edición E2E' });
  const transaction = await data.transaction(user, {
    categoryId: category.id,
    description: 'Original E2E',
    amount: 4.5,
  });
  await data.authenticated(page, user, '/transactions');
  await transactionRow(page, 'Original E2E')
    .getByRole('button', { name: 'Editar transacción' })
    .click();
  const dialog = transactionDialog(page);
  await fillTransaction(dialog, { description: 'Actualizado E2E', amount: '120.25' });
  await dialog.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(transactionRow(page, 'Actualizado E2E')).toBeVisible();
  const current = await data.get<TestTransaction>('transactions', transaction.id);
  expect(current).toMatchObject({
    id: transaction.id,
    amount: 120.25,
    description: 'Actualizado E2E',
  });
});

test('cancelar confirmación de borrado conserva el movimiento', async ({ page, data }) => {
  const user = await data.createUser();
  const transaction = await data.transaction(user, { description: 'Conservar E2E' });
  await data.authenticated(page, user, '/transactions');
  await transactionRow(page, 'Conservar E2E')
    .getByRole('button', { name: 'Eliminar transacción' })
    .click();
  const confirm = page.getByRole('dialog', { name: 'Eliminar transacción' });
  await expect(confirm).toBeVisible();
  await confirm.getByRole('button', { name: 'Cancelar' }).click();
  await expect(transactionRow(page, 'Conservar E2E')).toBeVisible();
  expect((await data.get<TestTransaction>('transactions', transaction.id)).id).toBe(transaction.id);
});

test('confirmación de borrado elimina solo el movimiento seleccionado', async ({ page, data }) => {
  const user = await data.createUser();
  const target = await data.transaction(user, { description: 'Borrar E2E' });
  const retained = await data.transaction(user, { description: 'Mantener E2E' });
  await data.authenticated(page, user, '/transactions');
  await transactionRow(page, 'Borrar E2E')
    .getByRole('button', { name: 'Eliminar transacción' })
    .click();
  await page
    .getByRole('dialog', { name: 'Eliminar transacción' })
    .getByRole('button', { name: 'Eliminar transacción' })
    .click();
  await expect(transactionRow(page, 'Borrar E2E')).toHaveCount(0);
  await expect(transactionRow(page, 'Mantener E2E')).toBeVisible();
  const records = await data.list<TestTransaction>('transactions', user.id);
  expect(records.map((item) => item.id)).toEqual([retained.id]);
  expect(records.map((item) => item.id)).not.toContain(target.id);
});

test('buscar por descripción filtra coincidencias sin borrar datos', async ({ page, data }) => {
  const user = await data.createUser();
  await data.transaction(user, { description: 'Fruta ecológica' });
  await data.transaction(user, { description: 'Billete tren' });
  await data.authenticated(page, user, '/transactions');
  await page.getByPlaceholder('Buscar por concepto, notas o categoría...').fill('Fruta');
  await expect(transactionRow(page, 'Fruta ecológica')).toBeVisible();
  await expect(transactionRow(page, 'Billete tren')).toHaveCount(0);
  expect(await data.list<TestTransaction>('transactions', user.id)).toHaveLength(2);
});

test('buscar por notas y limpiar filtros', async ({ page, data }) => {
  const user = await data.createUser();
  await data.transaction(user, { description: 'Movimiento ABC', notes: 'Factura secreta' });
  await data.transaction(user, { description: 'Movimiento XYZ' });
  await data.authenticated(page, user, '/transactions');
  await page.getByPlaceholder('Buscar por concepto, notas o categoría...').fill('secreta');
  await expect(transactionRow(page, 'Movimiento ABC')).toBeVisible();
  await expect(transactionRow(page, 'Movimiento XYZ')).toHaveCount(0);
  await page.getByRole('button', { name: 'Limpiar filtros' }).first().click();
  await expect(transactionRow(page, 'Movimiento XYZ')).toBeVisible();
});

test('filtro de tipo separa ingresos y gastos', async ({ page, data }) => {
  const user = await data.createUser();
  await data.transaction(user, { type: 'income', description: 'Ingreso filtrable' });
  await data.transaction(user, { type: 'expense', description: 'Gasto filtrable' });
  await data.authenticated(page, user, '/transactions');
  const group = page.getByRole('group', { name: 'Filtrar por tipo' });
  await group.getByRole('button', { name: /Ingresos/ }).click();
  await expect(transactionRow(page, 'Ingreso filtrable')).toBeVisible();
  await expect(transactionRow(page, 'Gasto filtrable')).toHaveCount(0);
  await group.getByRole('button', { name: /Gastos/ }).click();
  await expect(transactionRow(page, 'Gasto filtrable')).toBeVisible();
  await expect(transactionRow(page, 'Ingreso filtrable')).toHaveCount(0);
});

test('filtros de categoría y método de pago', async ({ page, data }) => {
  const user = await data.createUser();
  const first = await data.category(user, { name: 'Primera E2E' });
  const second = await data.category(user, { name: 'Segunda E2E' });
  await data.transaction(user, {
    description: 'Tarjeta E2E',
    categoryId: first.id,
    paymentMethod: 'card',
  });
  await data.transaction(user, {
    description: 'Efectivo E2E',
    categoryId: second.id,
    paymentMethod: 'cash',
  });
  await data.authenticated(page, user, '/transactions');
  await page.locator('.transactions-filters select').first().selectOption(first.id);
  await expect(transactionRow(page, 'Tarjeta E2E')).toBeVisible();
  await expect(transactionRow(page, 'Efectivo E2E')).toHaveCount(0);
  await page.locator('.transactions-filters select').first().selectOption('all');
  await page.locator('.transactions-filters select').nth(1).selectOption('cash');
  await expect(transactionRow(page, 'Efectivo E2E')).toBeVisible();
  await expect(transactionRow(page, 'Tarjeta E2E')).toHaveCount(0);
});

test('paginación muestra diferentes movimientos sin duplicados', async ({ page, data }) => {
  const user = await data.createUser();
  for (let i = 0; i < 12; i++)
    await data.transaction(user, { description: `Línea E2E ${String(i).padStart(2, '0')}` });
  await data.authenticated(page, user, '/transactions');
  await page.locator('#pageSize').selectOption('5');
  await expect(page.locator('.transactions-table tbody tr')).toHaveCount(5);
  const firstPage = await page.locator('.transaction-description-title').allTextContents();
  await page.getByRole('button', { name: 'Página siguiente' }).click();
  await expect(page.locator('.transactions-table tbody tr')).toHaveCount(5);
  const secondPage = await page.locator('.transaction-description-title').allTextContents();
  expect(firstPage.every((name) => !secondPage.includes(name))).toBeTruthy();
});

test('un error HTTP al guardar no cierra el formulario ni deja datos persistidos', async ({
  page,
  data,
}) => {
  const { user, category } = await setupTransactions(data, page);
  await page.route('**/api/transactions', async (route) => {
    if (route.request().method() === 'POST')
      await route.fulfill({ status: 500, body: 'Error simulado' });
    else await route.continue();
  });
  const dialog = await openTransactionForm(page);
  await fillTransaction(dialog, {
    amount: '11',
    description: 'Error API',
    categoryLabel: category.name,
  });
  await dialog.getByRole('button', { name: 'Guardar transacción' }).click();
  await expect(dialog.getByRole('alert')).toContainText(/No se ha podido guardar/);
  await expect(dialog).toBeVisible();
  expect(await data.list<TestTransaction>('transactions', user.id)).toHaveLength(0);
});

test('doble clic rápido en Guardar no duplica el movimiento', async ({ page, data }) => {
  const { user, category } = await setupTransactions(data, page);
  const dialog = await openTransactionForm(page);
  await fillTransaction(dialog, {
    amount: '15',
    description: 'Una sola vez E2E',
    categoryLabel: category.name,
  });
  await dialog.getByRole('button', { name: 'Guardar transacción' }).dblclick();
  await expect(dialog).not.toBeVisible();
  expect(await data.list<TestTransaction>('transactions', user.id)).toHaveLength(1);
});
