import { expect, test } from './fixtures/finora.fixture';
import type { Page } from '@playwright/test';

const balanceChart = (page: Page) => page.locator('app-balance-evolution-chart canvas');

const categoryRow = (page: Page, name: string) =>
  page.locator('.top-category').filter({
    has: page.locator('.top-category-heading strong', { hasText: name }),
  });

async function hasColor(page: Page, hex: string): Promise<boolean> {
  return balanceChart(page).evaluate((canvas, color) => {
    const context = canvas.getContext('2d');
    if (!context) return false;
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const target = [1, 3, 5].map((i) => Number.parseInt(color.slice(i, i + 2), 16));

    for (let i = 0; i < data.length; i += 4) {
      if (
        data[i + 3] > 220 &&
        Math.abs(data[i] - target[0]) < 20 &&
        Math.abs(data[i + 1] - target[1]) < 20 &&
        Math.abs(data[i + 2] - target[2]) < 20
      ) {
        return true;
      }
    }
    return false;
  }, hex);
}

async function seed(page: Page, data: import('./fixtures/finora.fixture').FinoraData) {
  const user = await data.createUser();
  const leisure = await data.category(user, { name: 'Ocio líneas', color: '#f97316' });
  const health = await data.category(user, { name: 'Salud líneas', color: '#22c55e' });

  await data.transaction(user, { categoryId: leisure.id, amount: 100 });
  await data.transaction(user, { categoryId: health.id, amount: 60 });
  await data.authenticated(page, user, '/reports');

  await expect(categoryRow(page, 'Ocio líneas')).toBeVisible();
  await expect(categoryRow(page, 'Salud líneas')).toBeVisible();
}

test('balance: dos categorías seleccionadas dibujan dos líneas de sus colores y el total', async ({
  page,
  data,
}) => {
  await seed(page, data);
  await expect(
    page.getByRole('heading', { name: 'Evolución del balance', exact: true }),
  ).toBeVisible();

  await categoryRow(page, 'Ocio líneas').getByRole('button', { name: 'Filtrar' }).click();
  await categoryRow(page, 'Salud líneas').getByRole('button', { name: 'Filtrar' }).click();

  await expect(
    page.getByRole('heading', { name: 'Evolución del balance por categoría' }),
  ).toBeVisible();
  await expect(balanceChart(page)).toHaveAttribute(
    'aria-label',
    'Evolución del balance total y por categorías seleccionadas',
  );
  await expect.poll(() => hasColor(page, '#f97316')).toBe(true);
  await expect.poll(() => hasColor(page, '#22c55e')).toBe(true);
  await expect(page.locator('.report-balance-current')).toContainText('-160,00');
});

test('balance: al quitar una categoría recupera el gráfico de balance de una sola línea', async ({
  page,
  data,
}) => {
  await seed(page, data);
  await categoryRow(page, 'Ocio líneas').getByRole('button', { name: 'Filtrar' }).click();
  await categoryRow(page, 'Salud líneas').getByRole('button', { name: 'Filtrar' }).click();
  await expect.poll(() => hasColor(page, '#f97316')).toBe(true);

  await categoryRow(page, 'Salud líneas').getByRole('button', { name: 'Quitar filtro' }).click();
  await expect(
    page.getByRole('heading', { name: 'Evolución del balance', exact: true }),
  ).toBeVisible();
  await expect(balanceChart(page)).toHaveAttribute(
    'aria-label',
    'Evolución acumulada del balance durante el periodo seleccionado',
  );
  await expect.poll(() => hasColor(page, '#f97316')).toBe(false);
  await expect(page.locator('.report-balance-current')).toContainText('-100,00');
});

test('balance: limpiar selección restablece el balance de todas las categorías', async ({
  page,
  data,
}) => {
  await seed(page, data);
  await categoryRow(page, 'Ocio líneas').getByRole('button', { name: 'Filtrar' }).click();
  await categoryRow(page, 'Salud líneas').getByRole('button', { name: 'Filtrar' }).click();
  await page.getByRole('button', { name: 'Limpiar selección' }).click();

  await expect(
    page.getByRole('heading', { name: 'Evolución del balance', exact: true }),
  ).toBeVisible();
  await expect(balanceChart(page)).toHaveAttribute(
    'aria-label',
    'Evolución acumulada del balance durante el periodo seleccionado',
  );
  await expect(page.locator('.report-balance-current')).toContainText('-160,00');
});
