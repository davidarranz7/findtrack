import { test, expect } from './fixtures/finora.fixture';

// Contratos de presentación: independientes del antialiasing y del sistema operativo.
// No sustituyen las pruebas de negocio ni las capturas visuales.
const viewports = [
  { name: 'móvil pequeño', width: 360, height: 800 },
  { name: 'móvil', width: 390, height: 844 },
  { name: 'tableta', width: 768, height: 1024 },
  { name: 'portátil', width: 1024, height: 768 },
  { name: 'escritorio', width: 1440, height: 900 },
] as const;

const screens = [
  { path: '/overview', label: 'Resumen' },
  { path: '/transactions', label: 'Transacciones' },
  { path: '/budgets', label: 'Presupuestos' },
  { path: '/categories', label: 'Categorías' },
  { path: '/reports', label: 'Informes y Estadísticas' },
  { path: '/settings', label: 'Configuración' },
] as const;

for (const viewport of viewports) {
  test(`@layout Categorías separa la cabecera de las tarjetas en ${viewport.name}`, async ({
    page,
    data,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const user = await data.createUser();
    await data.authenticated(page, user, '/categories');

    const header = page.locator('.categories-page > app-page-header');
    const summary = page.locator('.categories-summary');
    await expect(header).toBeVisible();
    await expect(summary).toBeVisible();
    await expect(summary.locator('.summary-card')).toHaveCount(3);

    const h = await header.boundingBox();
    const s = await summary.boundingBox();
    expect(h, 'No se encuentra la cabecera de Categorías').not.toBeNull();
    expect(s, 'No se encuentra el resumen de Categorías').not.toBeNull();
    if (!h || !s) return;

    const gap = s.y - (h.y + h.height);
    expect(
      gap,
      `Cabecera y tarjetas pegadas en ${viewport.width}px: ${gap}px`,
    ).toBeGreaterThanOrEqual(16);
    expect(s.y, 'El resumen se superpone a la cabecera').toBeGreaterThan(h.y + h.height);
  });

  test(`@layout Categorías distribuye tarjetas correctamente en ${viewport.name}`, async ({
    page,
    data,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const user = await data.createUser();
    for (const name of ['Alimentación', 'Ocio', 'Salud', 'Transporte']) {
      await data.category(user, { name });
    }
    await data.authenticated(page, user, '/categories');
    const cards = page.locator('.categories-grid .category-card');
    await expect(cards).toHaveCount(4);

    const positions = await cards.evaluateAll((elements) =>
      elements.map((element) => {
        const { x, y, width } = element.getBoundingClientRect();
        return { x, y, width };
      }),
    );

    const sameRow = (a: number, b: number) => Math.abs(positions[a].y - positions[b].y) <= 2;
    if (viewport.width < 768) {
      expect(sameRow(0, 1), 'Móvil: las categorías deben apilarse').toBe(false);
      expect(Math.abs(positions[0].x - positions[1].x)).toBeLessThanOrEqual(2);
    } else {
      expect(sameRow(0, 1), 'Escritorio/tableta: dos primeras tarjetas en la misma fila').toBe(
        true,
      );
      expect(positions[1].x).toBeGreaterThan(positions[0].x);
    }

    for (const position of positions) {
      expect(position.width).toBeGreaterThan(80);
      expect(
        position.x + position.width,
        'Tarjeta fuera del ancho de la ventana',
      ).toBeLessThanOrEqual(viewport.width + 3);
    }
  });
}

for (const screen of screens) {
  for (const viewport of [viewports[1], viewports[4]]) {
    test(`@layout ${screen.label}: sin scroll horizontal y título visible en ${viewport.name}`, async ({
      page,
      data,
    }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const user = await data.createUser();
      await data.authenticated(page, user, screen.path);
      await expect(page.locator('.app-main').getByRole('heading', { level: 1 })).toBeVisible();

      const widths = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        document: document.documentElement.scrollWidth,
      }));
      expect(
        widths.document,
        `Desbordamiento horizontal en ${screen.path}, ${viewport.width}px`,
      ).toBeLessThanOrEqual(widths.viewport + 3);
    });
  }
}

test('@layout El cuadro de nueva categoría permanece visible y accesible en móvil', async ({
  page,
  data,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const user = await data.createUser();
  await data.authenticated(page, user, '/categories');
  await page.getByRole('button', { name: 'Nueva categoría' }).click();

  const dialog = page.getByRole('dialog', { name: 'Nueva categoría' });
  await expect(dialog).toBeVisible();
  const rect = await dialog.boundingBox();
  expect(rect).not.toBeNull();
  if (!rect) return;
  expect(rect.width).toBeGreaterThan(250);
  expect(rect.x).toBeGreaterThanOrEqual(-2);
  expect(rect.x + rect.width).toBeLessThanOrEqual(392);
  await page.keyboard.press('Escape');
  // Según el diseño actual, el modal puede cerrarse con su botón; comprobar el cierre real.
  if (await dialog.isVisible()) {
    await dialog.getByRole('button', { name: 'Cerrar' }).click();
  }
  await expect(dialog).toHaveCount(0);
});
