import { test, expect, type Page } from '@playwright/test';

/**
 * La fila del panel: placa, icono de estado, lápiz, interruptor y rótulo
 * (la píldora de la ruta salió de la app con «sin conductor ni chip de
 * ruta» y de aquí el 2026-10-07). Tres mañas que se veían a ojo: el icono colgaba de
 * la placa (SFA482 no mide igual que TUH513); al ocultar un bus la
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

  test('el icono de estado y el lápiz no se pisan', async ({ page }) => {
    const iconos = await bordes(page, `${FILAS} .flota-fila-placa svg`);
    const lapices = await bordes(page, `${FILAS} .flota-fila-editar`);
    expect(lapices, 'cuatro lápices a la vista').toHaveLength(4);
    lapices.forEach((lapiz, i) => {
      // El medio píxel es de la coma flotante del navegador.
      expect(iconos[i].der, `fila ${i}: el icono se monta en el lápiz`).toBeLessThanOrEqual(
        lapiz.izq + 0.5
      );
    });
  });

  // Como el tablero del panel (2026-10-07): fondo blanco, filas planas sin
  // píldora de ruta y entre ellas un filo centrado, a 36 de cada lado.
  test('fondo blanco y filas planas con el filo centrado', async ({ page }) => {
    // Al cargar, los colores entran con su transición: se mide al final.
    await page.waitForFunction(
      () => !document.getAnimations().some((a) => a instanceof CSSTransition)
    );
    const medida = await page.evaluate(() => {
      const fondo = getComputedStyle(document.querySelector('.flota')!).backgroundColor;
      const filas = Array.from(
        document.querySelectorAll<HTMLElement>('.flota-fila:not([hidden])')
      );
      const lista = document.querySelector('.flota-buses')!.getBoundingClientRect();
      const filos = filas.slice(1).map((f) => {
        const antes = getComputedStyle(f, '::before');
        const caja = f.getBoundingClientRect();
        const izq = caja.left + parseFloat(antes.left);
        const der = caja.right - parseFloat(antes.right);
        return { izq: izq - lista.left, der: lista.right - der, alto: antes.height };
      });
      const bordes = filas
        .filter((f) => !f.classList.contains('es-elegida'))
        .map((f) => getComputedStyle(f).borderTopColor);
      return { fondo, filos, bordes, chips: document.querySelectorAll('.flota-chip').length };
    });
    expect(medida.fondo).toBe('rgb(255, 255, 255)');
    expect(medida.chips, 'sin píldora de ruta').toBe(0);
    expect(medida.filos, 'un filo entre cada dos filas').toHaveLength(3);
    for (const filo of medida.filos) {
      expect(filo.alto).toBe('1px');
      expect(Math.abs(filo.izq - filo.der), 'el filo va centrado').toBeLessThan(0.5);
    }
    for (const borde of medida.bordes) expect(borde, 'fila plana').toBe('rgba(0, 0, 0, 0)');
  });

  test('ocultar un bus no mueve el lápiz ni el icono', async ({ page }) => {
    const lapicesAntes = await xs(page, `${FILAS} .flota-fila-editar`);
    const iconosAntes = await xs(page, `${FILAS} .flota-fila-placa svg`);

    await page.locator('.flota-fila[data-bus="SFA482"] [data-accion="visibilidad"]').click();
    await expect(page.locator('.flota-fila[data-bus="SFA482"] .flota-permiso-texto')).toHaveText(
      'OCULTO'
    );

    expect(await xs(page, `${FILAS} .flota-fila-editar`), 'el lápiz no se mueve').toEqual(
      lapicesAntes
    );
    expect(await xs(page, `${FILAS} .flota-fila-placa svg`), 'los iconos no se mueven').toEqual(
      iconosAntes
    );
  });
});
