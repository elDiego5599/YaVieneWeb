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

/*
  Las flechas avanzan el punto por el recorrido. Se recolocaba en el punto
  del trazado más cercano, y en los tramos donde la ida y la vuelta van por
  la misma calle el más cercano podía ser el de la otra mano: el punto
  rebotaba entre 23, 25, 72, 74… y el teclado no llegaba a la mayor parte
  de la ruta.
*/
test('las flechas recorren la ruta entera, paso a paso', async ({ page }) => {
  await mapaALaVista(page);
  const mapa = page.getByRole('slider', { name: /punto de espera/i });
  await mapa.focus();
  let antes = Number(await mapa.getAttribute('aria-valuenow'));
  for (let i = 0; i < 50; i += 1) {
    await page.keyboard.press('ArrowRight');
    const ahora = Number(await mapa.getAttribute('aria-valuenow'));
    // 2 % por paso; el redondeo a entero deja 1 o 3, y pasado el final se
    // sigue por el principio.
    expect([1, 2, 3], `paso ${i}: de ${antes} a ${ahora}`).toContain((ahora - antes + 100) % 100);
    antes = ahora;
  }
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

/*
  Auditoría 2026-09, hallazgo 9. Con el punto en el primer tramo del
  recorrido, el bus nace por detrás —antes del final— y cruza el final del
  trazado. Pasar de `t = 1` a `t = 0` se trataba como el fin de la escena:
  el bus se recolocaba detrás del punto, en bucle, saltando cientos de
  metros atrás cada ~10 s.

  La escena sí vuelve a empezar cuando los dos buses ya pasaron el punto y
  están lejos, pero el segundo nace 4,3 km atrás: eso no llega antes de
  ~60 s, así que en los 25 s que se miran aquí no hay salto legítimo.
*/
test('con el punto junto a la salida, el bus llega a él sin saltar atrás', async ({ page }, info) => {
  test.skip(info.project.name !== 'escritorio', 'el movimiento es el mismo en los dos tamaños');
  test.setTimeout(60_000);
  await mapaALaVista(page);
  const mapa = page.getByRole('slider', { name: /punto de espera/i });
  await mapa.focus();
  // Las flechas mueven el punto un 2 % del recorrido: se avanza hasta el
  // primer 2 %, que en la C16 queda a menos de un kilómetro de la salida.
  for (let i = 0; i < 50 && Number(await mapa.getAttribute('aria-valuenow')) > 1; i += 1) {
    await page.keyboard.press('ArrowRight');
  }
  expect(Number(await mapa.getAttribute('aria-valuenow'))).toBeLessThanOrEqual(1);

  const { maxSalto, minAlPunto } = await page.evaluate(async () => {
    const xy = (sel: string): [number, number] => {
      const m = /translate\(([-\d.]+) ([-\d.]+)\)/.exec(document.querySelector(sel)!.getAttribute('transform')!)!;
      return [Number(m[1]), Number(m[2])];
    };
    const punto = xy('.mv-pin');
    let antes = xy('.mv-bus');
    let maxSalto = 0;
    let minAlPunto = Infinity;
    for (let ms = 0; ms < 25_000; ms += 100) {
      await new Promise((r) => setTimeout(r, 100));
      const ahora = xy('.mv-bus');
      maxSalto = Math.max(maxSalto, Math.hypot(ahora[0] - antes[0], ahora[1] - antes[1]));
      minAlPunto = Math.min(minAlPunto, Math.hypot(ahora[0] - punto[0], ahora[1] - punto[1]));
      antes = ahora;
    }
    return { maxSalto, minAlPunto };
  });
  // A 110 m/s y 6,45 m por unidad, el bus hace ~1,7 unidades en 100 ms; 30
  // deja margen para un cuadro perdido. El salto del fallo eran ~95.
  expect(maxSalto, 'el bus saltó').toBeLessThan(30);
  expect(minAlPunto, 'el bus nunca llegó al punto').toBeLessThan(15);
});
