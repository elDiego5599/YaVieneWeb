import { test, expect, type Page } from '@playwright/test';

/**
 * Los presupuestos de la web móvil (T7.1): LCP ≤ 2,5 s, CLS ≤ 0,1 y
 * TBT ≤ 200 ms, con Lighthouse en perfil móvil (T7.7).
 *
 * Lighthouse no entra en el repo: `@lhci/cli` y `lighthouse` traen 8 y 11
 * vulnerabilidades altas y la CI corre `npm audit --audit-level=high`. Así
 * que aquí se mide lo mismo con el navegador de Playwright, frenado como
 * frena Lighthouse al teléfono —CPU 4× más lenta, 150 ms de ida y vuelta,
 * 1,6 Mbit/s de bajada—, y se leen las métricas de la propia página.
 * No da los mismos milisegundos que Lighthouse: él simula una red de
 * teléfono, esto frena un servidor local y sale más optimista. Antes del
 * arreglo de T7.7 la portada daba aquí 1.972 ms (2.709 en Lighthouse) y
 * empresas 1.736 (2.633); después, 1.520 y 1.284 (2.254–2.404 y 2.179).
 * Así que este presupuesto sólo ataja lo grueso; lo fino lo atajan las
 * pruebas de abajo, que sí fallan con el marcado de antes. Los números
 * de Lighthouse, a mano, en el plan (T7.7).
 *
 * Sólo en el proyecto `movil`: el presupuesto es del teléfono.
 */

const PRESUPUESTO = { lcp: 2500, cls: 0.1, tbt: 200 };

async function frenar(page: Page): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 150,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
  });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
}

/** LCP, CLS y TBT tal como los apunta el navegador hasta que la página se
 *  asienta. El TBT, como lo define Lighthouse: lo que cada tarea larga
 *  pasa de 50 ms, contado desde el primer pintado con contenido. */
async function medir(page: Page): Promise<{ lcp: number; cls: number; tbt: number }> {
  return page.evaluate(
    () =>
      new Promise((listo) => {
        const leer = (tipo: string) =>
          new Promise<PerformanceEntry[]>((ok) => {
            new PerformanceObserver((l, o) => {
              ok(l.getEntries());
              o.disconnect();
            }).observe({ type: tipo, buffered: true });
            setTimeout(() => ok([]), 200);
          });
        // Tres segundos más de calma: una aparición tardía sería un LCP
        // tardío, y hay que darle tiempo a llegar.
        setTimeout(async () => {
          const lcp = (await leer('largest-contentful-paint')).at(-1)?.startTime ?? Infinity;
          const cls = (await leer('layout-shift'))
            .filter((e) => !(e as unknown as { hadRecentInput: boolean }).hadRecentInput)
            .reduce((s, e) => s + (e as unknown as { value: number }).value, 0);
          const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? 0;
          const tbt = (await leer('longtask'))
            .filter((e) => e.startTime + e.duration > fcp)
            .reduce((s, e) => s + Math.max(0, e.duration - 50), 0);
          listo({ lcp, cls, tbt });
        }, 3000);
      })
  );
}

test.describe('presupuesto de la web móvil (T7.1)', () => {
  test.beforeEach(({ browserName }, info) => {
    test.skip(browserName !== 'chromium' || info.project.name !== 'movil',
      'el presupuesto es del teléfono y el freno es de Chromium');
  });

  for (const ruta of ['/', '/empresas.html', '/privacidad.html', '/terminos.html']) {
    test(`${ruta} cabe en LCP, CLS y TBT`, async ({ page }) => {
      await frenar(page);
      await page.goto(ruta, { waitUntil: 'load' });
      const m = await medir(page);
      expect.soft(m.lcp, 'LCP (ms)').toBeLessThanOrEqual(PRESUPUESTO.lcp);
      expect.soft(m.cls, 'CLS').toBeLessThanOrEqual(PRESUPUESTO.cls);
      expect.soft(m.tbt, 'TBT (ms)').toBeLessThanOrEqual(PRESUPUESTO.tbt);
    });
  }
});

test.describe('lo que cuesta el LCP en el teléfono', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'movil', 'es del teléfono');
  });

  test.describe('sin JavaScript', () => {
    test.use({ javaScriptEnabled: false });

    // En el teléfono la descripción del hero ocupa más que el titular y es
    // el LCP; la cabecera de empresas es la primera pantalla. Ninguna
    // espera a `scroll-effects.ts` para verse, como el H1 (R-03).
    for (const [ruta, selector] of [
      ['/', '.hero-description'],
      ['/empresas.html', '#panel .seccion-cabecera'],
    ]) {
      test(`${selector} se ve sin esperar a nadie`, async ({ page }) => {
        await page.goto(ruta);
        const el = page.locator(selector);
        await expect(el).not.toHaveClass(/\breveal\b/);
        await expect(el).toHaveCSS('opacity', '1');
      });
    }
  });

  test('el plano del panel se baja a 1x y su `sizes` dice lo que mide', async ({ page }) => {
    await page.goto('/empresas.html');
    const plano = page.locator('img.flota-plano');
    await expect(plano).toHaveJSProperty('complete', true);
    const { src, ancho, vw } = await plano.evaluate((img: HTMLImageElement) => ({
      src: img.currentSrc,
      ancho: img.getBoundingClientRect().width,
      vw: window.innerWidth,
    }));
    expect(src).toContain('mapa-panel-1x');
    // `sizes="… 67vw"`: si el hueco cambia, el navegador elige mal.
    expect(Math.abs(ancho - vw * 0.67) / ancho).toBeLessThan(0.08);
  });

  test('el mapa de la portada no se precarga en el teléfono', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const precarga = page.locator('link[rel="preload"][as="image"]');
    await expect(precarga).toHaveAttribute('media', '(min-width: 768px)');
    expect(await page.evaluate(() => matchMedia('(min-width: 768px)').matches)).toBe(false);
  });
});
