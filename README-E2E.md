# Finora — Playwright E2E, versión 2

Preparado a partir del código de `src.zip` y de los fallos de la primera ejecución (74 correctas y 25 fallidas). Se ha comprobado la sintaxis de los TypeScript y la estructura del ZIP. **No se ha ejecutado contra el proyecto Angular completo en este entorno**; los resultados definitivos solo se obtienen ejecutándolo en tu ordenador.

## Instalación

1. Haz un commit o copia de seguridad de la suite E2E actual, por si necesitas comparar resultados.
2. Descomprime el ZIP **en la raíz de `findtrack/`**, junto a `package.json`. El ZIP sustituye la configuración y tests E2E anteriores. No sustituye `src/app/`, `angular.json`, `mock-api/db.json` ni tus servicios de desarrollo.
3. Asegúrate de que las dependencias están instaladas:

   ```powershell
   npm install -D @playwright/test @types/node
   npx playwright install chromium
   ```

4. Mantén libres los puertos **3001 y 4201**. Los puertos de desarrollo 3000 y 4200 se mantienen independientes.
5. Ejecuta la comprobación de archivos y la prueba rápida antes de lanzar todas:

   ```powershell
   npx tsc --project tsconfig.e2e.json
   npx playwright test --list
   npx playwright test --grep "@smoke"
   ```

## Seguridad de los datos E2E

- Playwright arranca JSON Server en **3001** y Angular en **4201**, con `src/proxy.e2e.conf.json`.
- **Cada nueva ejecución que inicia el servidor E2E restablece automáticamente `mock-api/db.e2e.json` a las seis colecciones vacías** de `mock-api/db.e2e.seed.json`. Se borrarán SOLO los registros temporales de pruebas anteriores de esta base E2E. **Nunca se modifica `mock-api/db.json`.**
- No guardes información personal en `db.e2e.json`.
- El fixture crea usuarios únicos para las pruebas y al terminar elimina las entidades por `userId`, tolerando los borrados ya efectuados. El test comprueba previamente que el proxy de Angular E2E realmente conecta con la API 3001.
- `workers: 1`, suites separadas y usuario por prueba reducen colisiones y falsos positivos. Se guarda evidencia de fallos (capturas, vídeo y traza).
- El entorno de tests no garantiza aislamiento ante configuraciones externas modificadas manualmente. No alteres puertos ni rutas de datos sin revisarlos.

## Modos de ejecución

Desde la raíz del proyecto:

```powershell
npx playwright test --grep "@smoke"
npx playwright test
npx playwright test tests/e2e/history-categories.spec.ts
npx playwright test tests/e2e/transaction-matrix.spec.ts
npx playwright test tests/e2e/budget-integrity.spec.ts
npx playwright test --headed
npx playwright show-report
```

**Pruebas de volumen:** separadas para no alargar cada ejecución de desarrollo. Incluyen 720 movimientos combinados y 180 presupuestos en 36 meses:

```powershell
$env:FINORA_STRESS = '1'
npx playwright test
Remove-Item Env:FINORA_STRESS
```

**Auditoría de seguridad:** exige respuestas de autorización propias de un backend real. **JSON Server NO las implementa**, por lo que varias pruebas fallarán por diseño. No son pruebas que deban maquillarse como correctas:

```powershell
$env:FINORA_SECURITY_AUDIT = '1'
npx playwright test
Remove-Item Env:FINORA_SECURITY_AUDIT
```

Para revisar una traza:

```powershell
npx playwright show-report
```

## Cobertura de la versión 2

