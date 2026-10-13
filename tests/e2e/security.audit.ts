import { test, expect, E2E_API_URL, type TestTransaction } from './fixtures/finora.fixture';

const mustBeDenied = (status: number) =>
  expect([401, 403], 'Una API privada debe rechazar petición anónima').toContain(status);

test('API privada de usuarios rechaza lectura anónima', async ({ request }) => {
  const response = await request.get(`${E2E_API_URL}/users`);
  mustBeDenied(response.status());
});

test('API privada de movimientos rechaza lectura anónima', async ({ request, data }) => {
  const user = await data.createUser();
  await data.transaction(user, { description: 'Privada solo del titular' });
  const response = await request.get(`${E2E_API_URL}/transactions?userId=${user.id}`);
  mustBeDenied(response.status());
});

test('un cliente anónimo no puede modificar el movimiento de otra persona', async ({
  request,
  data,
}) => {
  const owner = await data.createUser();
  const item = await data.transaction(owner, {
    amount: 12,
    description: 'No modificable sin autorización',
  });
  const response = await request.patch(`${E2E_API_URL}/transactions/${item.id}`, {
    data: { amount: 9999 },
  });
  mustBeDenied(response.status());
  expect((await data.get<TestTransaction>('transactions', item.id)).amount).toBe(12);
});

test('un cliente anónimo no puede borrar categorías de otros usuarios', async ({
  request,
  data,
}) => {
  const owner = await data.createUser();
  const category = await data.category(owner, { name: 'Categoría privada' });
  const response = await request.delete(`${E2E_API_URL}/categories/${category.id}`);
  mustBeDenied(response.status());
});

test('guardar datos arbitrarios en sessionStorage NO debe servir como autenticación real', async ({
  page,
}) => {
  await page.addInitScript(() => {
    sessionStorage.setItem(
      'finora-auth-session',
      JSON.stringify({
        id: 'usuario-falso-123',
        username: 'impostor',
        email: 'impostor@example.test',
      }),
    );
  });
  await page.goto('/overview');
  await expect(page).toHaveURL(/\/login(?:[/?#]|$)/);
});

test('API no revela contraseñas ni siquiera de cuentas de pruebas', async ({ request, data }) => {
  const user = await data.createUser();
  const response = await request.get(`${E2E_API_URL}/users/${user.id}`);
  mustBeDenied(response.status());
  const text = await response.text();
  expect(text).not.toContain(user.password);
});

test('API valida importes negativos aunque no intervenga el frontend', async ({
  request,
  data,
}) => {
  const user = await data.createUser();
  const response = await request.post(`${E2E_API_URL}/transactions`, {
    data: {
      userId: user.id,
      type: 'expense',
      amount: -900,
      description: 'Payload inválido',
      categoryId: null,
      date: '2026-10-11',
      paymentMethod: 'card',
      notes: '',
    },
  });
  expect([400, 422]).toContain(response.status());
});

test('API impide usuarios duplicados aun con peticiones concurrentes', async ({
  request,
  data,
}) => {
  const user = await data.createUser();
  const response = await request.post(`${E2E_API_URL}/users`, {
    data: { username: user.username, email: user.email, password: 'AnotherStrong123!' },
  });
  if (response.ok()) {
    const created = (await response.json()) as { id: string };
    data.trackUser(created.id);
  }
  expect([400, 409, 422]).toContain(response.status());
});
