import { expect, test, type Page } from '@playwright/test';

/**
 * El mapa en vivo, tocado con el dedo y leído con lector de pantalla.
 *
 * El punto de espera se ponía en `pointerdown`, que en táctil llega al
 * apoyar el dedo, antes de saber si el gesto es un toque o un
 * desplazamiento: quien bajaba la página con el dedo sobre el mapa le
 * movía el punto. Ahora se pone con el clic, que el navegador no emite si
 * el dedo se desplazó.
 */

const pin = (page: Page): Promise<string | null> => page.locator('.mv-pin').getAttribute('transform');

async function mapaALaVista(page: Page): Promise<{ x: number; y: number; width: number; height: number }> {
  await page.goto('/');
  const svg = page.locator('[data-mapa-svg]');
  await svg.scrollIntoViewIfNeeded();
  return (await svg.boundingBox())!;
}

test('arrastrar el dedo sobre el mapa para bajar la página no mueve el punto', async ({ page }, info) => {
  test.skip(info.project.name !== 'movil', 'el arrastre es del teléfono');
  const caja = await mapaALaVista(page);
  const antes = await pin(page);
  const alto = await page.evaluate(() => scrollY);

  const cdp = await page.context().newCDPSession(page);
  const x = caja.x + caja.width * 0.3;
  const y = caja.y + caja.height * 0.7;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  for (let i = 1; i <= 6; i += 1) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - i * 40 }] });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });

  // El gesto sí desplazó la página: si no, la prueba no probaría nada.
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(alto);
  expect(await pin(page), 'el arrastre movió el punto de espera').toBe(antes);
});

test('un toque sobre el mapa pone ahí el punto', async ({ page }, info) => {
  test.skip(info.project.name !== 'movil', 'el toque es del teléfono');
  const caja = await mapaALaVista(page);
  const antes = await pin(page);
  await page.touchscreen.tap(caja.x + caja.width * 0.3, caja.y + caja.height * 0.7);
  await expect.poll(() => pin(page)).not.toBe(antes);
});

test('el clic principal pone el punto y el derecho no', async ({ page }, info) => {
  test.skip(info.project.name !== 'escritorio', 'el ratón es del escritorio');
  const caja = await mapaALaVista(page);
  const antes = await pin(page);

  await page.mouse.click(caja.x + caja.width * 0.3, caja.y + caja.height * 0.7, { button: 'right' });
  expect(await pin(page), 'el botón derecho movió el punto').toBe(antes);

  await page.mouse.click(caja.x + caja.width * 0.3, caja.y + caja.height * 0.7);
  await expect.poll(() => pin(page)).not.toBe(antes);
});

/*
  Con lector de pantalla. El mapa era `role="img"`, un rol estático: en
  modo lectura el lector se queda las flechas para recorrer el texto y no
  se las pasa a una imagen. Como deslizador el lector entra en modo foco,
  las flechas llegan al mapa y cada movimiento se lee con su valor.
*/
test('el mapa es un deslizador que dice dónde está el punto', async ({ page }) => {
  await mapaALaVista(page);
  const mapa = page.getByRole('slider', { name: /punto de espera/i });
  await expect(mapa).toHaveCount(1);
  await expect(mapa).toHaveAttribute('aria-valuemin', '0');
  await expect(mapa).toHaveAttribute('aria-valuemax', '100');
  await expect(mapa).toHaveAttribute('aria-valuetext', /desde .+ en la C16/);

  await mapa.focus();
  const antes = await mapa.getAttribute('aria-valuenow');
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => mapa.getAttribute('aria-valuenow')).not.toBe(antes);
});

test('los teléfonos de «Cómo funciona» no se leen con lector de pantalla', async ({ page }) => {
  await page.goto('/');
  const arbol = await page.locator('[data-pasos-columnas]').ariaSnapshot();
  // Ni el reloj de mentira, ni los textos del guion, ni los íconos sin nombre.
  expect(arbol).not.toMatch(/7:23|Localizando|Ruta activa|- img/);
});

test('cada ruta marca sus dos terminales en puntas distintas del mapa', async ({ page }) => {
  await mapaALaVista(page);
  const botones = page.locator('[data-mapa-rutas] [data-ruta]');
  const cuantas = await botones.count();
  expect(cuantas).toBe(6);
  for (let i = 0; i < cuantas; i += 1) {
    await botones.nth(i).click();
    const centros = await page
      .locator('.mv-terminales circle')
      .evaluateAll((cs) => cs.map((c) => [Number(c.getAttribute('cx')), Number(c.getAttribute('cy'))]));
    const ruta = await botones.nth(i).getAttribute('data-ruta');
    expect(centros, ruta!).toHaveLength(2);
    // Antes las dos caían en la salida, una encima de otra. A 6,45 m por
    // unidad, 155 unidades es 1 km.
    const [[ax, ay], [bx, by]] = centros;
    expect(Math.hypot(ax - bx, ay - by), `${ruta}: las dos terminales encimadas`).toBeGreaterThan(155);
  }
});
