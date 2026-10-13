import { test, expect, type TestTransaction } from './fixtures/finora.fixture';
import { dateInMonth, monthShift } from './helpers/dates';
import {
  fillTransaction,
  openTransactionForm,
  transactionDialog,
  transactionRow,
} from './helpers/ui';

for (const [label, value] of [
  ['cero', '0'],
  ['negativo', '-0.01'],
  ['negativo grande', '-99999.99'],
  ['vacío', ''],
  ['minúscula fracción', '0.001'],
] as const) {
  test(`importe inválido (${label}) no genera transacciones`, async ({ page, data }) => {
    const user = await data.createUser();
    const category = await data.category(user, { name: 'Validación monetaria' });
    await data.authenticated(page, user, '/transactions');
    const dialog = await openTransactionForm(page);
    await fillTransaction(dialog, {
      amount: value,
      categoryLabel: category.name,
      description: `Importe ${label}`,
    });
    await dialog.getByRole('button', { name: 'Guardar transacción' }).click();
    await expect(dialog).toBeVisible();
    expect(await data.list<TestTransaction>('transactions', user.id)).toHaveLength(0);
  });
}

for (const [label, amount, expected] of [
  ['un céntimo', '0.01', 0.01],
  ['centésimas', '0.09', 0.09],
  ['dos decimales', '12.50', 12.5],
  ['mil euros', '1000', 1000],
  ['múltiples millares', '999999.99', 999999.99],
] as const) {
  for (const type of ['Gasto', 'Ingreso'] as const) {
    test(`importe válido (${label}, ${type}) persiste con el valor exacto`, async ({
      page,
      data,
    }) => {
      const user = await data.createUser();
      const category = await data.category(user, { name: 'Monto exacto' });
      await data.authenticated(page, user, '/transactions');
      const dialog = await openTransactionForm(page);
      await fillTransaction(dialog, {
        amount,
        type,
        categoryLabel: category.name,
        description: `${label} ${type}`,
      });
      await dialog.getByRole('button', { name: 'Guardar transacción' }).click();
      await expect(dialog).not.toBeVisible();
      const entries = await data.list<TestTransaction>('transactions', user.id);
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({
        amount: expected,
        type: type === 'Ingreso' ? 'income' : 'expense',
      });
    });
  }
}

for (const [label, raw, expected] of [
  ['nombre con espacios al principio', '   Viaje', 'Viaje'],
  ['nombre con espacios finales', 'Viaje   ', 'Viaje'],
  ['texto con tildes', 'Compra de piñón y café', 'Compra de piñón y café'],
  ['nombre con símbolos', 'Agua & Luz (50%)', 'Agua & Luz (50%)'],
  ['nombre Unicode', 'Suscripción 日本語 €', 'Suscripción 日本語 €'],
  ['texto largo permitido', 'D'.repeat(120), 'D'.repeat(120)],
] as const) {
  test(`descripción (${label}) se guarda y no se pierde al recargar`, async ({ page, data }) => {
    const user = await data.createUser();
    const category = await data.category(user, { name: 'Texto' });
    await data.authenticated(page, user, '/transactions');
    const dialog = await openTransactionForm(page);
    await fillTransaction(dialog, { amount: '12', description: raw, categoryLabel: category.name });
    await dialog.getByRole('button', { name: 'Guardar transacción' }).click();
    const records = await data.list<TestTransaction>('transactions', user.id);
    expect(records).toHaveLength(1);
    expect(records[0].description).toBe(expected);
    await page.reload();
    await expect(transactionRow(page, expected)).toBeVisible();
  });
}

