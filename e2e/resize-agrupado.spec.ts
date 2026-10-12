import { expect, test } from '@playwright/test';

/**
 * Un `resize` no mide la maqueta en el acto: lo deja para el cuadro.
 *
 * En el móvil la barra de direcciones dispara `resize` a cada tirón del
 * scroll. El mapa del teléfono y el mapa en vivo leían su caja en el mismo
 * oyente: varias
 * maquetas forzadas por aviso (auditoría, hallazgo 17). Ahora las piden
 * con `requestAnimationFrame`, como la isla, y la lectura cae
 * una vez por cuadro, antes de pintar: en pantalla sale lo mismo.
 */

test('un resize no lee cajas en el acto, sino en el cuadro siguiente', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  const { enElActo, enElCuadro } = await page.evaluate(async () => {
    const original = Element.prototype.getBoundingClientRect;
    let lecturas = 0;
    Element.prototype.getBoundingClientRect = function (this: Element) {
      lecturas += 1;
      return original.call(this);
    };
    // Tres avisos seguidos, como los que manda un tirón de la barra.
    for (let i = 0; i < 3; i += 1) window.dispatchEvent(new Event('resize'));
    const enElActo = lecturas;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const enElCuadro = lecturas - enElActo;
    Element.prototype.getBoundingClientRect = original;
    return { enElActo, enElCuadro };
  });
  expect(enElActo, 'cajas leídas dentro del propio resize').toBe(0);
  // Y se siguen midiendo: los dos mapas, una vez cada uno por los tres avisos.
  expect(enElCuadro).toBeGreaterThanOrEqual(2);
});
