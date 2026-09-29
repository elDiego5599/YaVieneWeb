import { expect, test, type Page } from '@playwright/test';

/**
 * El encaje de la escena de «Cómo funciona», con maqueta de verdad.
 *
 * `encaje.ts` buscaba el factor partiendo el margen a ciegas: diez
 * maquetas seguidas al arrancar, de 13 a 22 ms cada una, casi toda la
 * tarea larga de la carga. Ahora apunta con una estimación y confirma con
 * lo medido. Lo que se comprueba aquí es lo que eso promete: pocas
 * maquetas, y el mismo factor que daba la bisección —un factor distinto
 * es una escena que se mueve—.
 *
 * Las medidas se cuentan envolviendo `getBoundingClientRect` antes de que
 * cargue la página, sólo sobre el contenido de una escena, que es lo que
 * lee `encaje.ts` para probar un factor.
 */

const contarMedidas = (): void => {
  const original = Element.prototype.getBoundingClientRect;
  (window as unknown as { medidasEscena: number }).medidasEscena = 0;
  Element.prototype.getBoundingClientRect = function (this: Element) {
    if (this.parentElement?.classList.contains('escena')) {
      (window as unknown as { medidasEscena: number }).medidasEscena += 1;
    }
    return original.call(this);
  };
};

/**
 * El factor puesto y el que daba la bisección de antes, copiada tal cual
 * de `encaje.ts` y corrida en la misma página sobre la misma escena. Deja
 * la escena como estaba.
 */
async function factores(page: Page): Promise<{ puesto: string; biseccion: string; medidas: number }> {
  return page.evaluate(() => {
    const escena = document.querySelector<HTMLElement>('.escena')!;
    const dentro = escena.firstElementChild as HTMLElement;
    const medidas = (window as unknown as { medidasEscena: number }).medidasEscena;
    const puesto = escena.style.getPropertyValue('--encaje');

    const marco = getComputedStyle(escena);
    const libre =
      Number.parseFloat(marco.minHeight) -
      (Number.parseFloat(marco.paddingTop) || 0) -
      (Number.parseFloat(marco.paddingBottom) || 0);
    const probar = (k: number): number => {
      escena.style.setProperty('--encaje', k.toFixed(3));
      return dentro.getBoundingClientRect().height;
    };
    let k: number;
    if (probar(1) <= libre) k = 1;
    else if (probar(0.5) > libre) k = 0.5;
    else {
      let cabe = 0.5;
      let sobra = 1;
      for (let i = 0; i < 8; i += 1) {
        const medio = (cabe + sobra) / 2;
        if (probar(medio) <= libre) cabe = medio;
        else sobra = medio;
      }
      k = Math.floor(cabe * 1000) / 1000;
    }
    escena.style.setProperty('--encaje', puesto);
    return { puesto, biseccion: k.toFixed(3), medidas };
  });
}

/** Las ventanas con las que se comparó antes y después del cambio. */
const ventanas = [
  { width: 375, height: 667 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
];

test('al arrancar, el factor sale con pocas maquetas y es el de la bisección', async ({ page }, info) => {
  await page.addInitScript(contarMedidas);
  const tamanos = info.project.name === 'escritorio' ? ventanas : [page.viewportSize()!];

  for (const tamano of tamanos) {
    await page.setViewportSize(tamano);
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    // Lo que llega tarde (fuentes, mosaico) puede pedir otra búsqueda:
    // se espera a que el factor se asiente antes de leerlo.
    await expect
      .poll(() => page.evaluate(() => document.querySelector<HTMLElement>('.escena')!.style.getPropertyValue('--encaje')))
      .toMatch(/^\d\.\d{3}$/);

    const { puesto, biseccion, medidas } = await factores(page);
    const donde = `${tamano.width}×${tamano.height}`;
    expect(puesto, `${donde}: otro factor que la bisección, la escena se movería`).toBe(biseccion);
    // Con la bisección eran diez por búsqueda. Una búsqueda de ahora son
    // la del factor puesto y dos o tres guiadas; se deja sitio para una
    // segunda búsqueda si algo llega tarde y cambia el alto.
    expect(medidas, `${donde}: demasiadas maquetas al arrancar`).toBeLessThanOrEqual(8);
  }
});
