import { test, expect, type TestTransaction } from './fixtures/finora.fixture';
import { fillTransaction, openTransactionForm, transactionRow } from './helpers/ui';

test('error de carga de transacciones se muestra sin bloquear la aplicación', async ({
  page,
  data,
}) => {
  const user = await data.createUser();
  await page.route('**/api/transactions?**', (route) =>
    route.fulfill({ status: 503, body: 'API indisponible' }),
  );
  await data.authenticated(page, user, '/transactions');
  await expect(page.getByRole('alert')).toContainText(/No se han podido cargar|Error|Inténtalo/i);
  await expect(page.getByRole('button', { name: 'Nueva transacción' })).toBeVisible();
});

test('fallo de categorías en formulario muestra error sin crear datos', async ({ page, data }) => {
  const user = await data.createUser();
  await data.authenticated(page, user, '/transactions');
  await page.route('**/api/categories?**', (route) =>
    route.fulfill({ status: 503, body: 'API indisponible' }),
  );
  const dialog = await openTransactionForm(page);
  await expect(dialog.getByText('No se han podido cargar las categorías.')).toBeVisible();
  expect(await data.list<TestTransaction>('transactions', user.id)).toHaveLength(0);
});

test('si falla la eliminación de transacción, se conserva y se puede reintentar', async ({
  page,
  data,
}) => {
  const user = await data.createUser();
  const transaction = await data.transaction(user, { description: 'No perder por error' });
  await data.authenticated(page, user, '/transactions');
  await page.route(`**/api/transactions/${transaction.id}`, async (route) => {
    if (route.request().method() === 'DELETE')
      await route.fulfill({ status: 500, body: 'Error simulado' });
    else await route.continue();
  });
  await transactionRow(page, 'No perder por error')
    .getByRole('button', { name: 'Eliminar transacción' })
    .click();
  const modal = page.getByRole('dialog', { name: 'Eliminar transacción' });
  await modal.getByRole('button', { name: 'Eliminar transacción' }).click();
  await expect(modal.getByRole('alert')).toContainText('No se ha podido eliminar');
  expect((await data.get<TestTransaction>('transactions', transaction.id)).id).toBe(transaction.id);
  await page.unroute(`**/api/transactions/${transaction.id}`);
  await modal.getByRole('button', { name: 'Eliminar transacción' }).click();
  await expect(transactionRow(page, 'No perder por error')).toHaveCount(0);
});

test('al recuperar conexión, guardar tras un fallo no duplica movimientos', async ({
  page,
  data,
}) => {
  const user = await data.createUser();
  const category = await data.category(user, { name: 'Reintento E2E' });
  await data.authenticated(page, user, '/transactions');
  let failed = false;
  await page.route('**/api/transactions', async (route) => {
    if (route.request().method() === 'POST' && !failed) {
      failed = true;
      await route.fulfill({ status: 503, body: 'Temporal' });
    } else await route.continue();
  });
  const dialog = await openTransactionForm(page);
  await fillTransaction(dialog, {
    amount: '20',
    description: 'Único tras reintento',
    categoryLabel: category.name,
  });
  await dialog.getByRole('button', { name: 'Guardar transacción' }).click();
  await expect(dialog.getByRole('alert')).toBeVisible();
  await dialog.getByRole('button', { name: 'Guardar transacción' }).click();
  await expect(dialog).not.toBeVisible();
  const transactions = await data.list<TestTransaction>('transactions', user.id);
  expect(transactions).toHaveLength(1);
});

test('texto que parece HTML o script se muestra como texto sin ejecutar', async ({
  page,
  data,
}) => {
  const user = await data.createUser();
  const text = '<img src=x onerror=alert(1)> E2E';
  await data.transaction(user, { description: text });
  const dialogs: string[] = [];
  page.on('dialog', (dialog) => {
    dialogs.push(dialog.message());
    void dialog.dismiss();
  });
  await data.authenticated(page, user, '/transactions');
  await expect(transactionRow(page, text)).toBeVisible();
  expect(dialogs).toHaveLength(0);
  expect(await page.locator('.transactions-table tbody tr img').count()).toBe(0);
});

test('no aparecen transacciones del usuario anterior al cambiar de cuenta', async ({
  page,
  data,
}) => {
  const one = await data.createUser();
  const two = await data.createUser();
  await data.transaction(one, { description: 'Solo cuenta primera' });
  await data.transaction(two, { description: 'Solo cuenta segunda' });
  await data.authenticated(page, one, '/transactions');
  await expect(transactionRow(page, 'Solo cuenta primera')).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await page.locator('#identifier').fill(two.username);
  await page.locator('#password').fill(two.password);
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
  await page.goto('/transactions');
  await expect(transactionRow(page, 'Solo cuenta segunda')).toBeVisible();
  await expect(transactionRow(page, 'Solo cuenta primera')).toHaveCount(0);
});

test('campos de formulario contienen límites HTML para texto y notas', async ({ page, data }) => {
  const user = await data.createUser();
  await data.category(user);
  await data.authenticated(page, user, '/transactions');
  const dialog = await openTransactionForm(page);
  await expect(dialog.locator('#description')).toHaveAttribute('maxlength', '120');
  await expect(dialog.locator('#notes')).toHaveAttribute('maxlength', '500');
});
