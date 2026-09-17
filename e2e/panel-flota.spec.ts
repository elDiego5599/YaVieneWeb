import { test, expect, type Page } from '@playwright/test';

/**
 * La fila del panel: placa, icono de estado, píldora de ruta, lápiz,
 * interruptor y rótulo. Tres mañas que se veían a ojo: el icono colgaba de
 * la placa (SFA-482 no mide igual que TUH-513); al ocultar un bus la
 * columna del interruptor se encogía («OCULTO» es más corto que
 * «PERMITIDO») y la píldora y el lápiz se movían con ella; y con una ruta
 * de nombre largo la píldora no cedía nada, así que el icono de estado
 * terminaba pintado encima de ella, igual que pasaba en la app. Aquí no se
 * mira: se mide con el navegador, en móvil y en escritorio.
 */

/** La x de cada elemento que casa con el selector, en píxeles de pantalla. */
async function xs(page: Page, selector: string): Promise<number[]> {
  return page.$$eval(selector, (els) => els.map((el) => el.getBoundingClientRect().x));
}

/** Los bordes izquierdo y derecho de cada elemento que casa, en píxeles. */
async function bordes(page: Page, selector: string): Promise<{ izq: number; der: number }[]> {
  return page.$$eval(selector, (els) =>
    els.map((el) => {
      const caja = el.getBoundingClientRect();
      return { izq: caja.left, der: caja.right };
    })
  );
}

/** Las filas a la vista: las de la otra ruta llevan `hidden`. */
const FILAS = '.flota-fila:not([hidden])';

test.describe('la fila del panel no se mueve', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/empresas.html', { waitUntil: 'load' });
  });

  test('placas e iconos alineados en las cuatro filas', async ({ page }) => {
    const placas = await xs(page, `${FILAS} .flota-fila-placa`);
    const iconos = await xs(page, `${FILAS} .flota-fila-placa svg`);
    expect(placas, 'cuatro placas a la vista').toHaveLength(4);
    expect(new Set(placas.map(Math.round)).size, 'las placas empiezan en la misma x').toBe(1);
    expect(new Set(iconos.map(Math.round)).size, 'los iconos están en la misma x').toBe(1);
  });

  test('el icono de estado y la píldora no se pisan', async ({ page }) => {
    const iconos = await bordes(page, `${FILAS} .flota-fila-placa svg`);
    const chips = await bordes(page, `${FILAS} .flota-chip`);
    const lapices = await bordes(page, `${FILAS} .flota-fila-editar`);
    expect(chips, 'cuatro píldoras a la vista').toHaveLength(4);

    chips.forEach((chip, i) => {
      // El medio píxel es de la coma flotante del navegador: cuando dos
      // bordes coinciden, uno sale unas milésimas más allá que el otro.
      expect(iconos[i].der, `fila ${i}: el icono se monta en la píldora`).toBeLessThanOrEqual(
        chip.izq + 0.5
      );
      expect(chip.der, `fila ${i}: la píldora se monta en el lápiz`).toBeLessThanOrEqual(
        lapices[i].izq + 0.5
      );
    });
  });

  // En el teléfono la maqueta se dibuja a menos de un cuarto de tamaño y
  // la letra queda en 2 px: ahí «Tcherassi» se corta por unas décimas y da
  // igual, porque no se lee de todos modos.
  test('en escritorio la ruta de nombre corto se lee entera', async ({ page }, info) => {
    test.skip(info.project.name !== 'escritorio', 'se mide en la maqueta grande');

    const cortas = await page.$$eval(`${FILAS} .flota-chip`, (els) =>
      els
        .filter((el) => el.textContent === 'Tcherassi')
        .map((el) => ({ pinta: el.scrollWidth, cabe: el.clientWidth }))
    );
    expect(cortas, 'la ruta elegida es la de las cuatro filas').toHaveLength(4);
    cortas.forEach((chip, i) => {
      expect(chip.pinta, `fila ${i}: la ruta salió cortada`).toBeLessThanOrEqual(chip.cabe);
    });
  });

  test('ocultar un bus no mueve la píldora ni el lápiz', async ({ page }) => {
    const chipsAntes = await xs(page, `${FILAS} .flota-chip`);
    const lapicesAntes = await xs(page, `${FILAS} .flota-fila-editar`);
    const iconosAntes = await xs(page, `${FILAS} .flota-fila-placa svg`);

    await page.locator('.flota-fila[data-bus="SFA-482"] [data-accion="visibilidad"]').click();
    await expect(page.locator('.flota-fila[data-bus="SFA-482"] .flota-permiso-texto')).toHaveText(
      'OCULTO'
    );

    expect(await xs(page, `${FILAS} .flota-chip`), 'la píldora no se mueve').toEqual(chipsAntes);
    expect(await xs(page, `${FILAS} .flota-fila-editar`), 'el lápiz no se mueve').toEqual(
      lapicesAntes
    );
    expect(await xs(page, `${FILAS} .flota-fila-placa svg`), 'los iconos no se mueven').toEqual(
      iconosAntes
    );
  });
});
