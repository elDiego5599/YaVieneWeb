import { test, expect, type Page } from '@playwright/test';

/**
 * El carrusel de «Cómo funciona» es una sola lámina (dueño, 2026-10-13):
 * el texto de cada paso y su cuadro se mueven juntos, cuadro a cuadro, sin
 * separarse ni saltar, se toque como se toque. Lo que se prueba aquí no se
 * ve en jsdom: la hora a la que el navegador arranca cada transición, y lo
 * que hace con una que se invierte a medio camino. Se muestrea con
 * `requestAnimationFrame` la distancia entre cada texto y su cuadro.
 */

const SONDA = `(() => {
  const filas = []; let vivo = true;
  const tomar = () => {
    const f = { ms: performance.now() };
    for (const e of document.querySelectorAll('.cf-explica')) f['t' + e.dataset.paso] = e.getBoundingClientRect().left;
    for (const e of document.querySelectorAll('.cf-escena')) (f['s' + e.dataset.paso] ??= []).push(e.getBoundingClientRect().left);
    filas.push(f);
    if (vivo) requestAnimationFrame(tomar);
  };
  requestAnimationFrame(tomar);
  window.__lamina = () => { vivo = false; return filas; };
})()`;

type Fila = Record<string, number | number[]>;

/** Los cuadros en que un texto se separa de su cuadro, o salta. */
function roturas(filas: Fila[], separacion: number, ancho: number): string[] {
  const malos: string[] = [];
  // Solo cuenta lo que asoma por la ventana: fuera de ella, el recorte lo esconde.
  const seVe = (x: number): boolean => x > -ancho / 2 && x < ancho;
  filas.forEach((f, i) => {
    for (const p of ['ruta', 'bus', 'aviso']) {
      const t = f['t' + p] as number;
      for (const s of (f['s' + p] as number[] | undefined) ?? []) {
        if ((seVe(t) || seVe(s)) && Math.abs(s - t - separacion) > 1.5) malos.push(`${i} ${p}: texto ${t.toFixed(0)}, cuadro ${s.toFixed(0)}`);
      }
      const antes = filas[i - 1]?.['t' + p] as number | undefined;
      // Un salto es más de un sexto de ventana en un cuadro de 60 Hz: si el
      // navegador se saltó cuadros (la CI, con un hilo), el tramo crece
      // con el tiempo que pasó y no cuenta como salto.
      const cuadros = Math.max(1, ((f.ms as number) - ((filas[i - 1]?.ms as number) ?? 0)) / (1000 / 60));
      if (antes !== undefined && seVe(antes) && seVe(t) && Math.abs(t - antes) > (ancho / 6) * cuadros) malos.push(`${i} ${p}: salta de ${antes.toFixed(0)} a ${t.toFixed(0)}`);
    }
  });
  return malos;
}

/**
 * Espera a que el carrusel quede en reposo: sin animaciones finitas vivas
 * en la cuadrícula (salvo la barra del avance solo), sin copias, rebote ni textos saliendo. Por estado y no
 * por reloj (AUD16-10): con la máquina cargada, 900 ms no alcanzaban.
 */
async function quieto(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const grid = document.querySelector('.cf-grid');
    if (!grid) return false;
    const vivas = grid.getAnimations({ subtree: true })
      // `cf-progreso` es la barra del avance solo: corre siempre.
      .filter(a => a.playState === 'running' && a.effect?.getTiming().iterations !== Infinity
        && (a as CSSAnimation).animationName !== 'cf-progreso');
    return vivas.length === 0
      && !document.querySelector('.cf-escena--fantasma')
      && !grid.hasAttribute('data-rebote')
      && !document.querySelector('.cf-explica[data-sale]');
  }, undefined, { timeout: 15_000 });
}

const pestana = (page: Page, paso: string) => page.locator(`[role=tab][data-paso="${paso}"]`);

async function mover(page: Page, direccion: 'anterior' | 'siguiente'): Promise<void> {
  await page.locator(`.cf-control--${direccion}`).click();
}

const GESTOS: [string, (page: Page, ancho: number) => Promise<void>][] = [
  ['tres clics seguidos', async page => {
    await pestana(page, 'bus').click();
    await page.waitForTimeout(150);
    await pestana(page, 'aviso').click();
    await page.waitForTimeout(60);
    await pestana(page, 'ruta').click();
  }],
  ['la vuelta con la flecha, con rebote', async page => {
    await pestana(page, 'ruta').focus();
    await page.keyboard.press('ArrowLeft');
  }],
  ['volver al paso que aún se va', async page => {
    await pestana(page, 'bus').click();
    await page.waitForTimeout(200);
    await pestana(page, 'ruta').click();
  }],
  ['la vuelta con la flecha del cuadro', async page => {
    await pestana(page, 'ruta').click();
    await mover(page, 'anterior');
  }],
  ['elegir otro a medio viaje con la flecha', async page => {
    await mover(page, 'siguiente');
    await page.waitForTimeout(120);
    await mover(page, 'siguiente');
  }],
];

