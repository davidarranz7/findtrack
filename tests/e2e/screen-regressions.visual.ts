import { test, expect } from './fixtures/finora.fixture';

// Suite opcional: necesita capturas de referencia APROBADAS manualmente.
// No se ejecuta con `npx playwright test` normal.
// Crear o revisar las referencias: FINORA_VISUAL=1 + --update-snapshots.
test.use({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  reducedMotion: 'reduce',
});

async function prepareCategories(
  page: import('@playwright/test').Page,
  data: import('./fixtures/finora.fixture').FinoraData,
) {
  await page.clock.setFixedTime(new Date('2026-10-13T10:00:00+02:00'));
  const user = await data.createUser();
  await data.category(user, { name: 'Alimentación', color: '#f97316' });
  await data.category(user, { name: 'Ocio', color: '#db2777' });
  await data.category(user, { name: 'Salud', color: '#10b981' });
  await data.authenticated(page, user, '/categories');
  await expect(page.locator('.category-card')).toHaveCount(3);
  await expect(page.locator('.categories-summary .spinner-border')).toHaveCount(0);
}

for (const viewport of [
  { name: 'escritorio', width: 1440, height: 900 },
  { name: 'tableta', width: 768, height: 1024 },
  { name: 'móvil', width: 390, height: 844 },
]) {
  test(`@visual Categorías — ${viewport.name} — claro`, async ({ page, data }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await prepareCategories(page, data);
    await expect(page.locator('.categories-page')).toHaveScreenshot(
      `categories-${viewport.name}-light.png`,
      { animations: 'disabled', caret: 'hide', maxDiffPixelRatio: 0.01 },
    );
  });
}

test('@visual Categorías — escritorio — oscuro', async ({ page, data }) => {
  await prepareCategories(page, data);
  await page.getByRole('button', { name: 'Activar modo oscuro' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-bs-theme', 'dark');
  await expect(page.locator('.categories-page')).toHaveScreenshot('categories-desktop-dark.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
  });
});

test('@visual Presupuestos sin registros — escritorio', async ({ page, data }) => {
  await page.clock.setFixedTime(new Date('2026-10-13T10:00:00+02:00'));
  const user = await data.createUser();
  await data.authenticated(page, user, '/budgets');
  await expect(page.getByText('No tienes presupuestos este mes')).toBeVisible();
  await expect(page.locator('.budgets-page')).toHaveScreenshot('budgets-empty-desktop.png', {
    animations: 'disabled',
    caret: 'hide',
    maxDiffPixelRatio: 0.01,
  });
});
