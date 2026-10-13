import { test, expect } from './fixtures/finora.fixture';

const API = 'http://127.0.0.1:3001';

for (const collection of [
  'users',
  'transactions',
  'categories',
  'budgets',
  'preferences',
  'notifications',
]) {
  test(`API privada: GET anónimo a ${collection} debe rechazarse`, async ({ request }) => {
    const response = await request.get(`${API}/${collection}`);
    expect([401, 403], `/${collection} no debe exponer datos anónimamente`).toContain(
      response.status(),
    );
  });
}

for (const collection of [
  'transactions',
  'categories',
  'budgets',
  'preferences',
  'notifications',
]) {
  test(`API privada: no permite crear ${collection} como usuario anónimo`, async ({
    request,
    data,
  }) => {
    const user = await data.createUser();
    const payload = {
      userId: user.id,
      description: 'Forjado',
      amount: 9999,
      name: 'Forjado',
      categoryId: null,
      month: '2026-10',
    };
    const response = await request.post(`${API}/${collection}`, { data: payload });
    if (response.ok()) {
      const item = (await response.json()) as { id: string };
      await request.delete(`${API}/${collection}/${item.id}`);
    }
    expect([401, 403]).toContain(response.status());
  });
}

for (const collection of [
  'transactions',
  'categories',
  'budgets',
  'preferences',
  'notifications',
]) {
  test(`API privada: GET con userId ajeno para ${collection} no es autorización`, async ({
    request,
    data,
  }) => {
    const owner = await data.createUser();
    await data.createUser();
    let id: string;
    if (collection === 'transactions') id = (await data.transaction(owner)).id;
    else if (collection === 'categories') id = (await data.category(owner)).id;
    else if (collection === 'budgets') {
      const category = await data.category(owner);
      id = (await data.budget(owner, category)).id;
    } else if (collection === 'notifications') id = (await data.notification(owner)).id;
    else
      id = (
        await data.create<{ id: string }>('preferences', {
          userId: owner.id,
          currency: 'EUR',
          locale: 'es-ES',
          dateFormat: 'DD/MM/YYYY',
          theme: 'light',
          budgetWarningEnabled: true,
          budgetExceededEnabled: true,
          savingsGoalEnabled: true,
        })
      ).id;
    const response = await request.get(`${API}/${collection}/${id}`);
    expect([401, 403]).toContain(response.status());
  });
}

test('API: importes fraccionarios negativos deben rechazarse sin necesidad del formulario', async ({
  request,
  data,
}) => {
  const owner = await data.createUser();
  const result = await request.post(`${API}/transactions`, {
    data: {
      userId: owner.id,
      amount: -0.01,
      type: 'expense',
      categoryId: null,
      description: 'Validación en servidor',
      date: '2026-10-11',
      paymentMethod: 'card',
      notes: '',
    },
  });
  if (result.ok()) {
    const payload = (await result.json()) as { id: string };
    await request.delete(`${API}/transactions/${payload.id}`);
  }
  expect([400, 422]).toContain(result.status());
});

test('API: vincular movimiento a categoría de otro usuario debe rechazarse', async ({
  request,
  data,
}) => {
  const owner = await data.createUser();
  const stranger = await data.createUser();
  const category = await data.category(owner);
  const response = await request.post(`${API}/transactions`, {
    data: {
      userId: stranger.id,
      categoryId: category.id,
      type: 'expense',
      amount: 20,
      description: 'Acceso cruzado',
      date: '2026-10-11',
      paymentMethod: 'card',
      notes: '',
    },
  });
  if (response.ok()) {
    const payload = (await response.json()) as { id: string };
    await request.delete(`${API}/transactions/${payload.id}`);
  }
  expect([400, 401, 403, 422]).toContain(response.status());
});
