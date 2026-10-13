import { lstat, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const cwd = process.cwd();
const seedPath = resolve(cwd, 'mock-api/db.e2e.seed.json');
const targetPath = resolve(cwd, 'mock-api/db.e2e.json');
const expectedCollections = [
  'users',
  'transactions',
  'budgets',
  'categories',
  'preferences',
  'notifications',
];
const seed = JSON.parse(await readFile(seedPath, 'utf8'));

if (
  !expectedCollections.every(
    (collection) => Array.isArray(seed[collection]) && seed[collection].length === 0,
  )
) {
  throw new Error(
    'La semilla E2E debe contener exclusivamente colecciones vacías. No se ha alterado ningún archivo.',
  );
}
if (targetPath === resolve(cwd, 'mock-api/db.json')) {
  throw new Error('Protección de datos: destino idéntico a la base de desarrollo.');
}
try {
  if ((await lstat(targetPath)).isSymbolicLink()) {
    throw new Error('Protección: db.e2e.json no puede ser un enlace simbólico.');
  }
} catch (error) {
  if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')) {
    throw error;
  }
}
await writeFile(targetPath, `${JSON.stringify(seed, null, 2)}\n`, 'utf8');
process.stdout.write(`Base E2E restablecida: ${targetPath}\n`);
