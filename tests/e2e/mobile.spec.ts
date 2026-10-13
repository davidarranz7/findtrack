import { test, expect } from './fixtures/finora.fixture';
import { loginViaUI, openTransactionForm } from './helpers/ui';

test.use({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 3,
});

test('el menú móvil abre, navega y se cierra', async ({ page, data }) => {
  const user = await data.createUser();
  await data.authenticated(page, user);
  await page.getByRole('button', { name: 'Abrir menú de navegación' }).click();
  await expect(
    page.getByRole('button', { name: 'Cerrar menú de navegación' }).first(),
  ).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Navegación principal' })
    .getByRole('link', { name: 'Transacciones' })
    .click();
  await expect(page).toHaveURL(/\/transactions(?:[/?#]|$)/);
  await expect(page.getByRole('button', { name: 'Abrir menú de navegación' })).toBeVisible();
});

test('tocar el fondo cierra el menú móvil', async ({ page, data }) => {
  const user = await data.createUser();
  await data.authenticated(page, user);
  await page.getByRole('button', { name: 'Abrir menú de navegación' }).click();
  await page.locator('.mobile-sidebar-backdrop').click({ position: { x: 250, y: 100 } });
  await expect(page.locator('.mobile-sidebar-backdrop')).toHaveCount(0);
});

test('los campos de formulario tienen tamaño suficiente para evitar zoom de iOS', async ({
  page,
  data,
}) => {
  const user = await data.createUser();
  await data.category(user, { name: 'Móvil E2E' });
  await data.authenticated(page, user, '/transactions');
  const dialog = await openTransactionForm(page);
  for (const selector of ['#amount', '#description', '#notes', '#category']) {
    const size = await dialog
      .locator(selector)
      .evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize));
    expect(size, `font-size de ${selector}`).toBeGreaterThanOrEqual(16);
  }
});

test('pantallas principales no tienen desbordamiento horizontal significativo', async ({
  page,
  data,
}) => {
  const user = await data.createUser();
  await data.authenticated(page, user);
  for (const path of [
    '/overview',
    '/transactions',
    '/categories',
    '/budgets',
    '/reports',
    '/settings',
  ]) {
    await page.goto(path);
    const measure = await page.evaluate(() => ({
      width: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth,
    }));
    expect(measure.content, `desbordamiento en ${path}`).toBeLessThanOrEqual(measure.width + 3);
  }
});

test('buscador móvil se abre y puede cerrarse', async ({ page, data }) => {
  const user = await data.createUser();
  await data.authenticated(page, user);
  await page.getByRole('button', { name: 'Abrir búsqueda' }).click();
  await expect(
    page.getByRole('searchbox', { name: 'Buscar transacciones en Finora' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar búsqueda' }).first().click();
  await expect(page.getByRole('button', { name: 'Abrir búsqueda' })).toBeVisible();
});

test('al iniciar sesión desde móvil la animación termina y deja navegar', async ({
  page,
  data,
}) => {
  test.setTimeout(60_000);
  const user = await data.createUser();
  await loginViaUI(page, user);
  await expect(page.locator('app-mobile-login-splash.is-playing')).toHaveCount(0, {
    timeout: 15_000,
  });
  await page.getByRole('button', { name: 'Abrir menú de navegación' }).click();
  await expect(page.getByRole('navigation', { name: 'Navegación principal' })).toBeVisible();
});
