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
    const f = {};
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
      if (antes !== undefined && seVe(antes) && seVe(t) && Math.abs(t - antes) > ancho / 6) malos.push(`${i} ${p}: salta de ${antes.toFixed(0)} a ${t.toFixed(0)}`);
    }
  });
  return malos;
}

const pestana = (page: Page, paso: string) => page.locator(`[role=tab][data-paso="${paso}"]`);

async function arrastrar(page: Page, desde: number, hasta: number, paso: number): Promise<void> {
  const b = (await page.locator('.cf-marco').boundingBox())!;
  const y = b.y + b.height / 3;
  await page.mouse.move(b.x + desde, y);
  await page.mouse.down();
  for (let x = desde; Math.sign(hasta - x) === Math.sign(hasta - desde) && x !== hasta; x += paso) await page.mouse.move(b.x + x, y);
  await page.mouse.move(b.x + hasta, y);
  await page.mouse.up();
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
  ['arrastrar dando la vuelta, con goma', async (page, ancho) => arrastrar(page, ancho * 0.1, ancho * 0.45, ancho / 40)],
  ['arrastrar y elegir otro a medio viaje', async (page, ancho) => {
    await arrastrar(page, ancho * 0.45, ancho * 0.1, -ancho / 40);
    await page.waitForTimeout(120);
    await pestana(page, 'aviso').click();
  }],
];

test('texto y cuadro de cada paso se mueven como una sola lámina', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  await page.locator('.cf-grid').scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
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
    await page.waitForTimeout(900);
    const filas = (await page.evaluate('window.__lamina()')) as Fila[];
    expect(filas.length, nombre).toBeGreaterThan(20);
    expect(roturas(filas, separacion, ancho), nombre).toEqual([]);
    // Al llegar no queda nada a medias: ni copias, ni rebote, ni arrastre.
    const fin = await page.evaluate(() => ({
      copias: document.querySelectorAll('.cf-escena--fantasma').length,
      marcas: ['data-rebote', 'data-arrastrando'].filter(a => document.querySelector('.cf-grid')!.hasAttribute(a)),
      saliendo: document.querySelectorAll('.cf-explica[data-sale]').length,
    }));
    expect(fin, nombre).toEqual({ copias: 0, marcas: [], saliendo: 0 });
  }
});
