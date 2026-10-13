import { readFile } from 'node:fs/promises';
import { test, expect, monthNow, type TestTransaction } from './fixtures/finora.fixture';
import { openTransactionForm, fillTransaction } from './helpers/ui';

const overviewCard = (page: import('@playwright/test').Page, label: string) =>
  page.locator('.summary-grid .summary-card').filter({ hasText: label });
const reportKpi = (page: import('@playwright/test').Page, label: string) =>
  page.locator('.reports-kpis .report-kpi').filter({ hasText: label });

test('@smoke Resumen calcula ingresos, gastos, balance y ahorro con los datos del usuario', async ({
  page,
  data,
}) => {
  const user = await data.createUser();
  await data.transaction(user, { type: 'income', amount: 1000, description: 'Ingreso resumen' });
  await data.transaction(user, { type: 'expense', amount: 325.45, description: 'Gasto resumen' });
  await data.authenticated(page, user);
  await expect(overviewCard(page, 'Ingresos totales')).toContainText(/1\.?000,00/);
  await expect(overviewCard(page, 'Gastos totales')).toContainText('325,45');
  await expect(overviewCard(page, 'Balance disponible')).toContainText('674,55');
  await expect(overviewCard(page, 'Ahorro del mes')).toContainText('674,55');
});

test('balance disponible incluye movimientos de meses previos; KPI mensual no', async ({
  page,
  data,
}) => {
  const user = await data.createUser();
  await data.transaction(user, { type: 'income', amount: 800, date: '2025-01-15' });
  await data.transaction(user, { type: 'income', amount: 100, description: 'Actual' });
  await data.authenticated(page, user);
  await expect(overviewCard(page, 'Ingresos totales')).toContainText('100,00');
  await expect(overviewCard(page, 'Balance disponible')).toContainText('900,00');
});

test('sin transacciones el Resumen muestra ceros sin errores técnicos', async ({ page, data }) => {
  const user = await data.createUser();
  await data.authenticated(page, user);
  await expect(overviewCard(page, 'Balance disponible')).toContainText('0,00');
  await expect(page.getByText('Todavía no hay datos para mostrar')).toBeVisible();
  await expect(page.getByRole('heading', { name: new RegExp(user.username) })).toBeVisible();
});

test('Resumen actualiza los KPI tras crear una transacción', async ({ page, data }) => {
  const user = await data.createUser();
  const category = await data.category(user, { name: 'Gasto Overview E2E' });
  await data.authenticated(page, user);
  const dialog = await openTransactionForm(page);
  await fillTransaction(dialog, {
    amount: '14.50',
    description: 'Compra en Overview',
    categoryLabel: category.name,
  });
  await dialog.getByRole('button', { name: 'Guardar transacción' }).click();
  await expect(overviewCard(page, 'Gastos totales')).toContainText('14,50');
  expect(await data.list<TestTransaction>('transactions', user.id)).toHaveLength(1);
});

test('Informe presenta totales coherentes para el periodo activo', async ({ page, data }) => {
  const user = await data.createUser();
  await data.transaction(user, { type: 'income', amount: 300, description: 'Ingreso informes' });
  await data.transaction(user, { type: 'expense', amount: 75.25, description: 'Gasto informes' });
  await data.authenticated(page, user, '/reports');
  await expect(reportKpi(page, 'Ingresos totales')).toContainText('300,00');
  await expect(reportKpi(page, 'Gastos totales')).toContainText('75,25');
  await expect(reportKpi(page, 'Balance neto')).toContainText('224,75');
  await expect(reportKpi(page, 'Tasa de ahorro')).toContainText(/74[,.]9/);
});

