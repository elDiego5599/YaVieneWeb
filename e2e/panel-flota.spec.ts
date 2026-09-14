import { test, expect, type Page } from '@playwright/test';

/**
 * La fila del panel: placa, punto de estado, píldora de ruta, lápiz,
 * interruptor y rótulo. Dos mañas que se veían a ojo: el punto colgaba de
 * la placa (SFA-482 no mide igual que TUH-513) y al ocultar un bus la
 * columna del interruptor se encogía («OCULTO» es más corto que
 * «PERMITIDO») y la píldora y el lápiz se movían con ella. Aquí no se
 * mira: se mide con el navegador, en móvil y en escritorio.
 */

/** La x de cada elemento que casa con el selector, en píxeles de pantalla. */
async function xs(page: Page, selector: string): Promise<number[]> {
  return page.$$eval(selector, (els) => els.map((el) => el.getBoundingClientRect().x));
}

/** Las filas a la vista: las de la otra ruta llevan `hidden`. */
const FILAS = '.flota-fila:not([hidden])';

test.describe('la fila del panel no se mueve', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/empresas.html', { waitUntil: 'load' });
  });

  test('placas y puntos alineados en las cuatro filas', async ({ page }) => {
    const placas = await xs(page, `${FILAS} .flota-fila-placa`);
    const puntos = await xs(page, `${FILAS} .flota-fila-placa i`);
    expect(placas, 'cuatro placas a la vista').toHaveLength(4);
    expect(new Set(placas.map(Math.round)).size, 'las placas empiezan en la misma x').toBe(1);
    expect(new Set(puntos.map(Math.round)).size, 'los puntos están en la misma x').toBe(1);
  });

  test('ocultar un bus no mueve la píldora ni el lápiz', async ({ page }) => {
    const chipsAntes = await xs(page, `${FILAS} .flota-chip`);
    const lapicesAntes = await xs(page, `${FILAS} .flota-fila-editar`);
    const puntosAntes = await xs(page, `${FILAS} .flota-fila-placa i`);

    await page.locator('.flota-fila[data-bus="SFA-482"] [data-accion="visibilidad"]').click();
    await expect(page.locator('.flota-fila[data-bus="SFA-482"] .flota-permiso-texto')).toHaveText(
      'OCULTO'
    );

    expect(await xs(page, `${FILAS} .flota-chip`), 'la píldora no se mueve').toEqual(chipsAntes);
    expect(await xs(page, `${FILAS} .flota-fila-editar`), 'el lápiz no se mueve').toEqual(
      lapicesAntes
    );
    expect(await xs(page, `${FILAS} .flota-fila-placa i`), 'los puntos no se mueven').toEqual(
      puntosAntes
    );
  });
});
