import { expect, test } from '@playwright/test';

/**
 * El teléfono del hero es una escena fija: la hoja de distancia con la C16
 * y el aviso armado. Antes de que corra el JavaScript enseña la hoja vacía,
 * y eso es todo lo que llega a verse.
 *
 * Arrastraba el simulador interactivo que ya no existe: las vistas del
 * selector, de empresas y de rutas, escondidas, y el código que armaba sus
 * listas en cada carga para no enseñarlas nunca (auditoría, hallazgo 12).
 */

test('el teléfono del hero sólo trae las vistas que enseña, y no arma listas', async ({ page }) => {
  await page.goto('/');
  const telefono = page.locator('#phone');
  await expect(telefono.locator('.sheet-view.active')).toHaveAttribute('data-view', 'eta');
  expect(await telefono.locator('[data-view]').evaluateAll((vs) => vs.map((v) => v.getAttribute('data-view')))).toEqual([
    'empty',
    'eta',
  ]);
  await expect(telefono.locator('.app-tile')).toHaveCount(0);
});

/* El lienzo recorta con su filo redondeado, pero no es un contenedor de
   scroll: con `overflow: hidden` lo era, y traer su botón a la vista desde
   abajo (`scrollIntoView`, un ancla, el foco con Tab) lo corría 130 px por
   dentro y la copia quedaba subida, cortada por arriba. Con `clip` no hay
   nada que correr. */
test('el lienzo del hero no se desplaza por dentro al traer su botón a la vista', async ({ page }) => {
  await page.goto('/', { waitUntil: 'load' });
  const corrido = await page.evaluate(async () => {
    window.scrollTo({ top: 1800, behavior: 'instant' });
    await new Promise((r) => setTimeout(r, 300));
    document.querySelector<HTMLElement>('.hero-actions .btn-green')!.scrollIntoView({ block: 'center', behavior: 'instant' });
    return document.querySelector<HTMLElement>('.hero-panel')!.scrollTop;
  });
  expect(corrido).toBe(0);
});

/* De 1024 a ~1300 el trío a la derecha le dejaba a la copia 238 px: el
   párrafo iba palabra por palabra y lo que no cabía quedaba debajo de los
   teléfonos (dueño, 2026-10-16). A cualquier ancho de escritorio la copia
   tiene al menos 380 px, nada suyo se sale de su caja y, si va al lado del
   trío, no lo pisa. */
for (const [ancho, alto] of [[1024, 768], [1180, 880], [1280, 800], [1339, 900], [1340, 1200], [1366, 768], [1440, 900], [1920, 1080]] as const) {
  test(`a ${ancho}×${alto} la copia del hero cabe entera y no la tapa el trío`, async ({ page }, info) => {
    test.skip(info.project.name !== 'escritorio', 'los anchos los pone la prueba');
    await page.setViewportSize({ width: ancho, height: alto });
    await page.goto('/', { waitUntil: 'load' });
    const m = await page.evaluate(() => {
      const copia = document.querySelector<HTMLElement>('.hero-grid--video .hero-copy')!;
      const escena = document.querySelector<HTMLElement>('.hero-grid--video .hero-scene')!.getBoundingClientRect();
      const c = copia.getBoundingClientRect();
      return { ancho: c.width, sobra: copia.scrollWidth - copia.clientWidth, alLado: c.bottom > escena.top, pisa: c.right - escena.left };
    });
    expect(m.ancho).toBeGreaterThanOrEqual(380);
    expect(m.sobra).toBeLessThanOrEqual(0);
    if (m.alLado) expect(m.pisa).toBeLessThanOrEqual(0);
  });
}
