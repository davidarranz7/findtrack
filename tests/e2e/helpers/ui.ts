import { expect, type Locator, type Page } from '@playwright/test';
import type { TestUser } from '../fixtures/finora.fixture';

export const transactionDialog = (page: Page) =>
  page.getByRole('dialog', { name: /Nueva transacción|Editar transacción/ });
export const categoryDialog = (page: Page) =>
  page.getByRole('dialog', { name: /Nueva categoría|Editar categoría/ });
export const budgetDialog = (page: Page) =>
  page.getByRole('dialog', { name: /Crear presupuesto|Modificar presupuesto/ });
export const categoryCard = (page: Page, name: string) =>
  page.locator('.category-card').filter({ hasText: name });
export const transactionRow = (page: Page, description: string) =>
  page.locator('.transactions-table tbody tr').filter({ hasText: description });
export const budgetCard = (page: Page, name: string) =>
  page.locator('.budget-card').filter({ hasText: name });

export async function loginViaUI(
  page: Page,
  user: TestUser,
  remember = false,
  identifier = user.username,
) {
  await page.goto('/login');
  const alternate = page.getByRole('button', { name: 'Usar otra cuenta' });
  if (await alternate.isVisible().catch(() => false)) await alternate.click();
  await page.locator('#identifier').fill(identifier);
  await page.locator('#password').fill(user.password);
  if (remember) await page.locator('#rememberMe').check();
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
  await expect(page).toHaveURL(/\/overview(?:[/?#]|$)/);
  await expect(page.getByRole('region', { name: 'Resumen financiero' })).toBeVisible();
}

export async function openTransactionForm(page: Page) {
  await page.getByRole('button', { name: 'Nueva transacción' }).click();
  const dialog = transactionDialog(page);
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('#category option').first()).toBeAttached();
  await expect(dialog.getByRole('button', { name: 'Guardar transacción' })).toBeEnabled();
  return dialog;
}

export async function fillTransaction(
  dialog: Locator,
  props: {
    amount?: string;
    description?: string;
    categoryLabel?: string;
    type?: 'Gasto' | 'Ingreso';
    date?: string;
    method?: 'Efectivo' | 'Tarjeta' | 'Transferencia';
    notes?: string;
  },
) {
  if (props.type)
    await dialog
      .getByRole('group', { name: 'Tipo de transacción' })
      .getByRole('button', { name: props.type })
      .click();
  if (props.amount !== undefined) await dialog.locator('#amount').fill(props.amount);
  if (props.description !== undefined) await dialog.locator('#description').fill(props.description);
  if (props.categoryLabel) {
    const categoryOption = dialog
      .locator('#category option')
      .filter({ hasText: props.categoryLabel });
    await expect(
      categoryOption,
      `La categoría "${props.categoryLabel}" debe cargarse antes de seleccionarla`,
    ).toBeAttached({ timeout: 15_000 });
    await dialog.locator('#category').selectOption({ label: props.categoryLabel });
  }
  if (props.date !== undefined) await dialog.locator('#transactionDate').fill(props.date);
  if (props.method)
    await dialog
      .getByRole('group', { name: 'Método de pago o cobro' })
      .getByRole('button', { name: props.method })
      .click();
  if (props.notes !== undefined) await dialog.locator('#notes').fill(props.notes);
}