for (const offset of [-18, -12, -6, -1, 0]) {
  test(`transacción creada desde formulario con fecha ${monthShift(offset)} aparece solo en su mes`, async ({
    page,
    data,
  }) => {
    const user = await data.createUser();
    const category = await data.category(user, { name: 'Mes formulario' });
    await data.authenticated(page, user, '/transactions');
    const dialog = await openTransactionForm(page);
    const description = `Fecha manual ${offset}`;
    await fillTransaction(dialog, {
      amount: '44.35',
      description,
      categoryLabel: category.name,
      date: dateInMonth(offset),
    });
    await dialog.getByRole('button', { name: 'Guardar transacción' }).click();
    await expect(dialog).not.toBeVisible();
    const entries = await data.list<TestTransaction>('transactions', user.id);
    expect(entries).toHaveLength(1);
    expect(entries[0].date).toBe(dateInMonth(offset));
    await page.locator('input[type="month"]').fill(monthShift(offset));
    await expect(transactionRow(page, description)).toBeVisible();
  });
}

for (const method of ['Efectivo', 'Tarjeta', 'Transferencia'] as const) {
  for (const type of ['Gasto', 'Ingreso'] as const) {
    test(`método ${method} y tipo ${type} persisten al editar sin alterar ID`, async ({
      page,
      data,
    }) => {
      const user = await data.createUser();
      const category = await data.category(user, { name: 'Métodos E2E' });
      await data.authenticated(page, user, '/transactions');
      const dialog = await openTransactionForm(page);
      await fillTransaction(dialog, {
        amount: '27',
        description: `Método ${method} ${type}`,
        categoryLabel: category.name,
        method,
        type,
      });
      await dialog.getByRole('button', { name: 'Guardar transacción' }).click();
      const [created] = await data.list<TestTransaction>('transactions', user.id);
      expect(created).toMatchObject({
        paymentMethod:
          method === 'Efectivo' ? 'cash' : method === 'Tarjeta' ? 'card' : 'bankTransfer',
        type: type === 'Ingreso' ? 'income' : 'expense',
      });
      await transactionRow(page, created.description)
        .getByRole('button', { name: 'Editar transacción' })
        .click();
      const edit = transactionDialog(page);
      await expect(edit).toBeVisible();
      await fillTransaction(edit, { amount: '28.40' });
      await edit.getByRole('button', { name: 'Guardar cambios' }).click();
      await expect(edit).not.toBeVisible();
      const after = await data.get<TestTransaction>('transactions', created.id);
      expect(after).toMatchObject({
        id: created.id,
        amount: 28.4,
        paymentMethod: created.paymentMethod,
        type: created.type,
      });
      expect(await data.list<TestTransaction>('transactions', user.id)).toHaveLength(1);
    });
  }
}

for (const offset of [-12, -1, 0]) {
  test(`editar fecha entre meses mantiene una sola transacción: ${offset}`, async ({
    page,
    data,
  }) => {
    const user = await data.createUser();
    const category = await data.category(user, { name: 'Cambio de mes' });
    const original = await data.transaction(user, {
      categoryId: category.id,
      description: `Mover entre meses ${offset}`,
      date: dateInMonth(0),
    });
    await data.authenticated(page, user, '/transactions');
    await transactionRow(page, original.description)
      .getByRole('button', { name: 'Editar transacción' })
      .click();
    const edit = transactionDialog(page);
    await fillTransaction(edit, {
      date: dateInMonth(offset),
      description: `${original.description} editado`,
    });
    await edit.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(edit).not.toBeVisible();
    const entry = await data.get<TestTransaction>('transactions', original.id);
    expect(entry.date).toBe(dateInMonth(offset));
    expect(await data.list<TestTransaction>('transactions', user.id)).toHaveLength(1);
    await page.locator('input[type="month"]').fill(monthShift(offset));
    await expect(transactionRow(page, `${original.description} editado`)).toBeVisible();
  });
}

test('integridad: doble clic rápido no debe guardar dos veces', async ({ page, data }) => {
  const user = await data.createUser();
  const category = await data.category(user, { name: 'Antiduplicado' });
  await data.authenticated(page, user, '/transactions');
  const dialog = await openTransactionForm(page);
  await fillTransaction(dialog, {
    amount: '15',
    description: 'Doble clic robustez',
    categoryLabel: category.name,
  });
  await dialog.getByRole('button', { name: 'Guardar transacción' }).dblclick();
  await expect(dialog).not.toBeVisible();
  expect(await data.list<TestTransaction>('transactions', user.id)).toHaveLength(1);
});
