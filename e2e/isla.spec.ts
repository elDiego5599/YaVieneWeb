import { expect, test } from '@playwright/test';

/**
 * La isla de navegación, tocada y tabulada como se usa.
 *
 * En Android, tocar el botón le da el foco antes de que llegue el clic.
 * El foco abría la isla y el clic, que llega detrás, la encontraba
 * abierta y la cerraba: el primer toque no hacía nada a la vista y el
 * menú sólo salía al segundo. Aquí se toca de verdad, con la emulación
 * táctil del Pixel 7, en las tres clases de página que llevan la isla.
 */

for (const ruta of ['/', '/empresas.html', '/terminos.html']) {
  test(`${ruta}: en táctil, un toque abre la isla y el siguiente la cierra`, async ({ page }, info) => {
    test.skip(info.project.name !== 'movil', 'el toque es del teléfono');
    await page.goto(ruta);
    const isla = page.locator('.nav-island');
    const boton = isla.locator('.nav-island-toggle');
    const enlace = isla.locator('.nav-link').first();

    await boton.tap();
    await expect(isla, 'el primer toque no abrió la isla').toHaveClass(/\bis-open\b/);
    await expect(boton).toHaveAttribute('aria-expanded', 'true');
    await expect(enlace).toBeVisible();

    await boton.tap();
    await expect(isla, 'el segundo toque no la cerró').not.toHaveClass(/\bis-open\b/);
    await expect(boton).toHaveAttribute('aria-expanded', 'false');
  });
}

// Lo que el arreglo no puede romper: con teclado, entrar en la isla la abre.
test('con el teclado, tabular hasta la isla la abre', async ({ page }, info) => {
  test.skip(info.project.name !== 'escritorio', 'el teclado es del escritorio');
  await page.goto('/');
  const isla = page.locator('.nav-island');
  for (let i = 0; i < 6; i += 1) {
    await page.keyboard.press('Tab');
    if (await isla.evaluate((n) => n.contains(document.activeElement))) break;
  }
  expect(await isla.evaluate((n) => n.contains(document.activeElement)), 'el foco no llegó a la isla').toBe(true);
  await expect(isla).toHaveClass(/\bis-open\b/);
});