test('filtros de informes por categoría', async ({ page, data }) => {
  const user = await data.createUser();
  const first = await data.category(user, { name: 'Informe alimentación E2E' });
  const second = await data.category(user, { name: 'Informe transporte E2E' });
  await data.transaction(user, { categoryId: first.id, amount: 22 });
  await data.transaction(user, { categoryId: second.id, amount: 45 });
  await data.authenticated(page, user, '/reports');
  await page.locator('#report-category').selectOption(first.id);
  await expect(reportKpi(page, 'Gastos totales')).toContainText('22,00');
  await page.getByRole('button', { name: 'Limpiar filtros' }).click();
  await expect(reportKpi(page, 'Gastos totales')).toContainText('67,00');
});

test('filtro de informes por método de pago', async ({ page, data }) => {
  const user = await data.createUser();
  await data.transaction(user, { amount: 30, paymentMethod: 'cash' });
  await data.transaction(user, { amount: 50, paymentMethod: 'card' });
  await data.authenticated(page, user, '/reports');
  await page.locator('#report-payment-method').selectOption('cash');
  await expect(reportKpi(page, 'Gastos totales')).toContainText('30,00');
});

test('informes filtran transacciones sin categoría', async ({ page, data }) => {
  const user = await data.createUser();
  const cat = await data.category(user, { name: 'Categorizado E2E' });
  await data.transaction(user, { categoryId: null, amount: 8.5 });
  await data.transaction(user, { categoryId: cat.id, amount: 15 });
  await data.authenticated(page, user, '/reports');
  await page.locator('#report-category').selectOption('uncategorized');
  await expect(reportKpi(page, 'Gastos totales')).toContainText('8,50');
});

test('informe sin datos tiene exportaciones deshabilitadas', async ({ page, data }) => {
  const user = await data.createUser();
  await data.authenticated(page, user, '/reports');
  await expect(page.getByRole('button', { name: 'CSV', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Exportar PDF' })).toBeDisabled();
});

test('CSV exportado contiene encabezados y operaciones esperadas', async ({ page, data }) => {
  const user = await data.createUser();
  await data.transaction(user, {
    description: 'Factura CSV E2E',
    amount: 19.95,
    notes: 'Nota test',
  });
  await data.authenticated(page, user, '/reports');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'CSV', exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.csv$/i);
  const csv = await readFile(await download.path(), 'utf8');
  expect(csv).toContain(
    '"Fecha";"Descripción";"Tipo";"Categoría";"Método de pago";"Importe";"Notas"',
  );
  expect(csv).toContain('Factura CSV E2E');
  expect(csv).toContain('19,95');
});

test('CSV trata correctamente comillas, punto y coma y salto de línea', async ({ page, data }) => {
  const user = await data.createUser();
  const description = 'Texto; "especial" E2E';
  await data.transaction(user, { description, notes: 'línea uno\nlínea dos' });
  await data.authenticated(page, user, '/reports');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'CSV', exact: true }).click();
  const csv = await readFile(await (await downloadPromise).path(), 'utf8');
  expect(csv).toContain('"Texto; ""especial"" E2E"');
  expect(csv).toContain('línea uno\nlínea dos');
});

test('PDF genera un archivo con cabecera PDF reconocible', async ({ page, data }) => {
  test.setTimeout(90_000);
  const user = await data.createUser();
  await data.transaction(user, { amount: 25, description: 'Prueba PDF E2E' });
  await data.authenticated(page, user, '/reports');
  const downloadPromise = page.waitForEvent('download', { timeout: 75_000 });
  await page.getByRole('button', { name: 'Exportar PDF' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
  const file = await readFile(await download.path());
  expect(file.subarray(0, 5).toString()).toBe('%PDF-');
  expect(file.byteLength).toBeGreaterThan(1000);
});

test('activar comparación de periodos muestra referencia del periodo anterior', async ({
  page,
  data,
}) => {
  const user = await data.createUser();
  await data.transaction(user, { amount: 20 });
  await data.authenticated(page, user, '/reports');
  await page.locator('#report-comparison').check();
  await expect(page.getByText(/Comparando con/)).toBeVisible();
  await page.locator('#report-comparison').uncheck();
  await expect(page.getByText(/Comparando con/)).toHaveCount(0);
});
