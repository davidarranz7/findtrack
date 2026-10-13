import { test, expect, type TestUser } from './fixtures/finora.fixture';

const API_USERS = 'http://127.0.0.1:3001/users';

function uniqueUser(prefix = 'finora') {
  return `${prefix}${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
}

async function fillRegistration(
  page: import('@playwright/test').Page,
  username: string,
  password: string,
  confirmation = password,
) {
  await page.goto('/register');
  await page.locator('#username').fill(username);
  await page.locator('#email').fill(`${uniqueUser('mail')}@example.test`);
  await page.locator('#password').fill(password);
  await page.locator('#confirmPassword').fill(confirmation);
}

async function registeredUser(
  page: import('@playwright/test').Page,
  username: string,
): Promise<TestUser | undefined> {
  const response = await page.request.get(API_USERS, {
    params: { username },
  });
  expect(response.ok()).toBeTruthy();
  const users = (await response.json()) as TestUser[];
  return users.find((user) => user.username === username);
}

test.describe('Registro: normas de usuario y contraseña', () => {
  for (const username of [
    'David',
    'DAVID',
    'david arranz',
    ' david',
    'david ',
    'david!',
    'david@123',
    'david-123',
    'davidñ',
    'davidá',
  ]) {
    test(`rechaza nombre de usuario inválido: ${JSON.stringify(username)}`, async ({ page }) => {
      await fillRegistration(page, username, 'abcdefgh');
      await expect(
        page.getByText('Usa solo letras minúsculas, números, puntos (.) y guiones bajos (_).'),
      ).toBeVisible();
      await page.getByRole('button', { name: 'Crear cuenta' }).click();
      await expect(page).toHaveURL(/\/register(?:[/?#]|$)/);
      expect(await registeredUser(page, username)).toBeUndefined();
    });
  }

  for (const suffix of ['abc', 'abc_123', 'abc.123', 'a123']) {
    test(`acepta formato de usuario: ${suffix}`, async ({ page, data }) => {
      const username = `${suffix}${uniqueUser('')}`;
      await fillRegistration(page, username, 'abcdefgh');
      await page.getByRole('button', { name: 'Crear cuenta' }).click();
      await expect(page).toHaveURL(/\/login(?:[/?#]|$)/, { timeout: 20_000 });
      const user = await registeredUser(page, username);
      expect(user).toBeDefined();
      if (user) data.trackUser(user.id);
    });
  }

  for (const password of ['abc', 'abcdefg']) {
    test(`rechaza contraseña de menos de 8 caracteres: ${password.length}`, async ({ page }) => {
      const username = uniqueUser();
      await fillRegistration(page, username, password);
      await page.getByRole('button', { name: 'Crear cuenta' }).click();
      await expect(page.getByText('La contraseña debe tener al menos 8 caracteres.')).toBeVisible();
      await expect(page).toHaveURL(/\/register(?:[/?#]|$)/);
      expect(await registeredUser(page, username)).toBeUndefined();
    });
  }

  for (const password of ['abcdefgh', 'Abcdefgh', 'abcdefg1', 'abcdefg!']) {
    test(`acepta contraseña de 8 caracteres sin exigir toda la complejidad: ${password}`, async ({
      page,
      data,
    }) => {
      const username = uniqueUser();
      await fillRegistration(page, username, password);
      await expect(
        page.getByRole('progressbar', { name: 'Seguridad de la contraseña' }),
      ).toBeVisible();
      await page.getByRole('button', { name: 'Crear cuenta' }).click();
      await expect(page).toHaveURL(/\/login(?:[/?#]|$)/, { timeout: 20_000 });
      const user = await registeredUser(page, username);
      expect(user).toBeDefined();
      if (user) data.trackUser(user.id);
    });
  }

  test('rechaza contraseñas que no coinciden', async ({ page }) => {
    const username = uniqueUser();
    await fillRegistration(page, username, 'abcdefgh', 'abcdefgh1');
    await page.getByRole('button', { name: 'Crear cuenta' }).click();
    await expect(page.getByText('Las contraseñas no coinciden.')).toBeVisible();
    await expect(page).toHaveURL(/\/register(?:[/?#]|$)/);
    expect(await registeredUser(page, username)).toBeUndefined();
  });

  test('rechaza nombre de usuario con menos de cuatro caracteres', async ({ page }) => {
    await fillRegistration(page, 'abc', 'abcdefgh');
    await page.getByRole('button', { name: 'Crear cuenta' }).click();
    await expect(page.getByText('El usuario debe tener al menos 4 caracteres.')).toBeVisible();
    expect(await registeredUser(page, 'abc')).toBeUndefined();
  });
});