- **Primera batería completa, conservada:** login, registro, guard, logout, cuenta recordada, edición de usuario, transacciones, filtros, paginación, categorías, presupuestos, resumen, informes, exportación CSV/PDF, notificaciones, móvil y fallos de red.
- `history-categories.spec.ts`: conserva ID, fecha, importe, método de pago, nota y propiedad de movimientos cuando se borra una categoría; verifica los meses anteriores, confirmaciones, categoría ajena, edición y bloqueo por presupuestos históricos.
- `month-matrix.spec.ts`: meses anteriores, cruce de año, efectos de cambiar el mes, cálculos, 36 meses de histórico y preservación de céntimos.
- `transaction-matrix.spec.ts`: importes límite, ingresos y gastos, 3 métodos, cambios de mes, 120 caracteres, Unicode, edición y doble clic.
- `budget-integrity.spec.ts`: límites en 0%, 79,99%, 80%, 99,99%, 100%, 100,01%, 250%; ingresos no cuentan como gastos, transacciones eliminadas, categoría y presupuesto independientes.
- `category-matrix.spec.ts`: Unicode, tildes, 40 caracteres, espacios de control, reuso de nombre y aislamiento de usuarios.
- `calendar-boundaries.spec.ts`: febrero bisiesto, meses de distinta duración, 31 de diciembre, 1 de enero y cambios de año.
- `multiuser-session.spec.ts`: recarga por cada sección, logout, pestañas y filtrado de datos entre dos cuentas con histórico en meses diferentes.
- `preferences-regressions.spec.ts`: evitar duplicados en navegación, recarga y dos pestañas simultáneas. Esta última puede revelar una carrera que solo puede garantizarse eliminando duplicados en el servidor.
- `volume.stress.ts`: combina centenares de operaciones con 36 meses, 8 categorías, 3 métodos, 2 tipos e importes extremos; verifica persistencia y paginación.
- `security.audit.ts` y `authorization.audit.ts`: diagnóstico explícito del backend simulado (lecturas, escrituras, identificación, propiedad, payload y contraseñas).

## Sobre la categoría eliminada y su nombre histórico

**Comportamiento actual comprobado en el código:** borrar una categoría desvincula las transacciones mediante `categoryId: null`. El movimiento y su importe permanecen, pero la interfaz muestra **«Sin categoría»**. No conserva el nombre antiguo porque el modelo `Transaction` no lo almacena.

**Necesidad nueva propuesta:** mantener el nombre que tenía la categoría cuando el usuario realizó la transacción, aunque posteriormente la categoría se elimine o se renombre. Se ha incluido una prueba con `test.fail` que expresa ese contrato futuro, sin modificar fraudulentamente el comportamiento actual. Es una funcionalidad pendiente, no un error del test. Antes de implementarla hay que decidir entre conservar una copia del nombre en la transacción (`categoryNameAtCreation`) o emplear borrado lógico de categorías (`isDeleted`) con consulta del histórico. Ambos enfoques requieren cambios de modelo, servicio, UI y pruebas de migración.

## Hallazgos previos que siguen siendo parte del paquete

1. **Error confirmado:** descripción compuesta únicamente de espacios puede guardarse como `""`.
2. **Error confirmado:** un doble clic en Guardar puede crear dos transacciones.
3. **Falso ruido de infraestructura:** la limpieza antigua fallaba ante HTTP 404 por un usuario de pruebas ya borrado; se ha cambiado para que el borrado sea idempotente sin ocultar otros errores HTTP.
4. **Preferencias:** la última prueba aislada pasó (1/1) tras ajustar `PreferencesService`, pero hace falta verificar nuevamente concurrencia y ausencia de duplicados; una instancia frontend no puede garantizar unicidad entre dos pestañas.
5. **Otros fallos antiguos:** recarga de sesión, filtros, informes, presupuestos y móvil siguen bajo comprobación; no se declaran resueltos hasta ver los resultados.
6. **Aviso NG8107 en reports.html:** independiente de Playwright; no explica los fallos de usuario.

## Cómo interpretar resultados

- Un test rojo no significa automáticamente una vulnerabilidad: revisa la traza y si faltaban datos, falló el entorno o realmente falló una operación de Finora.
- Los tests con `test.fail` se identifican como comportamientos pendientes documentados. No se convierten automáticamente en resultados exitosos de la funcionalidad real.
- **No es posible demostrar un programa perfecto con pruebas finitas.** La meta es descubrir fallos reproducibles y prevenir regresiones; la seguridad de datos requiere un backend que verifique autenticación, permisos y validaciones.
- La suite E2E utiliza `src.zip` como fotografía del código; si modificas formularios o textos después, habrá que ajustar algunos selectores.

## Git

Mantén el código de tests, el seed y la configuración. Añade al `.gitignore` si no existían:

```gitignore
/test-results/
/playwright-report/
/mock-api/db.e2e.json
```

Es importante **versionar `mock-api/db.e2e.seed.json`** y `tests/e2e/scripts/reset-db.mjs`; son los que reconstruyen la base aislada de forma determinista. Evita subir a Git archivos temporales con contraseñas reales o datos de otros usuarios.
