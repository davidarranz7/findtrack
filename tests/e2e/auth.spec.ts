import { test, expect } from './fixtures/finora.fixture';
import { loginViaUI } from './helpers/ui';

const privateRoutes = [
  '/overview',
  '/transactions',
  '/categories',
  '/budgets',
  '/reports',
  '/settings',
];

for (const path of privateRoutes) {
  test(`@smoke sin sesión redirige desde ${path} al login`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login(?:[/?#]|$)/);
    await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
  });
}

test('@smoke usuario válido inicia sesión usando el nombre', async ({ page, data }) => {
  const user = await data.createUser();
  await loginViaUI(page, user);
  await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible();
});

test('usuario válido inicia sesión usando su correo con otras mayúsculas', async ({
  page,
  data,
}) => {
  const user = await data.createUser();
  await loginViaUI(page, user, false, user.email.toUpperCase());
});

test('contraseña incorrecta no crea sesión', async ({ page, data }) => {
  const user = await data.createUser();
  await page.goto('/login');
  await page.locator('#identifier').fill(user.username);
  await page.locator('#password').fill('Incorrecta123!');
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText(/incorrectos/i);
  await expect(page).toHaveURL(/\/login(?:[/?#]|$)/);
  await expect
    .poll(() => page.evaluate(() => sessionStorage.getItem('finora-auth-session')))
    .toBeNull();
});

test('login vacío valida usuario y contraseña y no navega', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
  await expect(page.getByText('Introduce tu usuario o correo electrónico.')).toBeVisible();
  await expect(page.getByText('La contraseña es obligatoria.')).toBeVisible();
  await expect(page).toHaveURL(/\/login(?:[/?#]|$)/);
});

test('sesión autenticada persiste al recargar la página', async ({ page, data }) => {
  const user = await data.createUser();
  await loginViaUI(page, user);
  await page.reload();
  await expect(page).toHaveURL(/\/overview(?:[/?#]|$)/);
  await expect(page.getByRole('heading', { name: new RegExp(user.username) })).toBeVisible();
});

test('al cerrar sesión desaparece la sesión y vuelven a bloquearse las rutas', async ({
  page,
  data,
}) => {
  const user = await data.createUser();
  await loginViaUI(page, user);
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page).toHaveURL(/\/login(?:[/?#]|$)/);
  await expect
    .poll(() => page.evaluate(() => sessionStorage.getItem('finora-auth-session')))
    .toBeNull();
  await page.goto('/transactions');
  await expect(page).toHaveURL(/\/login(?:[/?#]|$)/);
});

test('recordar cuenta conserva identidad pero no inicia sesión sin contraseña', async ({
  page,
  data,
}) => {
  const user = await data.createUser();
  await loginViaUI(page, user, true);
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page).toHaveURL(/\/login(?:[/?#]|$)/);
  await expect(page.getByRole('button', { name: `Continuar como ${user.username}` })).toBeVisible();
  await page.goto('/overview');
  await expect(page).toHaveURL(/\/login(?:[/?#]|$)/);
  await page.getByRole('button', { name: `Continuar como ${user.username}` }).click();
  await expect(page.locator('#rememberedPassword')).toBeVisible();
  await page.locator('#rememberedPassword').fill(user.password);
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
  await expect(page).toHaveURL(/\/overview(?:[/?#]|$)/);
});

test('abrir un contexto nuevo de navegador no hereda la sesión', async ({
  browser,
  page,
  data,
}) => {
  const user = await data.createUser();
  await loginViaUI(page, user);
  const isolatedContext = await browser.newContext();
  try {
    const isolatedPage = await isolatedContext.newPage();
    await isolatedPage.goto('http://127.0.0.1:4201/overview');
    await expect(isolatedPage).toHaveURL(/\/login(?:[/?#]|$)/);
  } finally {
    await isolatedContext.close();
  }
});

test('registro válido crea la cuenta y vuelve al login', async ({ page, data }) => {
  const username = `reg${Date.now()}`;
  await page.goto('/register');
  await page.locator('#username').fill(username);
  await page.locator('#email').fill(`${username}@example.test`);
  await page.locator('#password').fill('FinoraStrong123!');
  await page.locator('#confirmPassword').fill('FinoraStrong123!');
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await expect(page).toHaveURL(/\/login(?:[/?#]|$)/, { timeout: 15_000 });
  const response = await page.request.get('http://127.0.0.1:3001/users');
  const users = (await response.json()) as { id: string; username: string }[];
  const registered = users.find((user) => user.username === username);
  expect(registered).toBeDefined();
  if (registered) data.trackUser(registered.id);
});

for (const password of ['abcdefgh', 'Abcdefgh', 'Abc12345!']) {
  test(`registro permite contraseña con al menos ocho caracteres aunque sea débil: ${password}`, async ({
    page,
    data,
  }) => {
    const username = `weak${Date.now()}${Math.random().toString(36).slice(2, 7)}`;
    await page.goto('/register');
    await page.locator('#username').fill(username);
    await page.locator('#email').fill(`${username}@example.test`);
    await page.locator('#password').fill(password);
    await page.locator('#confirmPassword').fill(password);
    await expect(
      page.getByRole('progressbar', { name: 'Seguridad de la contraseña' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Crear cuenta' }).click();
    await expect(page).toHaveURL(/\/login(?:[/?#]|$)/, { timeout: 15_000 });
    const response = await page.request.get('http://127.0.0.1:3001/users');
    const users = (await response.json()) as { id: string; username: string; password: string }[];
    const created = users.find((user) => user.username === username);
    expect(created).toBeDefined();
    expect(created?.password).toBe(password);
    if (created) data.trackUser(created.id);
  });
}

test('registro rechaza contraseña corta sin crear usuario', async ({ page }) => {
  const username = `short${Date.now()}`;
  await page.goto('/register');
  await page.locator('#username').fill(username);
  await page.locator('#email').fill(`${username}@example.test`);
  await page.locator('#password').fill('abc');
  await page.locator('#confirmPassword').fill('abc');
  await page.getByRole('button', { name: 'Crear cuenta' }).click();

  await expect(page).toHaveURL(/\/register(?:[/?#]|$)/);
  await expect(page.getByText('La contraseña debe tener al menos 8 caracteres.')).toBeVisible();

  const response = await page.request.get('http://127.0.0.1:3001/users', {
    params: { username },
  });
  expect(response.ok()).toBeTruthy();
  const users = (await response.json()) as { username: string }[];
  expect(users).toHaveLength(0);
});

test('registro mantiene contraseña obligatoria aunque la fortaleza sea orientativa', async ({
  page,
}) => {
  await page.goto('/register');
  await page.locator('#username').fill('e2euser1234');
  await page.locator('#email').fill('e2euser1234@example.test');
  await page.locator('#password').fill('');
  await page.locator('#confirmPassword').fill('');
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await expect(page).toHaveURL(/\/register(?:[/?#]|$)/);
  await expect(page.getByText('La contraseña es obligatoria.')).toBeVisible();
});

test('registro rechaza confirmación de contraseña distinta', async ({ page }) => {
  await page.goto('/register');
  await page.locator('#username').fill('testdifferent123');
  await page.locator('#email').fill('different@example.test');
  await page.locator('#password').fill('Strong123!');
  await page.locator('#confirmPassword').fill('Other123!');
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await expect(page).toHaveURL(/\/register(?:[/?#]|$)/);
  await expect(page.getByText(/coinciden/i)).toBeVisible();
});

test('registro rechaza correo ya registrado', async ({ page, data }) => {
  const user = await data.createUser();
  await page.goto('/register');
  await page.locator('#username').fill(`another_${user.username}`);
  await page.locator('#email').fill(user.email);
  await page.locator('#password').fill('Strong123!');
  await page.locator('#confirmPassword').fill('Strong123!');
  await expect(page.getByText('Este correo electrónico ya está registrado.')).toBeVisible();
});
