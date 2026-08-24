import { defineConfig, devices } from '@playwright/test';

/**
 * Estas pruebas no comprueban el diseño, comprueban que la página no se
 * rompa: que no escupa errores en consola, que no se pueda desplazar de
 * lado y que ningún fichero se quede colgando. Son justo los fallos que
 * no se ven revisando el código y que sólo aparecen con un navegador de
 * verdad midiendo la maqueta.
 *
 * Se ejecutan siempre contra la build de producción, no contra el
 * servidor de desarrollo: es lo que va a ver la gente, con los ficheros
 * ya minimizados y con hash.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? 'github' : 'list',

  use: {
    baseURL: 'http://localhost:4174',
    trace: 'retain-on-failure',
  },

  /* Los dos extremos que importan: el móvil donde se lee esto de verdad
     y el escritorio donde se revisa. */
  projects: [
    { name: 'movil', use: { ...devices['Pixel 7'] } },
    { name: 'escritorio', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
  ],

  webServer: {
    command: 'npx vite build && npx vite preview --port 4174 --strictPort',
    url: 'http://localhost:4174',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
