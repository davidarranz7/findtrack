import { test, expect } from './fixtures/finora.fixture';

for (const count of [2, 5, 10]) {
  test(`preferencias: ${count} navegaciones consecutivas no crean duplicados`, async ({
    page,
    data,
  }) => {
    const user = await data.createUser();
    await data.authenticated(page, user, '/overview');
    for (let index = 0; index < count; index++) {
      await page.goto(index % 2 === 0 ? '/settings' : '/overview');
      await expect(page).toHaveURL(
        index % 2 === 0 ? /\/settings(?:[/?#]|$)/ : /\/overview(?:[/?#]|$)/,
      );
    }
    await expect.poll(async () => (await data.list('preferences', user.id)).length).toBe(1);
  });
}

test('preferencias: cambiar avisos y navegar no borra la configuración', async ({ page, data }) => {
  const user = await data.createUser();
  await data.authenticated(page, user, '/settings');
  await expect(page.locator('#budget-warning-enabled')).toBeChecked();
  await page.locator('#budget-warning-enabled').uncheck();
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled();
  await page.goto('/overview');
  await page.goto('/settings');
  await expect(page.locator('#budget-warning-enabled')).not.toBeChecked();
  const prefs = await data.list<{ id: string; budgetWarningEnabled: boolean }>(
    'preferences',
    user.id,
  );
  expect(prefs).toHaveLength(1);
  expect(prefs[0].budgetWarningEnabled).toBe(false);
});

test('preferencias: dos pestañas concurrentes no deben crear duplicados', async ({
  browser,
  data,
}) => {
  const user = await data.createUser();
  const context = await browser.newContext();
  try {
    const [pageA, pageB] = await Promise.all([context.newPage(), context.newPage()]);
    await Promise.all([
      pageA.goto('http://127.0.0.1:4201/login'),
      pageB.goto('http://127.0.0.1:4201/login'),
    ]);
    for (const page of [pageA, pageB]) {
      await page.evaluate((authenticatedUser) => {
        sessionStorage.setItem('finora-auth-session', JSON.stringify(authenticatedUser));
      }, user);
    }
    await Promise.all([
      pageA.goto('http://127.0.0.1:4201/overview'),
      pageB.goto('http://127.0.0.1:4201/settings'),
    ]);
    await expect.poll(async () => (await data.list('preferences', user.id)).length).toBe(1);
  } finally {
    await context.close();
  }
});
