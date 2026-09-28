import { test, expect } from '@playwright/test';

/**
 * El mapa de los teléfonos es una captura de MapLibre, y MapLibre coloca
 * los rótulos sin mirar el canto de la ventana: «LAS FLORES» quedaba
 * pegado a la esquina, y en el teléfono asomaba «…RES» por detrás del
 * reloj; «Río Magdalena» se metía bajo la isla. La captura no lleva
 * rótulos en la barra de estado (59 pt, el `SafeArea` de iOS) ni tocando
 * ningún borde (render_mapa.mjs).
 *
 * Un rótulo es texto oscuro sobre un mapa claro: el fondo, las calles y
 * el agua del Voyager no bajan de 190 en su canal más claro, y la tinta
 * de los rótulos sí.
 */
test('el mapa del teléfono no tiene rótulos bajo la barra de estado ni en los bordes', async ({ page }) => {
  await page.goto('/');
  const src = await page.locator('link[rel="preload"][as="image"][type="image/webp"]').getAttribute('href');
  expect(src).toBeTruthy();

  const tinta = await page.evaluate(async (url) => {
    const img = new Image();
    img.src = url;
    await img.decode();
    const lienzo = document.createElement('canvas');
    lienzo.width = img.naturalWidth;
    lienzo.height = img.naturalHeight;
    const ctx = lienzo.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(img, 0, 0);
    const w = lienzo.width;
    const h = lienzo.height;
    // La captura va a 2x: la barra de estado son 118 píxeles.
    const oscuros = (x: number, y: number, ancho: number, alto: number): number => {
      const { data } = ctx.getImageData(x, y, ancho, alto);
      let n = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (Math.max(data[i], data[i + 1], data[i + 2]) < 170) n++;
      }
      return n;
    };
    return {
      barra: oscuros(0, 0, w, 118),
      izquierda: oscuros(0, 0, 4, h),
      derecha: oscuros(w - 4, 0, 4, h),
      abajo: oscuros(0, h - 4, w, 4),
    };
  }, src!);

  expect(tinta).toEqual({ barra: 0, izquierda: 0, derecha: 0, abajo: 0 });
});
