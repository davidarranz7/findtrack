import { test, expect, type TestNotification, type TestUser } from './fixtures/finora.fixture';

async function settings(
  page: import('@playwright/test').Page,
  data: import('./fixtures/finora.fixture').FinoraData,
) {
  const user = await data.createUser();
  await data.authenticated(page, user, '/settings');
  await expect(page.locator('#settings-username')).toHaveValue(user.username);
  return user;
}

test('sin cambios, Guardar y Descartar permanecen deshabilitados', async ({ page, data }) => {
  await settings(page, data);
  await expect(page.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Descartar' })).toBeDisabled();
});

test('correo inválido no se puede guardar', async ({ page, data }) => {
  const user = await settings(page, data);
  await page.locator('#settings-email').fill('correo-invalido');
  await page.locator('#settings-email').blur();
  await expect(page.getByText('Introduce un correo electrónico válido.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled();
  expect((await data.get<TestUser>('users', user.id)).email).toBe(user.email);
});

test('Descartar restablece los datos originales', async ({ page, data }) => {
  const user = await settings(page, data);
  await page.locator('#settings-username').fill('temporaltest');
  await page.getByRole('button', { name: 'Descartar' }).click();
  await expect(page.locator('#settings-username')).toHaveValue(user.username);
  await expect(page.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled();
});

test('editar perfil guarda y refleja el cambio después de recargar', async ({ page, data }) => {
  const user = await settings(page, data);
  const newName = `cambio${Date.now()}`;
  await page.locator('#settings-username').fill(newName);
  await expect(page.getByRole('button', { name: 'Guardar cambios' })).toBeEnabled({
    timeout: 12_000,
  });
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect
    .poll(async () => (await data.get<TestUser>('users', user.id)).username)
    .toBe(newName);
  await page.reload();
  await expect(page.locator('#settings-username')).toHaveValue(newName);
});

test('rechaza cambio de perfil a nombre duplicado', async ({ page, data }) => {
  const other = await data.createUser();
  const user = await settings(page, data);
  await page.locator('#settings-username').fill(other.username);
  await expect(page.getByText('Este nombre de usuario ya está en uso.')).toBeVisible({
    timeout: 12_000,
  });
  await expect(page.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled();
  expect((await data.get<TestUser>('users', user.id)).username).toBe(user.username);
});

test('cambiar contraseña con la actual incorrecta no persiste nada', async ({ page, data }) => {
  const user = await settings(page, data);
  await page.getByRole('button', { name: 'Cambiar contraseña' }).click();
  await page.locator('#settings-current-password').fill('NoEsLaActual');
  await page.locator('#settings-new-password').fill('NuevaSuper123!');
  await page.locator('#settings-confirm-password').fill('NuevaSuper123!');
  await page
    .locator('.password-editor-actions')
    .getByRole('button', { name: 'Cambiar contraseña' })
    .click();
  await expect(
    page.getByText(/contraseña actual.*incorrecta|contraseña actual no es correcta/i),
  ).toBeVisible();
  expect((await data.get<TestUser>('users', user.id)).password).toBe(user.password);
});

test('cambiar contraseña correcta actualiza credenciales para nuevo login', async ({
  page,
  data,
}) => {
  const user = await settings(page, data);
  await page.getByRole('button', { name: 'Cambiar contraseña' }).click();
  await page.locator('#settings-current-password').fill(user.password);
  await page.locator('#settings-new-password').fill('NuevaSegura123!');
  await page.locator('#settings-confirm-password').fill('NuevaSegura123!');
  await page
    .locator('.password-editor-actions')
    .getByRole('button', { name: 'Cambiar contraseña' })
    .click();
  await expect
    .poll(async () => (await data.get<TestUser>('users', user.id)).password)
    .toBe('NuevaSegura123!');
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await page.locator('#identifier').fill(user.username);
  await page.locator('#password').fill('NuevaSegura123!');
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click();
  await expect(page).toHaveURL(/\/overview(?:[/?#]|$)/);
});

test('@smoke preferencia de aviso se mantiene después de guardar y recargar', async ({
  page,
  data,
}) => {
  const user = await settings(page, data);
  const toggle = page.locator('#budget-warning-enabled');
  await expect(toggle).toBeChecked();
  await toggle.uncheck();
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled();
  await page.reload();
  await expect(page.locator('#budget-warning-enabled')).not.toBeChecked();
  const preferences = await data.list<{ budgetWarningEnabled: boolean }>('preferences', user.id);
  expect(preferences).toHaveLength(1);
  expect(preferences[0].budgetWarningEnabled).toBe(false);
});

test('modo oscuro y claro no impiden utilizar la aplicación', async ({ page, data }) => {
  const user = await data.createUser();
  await data.authenticated(page, user);
  await page.getByRole('button', { name: 'Activar modo oscuro' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-bs-theme', 'dark');
  await page.getByRole('button', { name: 'Activar modo claro' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-bs-theme', 'light');
});

test('notificaciones vacías muestra estado comprensible', async ({ page, data }) => {
  const user = await data.createUser();
  await data.authenticated(page, user);
  await page.getByRole('button', { name: 'Notificaciones' }).click();
  await expect(page.getByText('No tienes notificaciones')).toBeVisible();
});

test('marcar notificaciones como leídas actualiza el servidor', async ({ page, data }) => {
  const user = await data.createUser();
  await data.notification(user, { title: 'Aviso prueba 1' });
  await data.notification(user, { title: 'Aviso prueba 2' });
  await data.authenticated(page, user);
  await page.getByRole('button', { name: 'Notificaciones' }).click();
  await expect(page.getByText('Aviso prueba 1')).toBeVisible();
  await page.getByRole('button', { name: 'Marcar todas como leídas' }).click();
  await expect
    .poll(async () =>
      (await data.list<TestNotification>('notifications', user.id)).every((n) => n.isRead),
    )
    .toBeTruthy();
});

test('notificaciones de un segundo usuario no se muestran', async ({ page, data }) => {
  const first = await data.createUser();
  const second = await data.createUser();
  await data.notification(first, { title: 'Notificación privada primera' });
  await data.notification(second, { title: 'Notificación privada segunda' });
  await data.authenticated(page, first);
  await page.getByRole('button', { name: 'Notificaciones' }).click();
  await expect(page.getByText('Notificación privada primera')).toBeVisible();
  await expect(page.getByText('Notificación privada segunda')).toHaveCount(0);
});
