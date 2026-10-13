import { readFile } from 'node:fs/promises';
import { test, expect } from './fixtures/finora.fixture';

const categoryRow = (page: import('@playwright/test').Page, name: string) =>
  page.locator('.top-category').filter({
    has: page.locator('.top-category-heading strong', { hasText: name }),
  });

const totalExpenses = (page: import('@playwright/test').Page) =>
  page.locator('.reports-kpis .report-kpi').filter({ hasText: 'Gastos totales' });

const distribution = (page: import('@playwright/test').Page) =>
  page.locator('app-expense-distribution-chart .distribution-legend .legend-item');

async function prepareReport(
  data: import('./fixtures/finora.fixture').FinoraData,
  page: import('@playwright/test').Page,
) {
  const user = await data.createUser();
  const leisure = await data.category(user, { name: 'Ocio multiselección' });
  const health = await data.category(user, { name: 'Salud multiselección' });
  const transport = await data.category(user, { name: 'Transporte multiselección' });

  await data.transaction(user, { categoryId: leisure.id, amount: 100, paymentMethod: 'card' });
  await data.transaction(user, { categoryId: health.id, amount: 50, paymentMethod: 'cash' });
  await data.transaction(user, { categoryId: transport.id, amount: 25, paymentMethod: 'card' });
  await data.transaction(user, { categoryId: null, amount: 10, paymentMethod: 'card' });
  await data.authenticated(page, user, '/reports');
  await expect(totalExpenses(page)).toContainText('185,00');
  await expect(distribution(page)).toHaveCount(4);
  return { leisure, health, transport };
}

test('ranking: se pueden filtrar dos categorías sin ocultar las demás', async ({ page, data }) => {
  await prepareReport(data, page);

  await categoryRow(page, 'Ocio multiselección').getByRole('button', { name: 'Filtrar' }).click();
  await expect(totalExpenses(page)).toContainText('100,00');
  await expect(distribution(page)).toHaveCount(1);
  await expect(page.locator('.top-category')).toHaveCount(4);
  // El ranking sigue mostrando el porcentaje del período completo, no 100 % del filtro.
  await expect(
    categoryRow(page, 'Ocio multiselección').locator('.top-category-footer small'),
  ).toContainText('54.1');

  await categoryRow(page, 'Salud multiselección').getByRole('button', { name: 'Filtrar' }).click();
  await expect(totalExpenses(page)).toContainText('150,00');
  await expect(distribution(page)).toHaveCount(2);
  await expect(page.locator('#report-category')).toHaveValue('multiple');
  await expect(page.locator('#report-category option:checked')).toHaveText(
    '2 categorías seleccionadas',
  );
  await expect(
    categoryRow(page, 'Ocio multiselección').getByRole('button', { name: 'Quitar filtro' }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(
    categoryRow(page, 'Transporte multiselección').getByRole('button', { name: 'Filtrar' }),
  ).toBeVisible();
});

test('ranking: limpiar selección recupera el gráfico completo', async ({ page, data }) => {
  await prepareReport(data, page);

  await categoryRow(page, 'Ocio multiselección').getByRole('button', { name: 'Filtrar' }).click();
  await categoryRow(page, 'Salud multiselección').getByRole('button', { name: 'Filtrar' }).click();
  await page.getByRole('button', { name: 'Limpiar selección' }).click();

  await expect(totalExpenses(page)).toContainText('185,00');
  await expect(distribution(page)).toHaveCount(4);
  await expect(page.locator('#report-category')).toHaveValue('all');
  await expect(page.getByRole('button', { name: 'Limpiar selección' })).toHaveCount(0);
});

test('ranking: quitar la última categoría seleccionada restablece todas', async ({
  page,
  data,
}) => {
  await prepareReport(data, page);

  const leisureRow = categoryRow(page, 'Ocio multiselección');
  await leisureRow.getByRole('button', { name: 'Filtrar' }).click();
  await expect(totalExpenses(page)).toContainText('100,00');
  await leisureRow.getByRole('button', { name: 'Quitar filtro' }).click();

  await expect(totalExpenses(page)).toContainText('185,00');
  await expect(page.locator('#report-category')).toHaveValue('all');
});

test('ranking y selector superior permanecen sincronizados', async ({ page, data }) => {
  const { leisure, transport } = await prepareReport(data, page);

  await categoryRow(page, 'Ocio multiselección').getByRole('button', { name: 'Filtrar' }).click();
  await categoryRow(page, 'Salud multiselección').getByRole('button', { name: 'Filtrar' }).click();
  await page.locator('#report-category').selectOption(transport.id);

  await expect(totalExpenses(page)).toContainText('25,00');
  await expect(page.locator('#report-category')).toHaveValue(transport.id);
  await expect(
    categoryRow(page, 'Ocio multiselección').getByRole('button', { name: 'Filtrar' }),
  ).toBeVisible();
  await page.locator('#report-category').selectOption(leisure.id);
  await expect(totalExpenses(page)).toContainText('100,00');
  await page.locator('#report-category').selectOption('all');
  await expect(totalExpenses(page)).toContainText('185,00');
});

test('limpiar categorías desde ranking conserva el filtro por método de pago', async ({
  page,
  data,
}) => {
  await prepareReport(data, page);

  await page.locator('#report-payment-method').selectOption('card');
  await expect(totalExpenses(page)).toContainText('135,00');
  await expect(page.locator('.top-category')).toHaveCount(3);
  await categoryRow(page, 'Ocio multiselección').getByRole('button', { name: 'Filtrar' }).click();
  await expect(totalExpenses(page)).toContainText('100,00');
  await page.getByRole('button', { name: 'Limpiar selección' }).click();

  await expect(page.locator('#report-payment-method')).toHaveValue('card');
  await expect(totalExpenses(page)).toContainText('135,00');
  await expect(distribution(page)).toHaveCount(3);
});

test('ranking: permite combinar Sin categoría con una categoría normal', async ({ page, data }) => {
  await prepareReport(data, page);

  await categoryRow(page, 'Sin categoría').getByRole('button', { name: 'Filtrar' }).click();
  await expect(totalExpenses(page)).toContainText('10,00');
  await categoryRow(page, 'Salud multiselección').getByRole('button', { name: 'Filtrar' }).click();
  await expect(totalExpenses(page)).toContainText('60,00');
  await expect(distribution(page)).toHaveCount(2);
});

test('exportación CSV incluye las categorías múltiples seleccionadas', async ({ page, data }) => {
  await prepareReport(data, page);
  await categoryRow(page, 'Ocio multiselección').getByRole('button', { name: 'Filtrar' }).click();
  await categoryRow(page, 'Salud multiselección').getByRole('button', { name: 'Filtrar' }).click();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'CSV', exact: true }).click();
  const csv = await readFile(await (await downloadPromise).path(), 'utf8');

  expect(csv).toContain('Ocio multiselección, Salud multiselección');
  expect(csv).not.toContain('Transporte multiselección');
});
