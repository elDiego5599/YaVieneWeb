import { test, expect } from '@playwright/test';

/**
 * «Conecte su flota» nació como la página entera de empresas, a lo ancho
 * de la banda de producto (1440). Hoy es la tercera sección, debajo del
 * panel y de las razones, que van a 1160: en escritorio la ficha arrancaba
 * 140 px a la izquierda de todo lo de arriba y el formulario terminaba
 * 140 a la derecha, y la página se veía descuadrada al llegar al final.
 */
test('empresas: las tres secciones comparten los mismos bordes', async ({ page }) => {
  await page.goto('/empresas.html');
  const bordes = (sel: string) =>
    page.locator(sel).evaluate((el) => {
      const r = el.getBoundingClientRect();
      const c = getComputedStyle(el);
      return [
        Math.round(r.left + parseFloat(c.paddingLeft)),
        Math.round(r.right - parseFloat(c.paddingRight)),
      ];
    });
  const panel = await bordes('#panel > .panel-inner');
  expect(await bordes('#beneficios > .panel-inner')).toEqual(panel);
  expect(await bordes('#solicitar > .panel-inner')).toEqual(panel);
});