test('texto y cuadro de cada paso se mueven como una sola lámina', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  await page.locator('.cf-grid').scrollIntoViewIfNeeded();
  await quieto(page);
  const ancho = page.viewportSize()!.width;
  // La separación de reposo entre el texto y el cuadro del paso que se ve.
  const separacion = await page.evaluate(() => {
    const paso = document.querySelector<HTMLElement>('#cf-escena')!.dataset.paso;
    const texto = document.querySelector(`.cf-explica[data-paso="${paso}"]`)!;
    return document.querySelector('#cf-escena')!.getBoundingClientRect().left - texto.getBoundingClientRect().left;
  });

  for (const [nombre, gesto] of GESTOS) {
    await page.evaluate(SONDA);
    await gesto(page, ancho);
    await quieto(page);
    const filas = (await page.evaluate('window.__lamina()')) as Fila[];
    expect(filas.length, nombre).toBeGreaterThan(20);
    expect(roturas(filas, separacion, ancho), nombre).toEqual([]);
    // Al llegar no queda nada a medias: ni copias, rebote ni textos saliendo.
    const fin = await page.evaluate(() => ({
      copias: document.querySelectorAll('.cf-escena--fantasma').length,
      marcas: ['data-rebote'].filter(a => document.querySelector('.cf-grid')!.hasAttribute(a)),
      saliendo: document.querySelectorAll('.cf-explica[data-sale]').length,
    }));
    expect(fin, nombre).toEqual({ copias: 0, marcas: [], saliendo: 0 });
  }
});

test('el mapa llena el cuadro igual en la escena viva y en su copia', async ({ page }) => {
  await page.goto('/');
  await pestana(page, 'bus').click();
  await quieto(page);
  // El mapa contra su propio cuadro: en reposo la escena viva, y luego la
  // copia que sale. La copia vive lo que dura el viaje y, con la máquina
  // cargada, la ida y vuelta de Playwright llega cuando ya se quitó
  // (AUD16-10): la página la mide sola en cuanto se inserta, ya en su sitio.
  await page.evaluate(() => {
    const w = window as unknown as { __medir: (e: Element) => number[]; __copia?: number[] };
    w.__medir = e => {
      const c = e.getBoundingClientRect();
      const m = e.querySelector('.cf-mapa-tarjeta .phone-map')!.getBoundingClientRect();
      return [m.width - c.width, m.height - c.height, m.left - c.left, m.top - c.top].map(Math.abs);
    };
    const vigia = new MutationObserver(() => {
      const copia = document.querySelector('.cf-escena--fantasma[data-paso="bus"]');
      if (!copia) return;
      w.__copia = w.__medir(copia);
      vigia.disconnect();
    });
    vigia.observe(document.querySelector('.cf-grid')!, { childList: true, subtree: true });
  });
  const viva = (await page.evaluate(() =>
    (window as unknown as { __medir: (e: Element) => number[] }).__medir(document.querySelector('#cf-escena')!),
  ));
  await pestana(page, 'aviso').click();
  const copia = (await (await page.waitForFunction(() =>
    (window as unknown as { __copia?: number[] }).__copia,
  )).jsonValue())!;
  for (const d of [...viva, ...copia]) expect(d).toBeLessThanOrEqual(1);
});

test('las flechas aparecen al pasar el ratón y quedan fuera de la caja, a 16 px', async ({ page }, info) => {
  // Con ratón y a 1440 px: en el teléfono están siempre a la vista, en el filo.
  test.skip(info.project.name === 'movil', 'el teléfono no tiene puntero que pase por encima');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const marco = page.locator('.cf-grid');
  await marco.scrollIntoViewIfNeeded();
  const botones = page.locator('.cf-control');
  await expect(botones).toHaveCount(2);
  const antes = await Promise.all([0, 1].map(i => botones.nth(i).evaluate(e => getComputedStyle(e).opacity)));
  expect(antes).toEqual(['0', '0']);
  // Pasar por el hueco hacia la flecha no la apaga.
  await marco.hover();
  const caja = (await marco.boundingBox())!;
  await page.mouse.move(caja.x - 8, caja.y + caja.height / 2);
  await expect(botones.nth(0)).toHaveCSS('opacity', '1');
  for (let i = 0; i < 2; i++) {
    await expect(botones.nth(i)).toHaveCSS('opacity', '1');
    const [cajaCuadricula, cajaBoton] = await Promise.all([
      marco.boundingBox(),
      botones.nth(i).boundingBox(),
    ]);
    expect(cajaCuadricula).not.toBeNull();
    expect(cajaBoton).not.toBeNull();
    expect(Math.abs(cajaBoton!.y + cajaBoton!.height / 2 - (cajaCuadricula!.y + cajaCuadricula!.height / 2))).toBeLessThanOrEqual(1);
    // Fuera de la caja grande, a 16 px de su filo.
    const hueco = i === 0
      ? cajaCuadricula!.x - (cajaBoton!.x + cajaBoton!.width)
      : cajaBoton!.x - (cajaCuadricula!.x + cajaCuadricula!.width);
    expect(Math.abs(hueco - 16)).toBeLessThanOrEqual(1);
    expect(cajaBoton!.width).toBeGreaterThanOrEqual(44);
    expect(cajaBoton!.height).toBeGreaterThanOrEqual(44);
  }
});
