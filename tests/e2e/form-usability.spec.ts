import { test, expect } from './fixtures/finora.fixture';
import { budgetDialog, openTransactionForm } from './helpers/ui';

test('alta de transacción: el importe empieza vacío, no con un cero obligatorio', async ({
  page,
  data,
}) => {
  const user = await data.createUser();
  await data.authenticated(page, user, '/transactions');
  const dialog = await openTransactionForm(page);
  await expect(dialog.locator('#amount')).toHaveValue('');
  await dialog.locator('#amount').fill('123.45');
  await expect(dialog.locator('#amount')).toHaveValue('123.45');
});

test('alta de presupuesto: el importe empieza vacío, no con un cero obligatorio', async ({
  page,
  data,
}) => {
  const user = await data.createUser();
  await data.category(user, { name: 'Categoría para presupuesto UX' });
  await data.authenticated(page, user, '/budgets');
  await page.getByRole('button', { name: 'Nuevo presupuesto' }).click();
  const dialog = budgetDialog(page);
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('#budget-amount')).toHaveValue('');
  await dialog.locator('#budget-amount').fill('123.45');
  await expect(dialog.locator('#budget-amount')).toHaveValue('123.45');
});

test('edición de presupuesto: mantiene el importe previo en lugar de borrarlo', async ({
  page,
  data,
}) => {
  const user = await data.createUser();
  const category = await data.category(user, { name: 'Categoría presupuesto edición UX' });
  await data.budget(user, category, { amount: 145.6 });
  await data.authenticated(page, user, '/budgets');
  await page
    .locator('.budget-card')
    .filter({ hasText: category.name })
    .getByRole('button', { name: 'Editar presupuesto' })
    .click();
  await expect(budgetDialog(page).locator('#budget-amount')).toHaveValue('145.6');
});
