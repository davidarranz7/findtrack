import { lstat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const cwd = process.cwd();

const targetPath = resolve(cwd, 'mock-api/db.e2e.json');
const developmentPath = resolve(cwd, 'mock-api/db.json');

const emptyDatabase = {
  users: [],
  transactions: [],
  budgets: [],
  categories: [],
  preferences: [],
  notifications: [],
};

// Evita sobrescribir la base de datos de desarrollo.
if (targetPath === developmentPath) {
  throw new Error('Protección de datos: el destino no puede ser la base de desarrollo.');
}

// Evita escribir sobre un enlace simbólico.
try {
  const targetStats = await lstat(targetPath);

  if (targetStats.isSymbolicLink()) {
    throw new Error('Protección de datos: db.e2e.json no puede ser un enlace simbólico.');
  }

  if (!targetStats.isFile()) {
    throw new Error('Protección de datos: db.e2e.json debe ser un archivo.');
  }
} catch (error) {
  if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'ENOENT') {
    throw error;
  }
}

// Restablece exclusivamente la base utilizada por Playwright.
await writeFile(targetPath, `${JSON.stringify(emptyDatabase, null, 2)}\n`, 'utf8');

process.stdout.write(`Base E2E restablecida: ${targetPath}\n`);
