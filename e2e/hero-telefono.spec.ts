import { expect, test } from '@playwright/test';

/**
 * El teléfono del hero es una escena fija: la hoja de distancia con la C16
 * y el aviso armado. Antes de que corra el JavaScript enseña la hoja vacía,
 * y eso es todo lo que llega a verse.
 *
 * Arrastraba el simulador interactivo que ya no existe: las vistas del
 * selector, de empresas y de rutas, escondidas, y el código que armaba sus
 * listas en cada carga para no enseñarlas nunca (auditoría, hallazgo 12).
 */

test('el teléfono del hero sólo trae las vistas que enseña, y no arma listas', async ({ page }) => {
  await page.goto('/');
  const telefono = page.locator('#phone');
  await expect(telefono.locator('.sheet-view.active')).toHaveAttribute('data-view', 'eta');
  expect(await telefono.locator('[data-view]').evaluateAll((vs) => vs.map((v) => v.getAttribute('data-view')))).toEqual([
    'empty',
    'eta',
  ]);
  await expect(telefono.locator('.app-tile')).toHaveCount(0);
});
