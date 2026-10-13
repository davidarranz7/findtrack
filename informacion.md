## 1. Instalar las dependencias

```powershell
npm install
```

## 2. Iniciar la aplicación

**Terminal 1 — Angular:**

```powershell
ng s
```

**Terminal 2 — API simulada:**

```powershell
npx json-server mock-api/db.json
```

## 3. Comprobar la compilación

npm run build

## 5. Ejecutar las pruebas E2E con Playwright

npx playwright install chromium

npx playwright test
