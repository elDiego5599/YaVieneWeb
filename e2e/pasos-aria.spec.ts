import { expect, test, type Page } from '@playwright/test';

/**
 * Cuál de los tres pasos de «Cómo funciona» se está mostrando, dicho
 * también al lector de pantalla.
 *
 * El paso encendido se marcaba sólo con la clase `is-activa`: se ve, pero
 * no se oye, y los tres botones sonaban igual fuera cual fuera el paso
 * (auditoría, hallazgo 18). La isla ya resuelve lo mismo con
 * `aria-current`; aquí es `step`, el valor para un paso de una secuencia.
 */

/** Por botón: si lleva la clase y qué dice su `aria-current`. */
const estado = (page: Page) =>
  page
    .locator('.paso-boton')
    .evaluateAll((bs) => bs.map((b) => [b.classList.contains('is-activa'), b.getAttribute('aria-current')]));

test('el paso encendido lleva aria-current="step" y los otros no', async ({ page }) => {
  await page.goto('/');
  // Antes de tocar nada ya hay uno encendido, y ya se anuncia.
  expect(await estado(page)).toEqual([
    [true, 'step'],
    [false, null],
    [false, null],
  ]);

  await page.locator('.paso-boton').nth(2).click();
  await expect.poll(() => estado(page)).toEqual([
    [false, null],
    [false, null],
    [true, 'step'],
  ]);

  await page.locator('.paso-boton').nth(0).click();
  await expect.poll(() => estado(page)).toEqual([
    [true, 'step'],
    [false, null],
    [false, null],
  ]);
});
