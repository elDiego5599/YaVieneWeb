import { test, expect } from '@playwright/test';

/**
 * En iOS, estirar la página más allá del final descubre el lienzo, y el
 * lienzo tomaba el blanco del body: bajo un pie que termina verde azulado
 * aparecía una franja blanca que se leía como la página rota. Mientras el
 * pie está a la vista, el lienzo toma el color con el que termina el pie
 * (`--rebote` en pie.css); arriba sigue blanco, como la portada.
 *
 * El color no se cree de palabra: se lee de la última fila de la pantalla
 * con el pie abajo, al centro, que es por donde se estira.
 */
const hex = (rgb: string): number[] => (rgb.match(/\d+/g) ?? []).slice(0, 3).map(Number);

for (const pagina of ['/', '/empresas.html']) {
  test(`${pagina}: el rebote de abajo es del color del pie y el de arriba no`, async ({ page }, info) => {
    test.skip(info.project.name !== 'movil', 'el rebote es del teléfono');
    await page.goto(pagina);
    const lienzo = () => page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
    expect(await lienzo()).toBe('rgba(0, 0, 0, 0)');

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect.poll(lienzo).not.toBe('rgba(0, 0, 0, 0)');

    const alto = page.viewportSize()!.height;
    const ancho = page.viewportSize()!.width;
    const png = await page.screenshot({ clip: { x: ancho / 2 - 1, y: alto - 2, width: 2, height: 2 }, scale: 'css' });
    const pixel = await page.evaluate(async (b64) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      return [...ctx.getImageData(0, 0, 1, 1).data.slice(0, 3)];
    }, png.toString('base64'));
    const color = hex(await lienzo());
    for (let i = 0; i < 3; i++) expect(Math.abs(color[i] - pixel[i]), `canal ${i}`).toBeLessThanOrEqual(6);

    await page.evaluate(() => window.scrollTo(0, 0));
    await expect.poll(lienzo).toBe('rgba(0, 0, 0, 0)');
  });
}
