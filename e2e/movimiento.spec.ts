import { test, expect, type Page } from '@playwright/test';

/**
 * El movimiento de la portada, medido en el navegador.
 *
 * Lo que aquí se prueba no se ve leyendo el CSS: qué valor computa el
 * navegador para una animación atada al scroll, si un pseudo queda detrás
 * del texto, si el titular está pintado antes de que llegue el
 * JavaScript. Cada prueba nombra el hallazgo de la revisión del
 * 2026-09-27 que la trajo.
 */

/** El desplazamiento vertical que lleva ahora mismo un elemento. */
const bajada = (page: Page, selector: string) =>
  page.locator(selector).evaluate((el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).m42);

test.describe('el titular del hero', () => {
  test.describe('sin JavaScript', () => {
    test.use({ javaScriptEnabled: false });

    // R-03: el H1 es lo más grande de la primera pantalla. Si nace en
    // `opacity: 0` y espera a `scroll-effects.ts`, el LCP espera al JS.
    test('se ve igual: no espera a nadie para aparecer', async ({ page }) => {
      await page.goto('/');
      const h1 = page.locator('h1.hero-title');
      await expect(h1).toBeVisible();
      await expect(h1).not.toHaveClass(/\breveal\b/);
      await expect(h1).toHaveCSS('opacity', '1');
      await expect(h1).toHaveCSS('transform', 'none');
    });
  });
});

test.describe('las apariciones', () => {
  // R-18: los desenfoques se fueron de la página en `cac7245`; las
  // apariciones los habían traído de vuelta a cada sección.
  test('entran sin desenfoque, antes y después de verse', async ({ page }) => {
    await page.goto('/');
    const filtros = await page
      .locator('.reveal')
      .evaluateAll((els) => [...new Set(els.map((el) => getComputedStyle(el).filter))]);
    expect(filtros).toEqual(['none']);
  });
});

test.describe('el panel del hero', () => {
  // R-19: la respiración del panel se descartó; no anima nada.
  test('está quieto', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.hero-panel')).toHaveCSS('animation-name', 'none');
  });
});

test.describe('la deriva del trío', () => {
  // PT-01: la lleva el scroll de la página, sin JavaScript. 7 px por cada
  // 100 de scroll, con tope en 56 a los 800.
  test('baja con el scroll, se detiene en el tope y vuelve', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.hero-scene')).toHaveCSS('animation-name', 'hero-deriva');

    await page.evaluate(() => window.scrollTo({ top: 400, behavior: 'instant' }));
    await expect.poll(() => bajada(page, '.hero-scene')).toBeCloseTo(28, 0);

    await page.evaluate(() => window.scrollTo({ top: 3000, behavior: 'instant' }));
    await expect.poll(() => bajada(page, '.hero-scene')).toBeCloseTo(56, 0);

    // De vuelta arriba: el reposo de `reposo.ts` la pausó mientras el
    // hero estaba fuera de la vista, y al volver tiene que seguir al
    // scroll otra vez, no quedarse en el tope.
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await expect.poll(() => bajada(page, '.hero-scene')).toBeCloseTo(0, 0);
  });

  test('con movimiento reducido no se mueve', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(page.locator('.hero-scene')).toHaveCSS('animation-name', 'none');
    await page.evaluate(() => window.scrollTo({ top: 400, behavior: 'instant' }));
    expect(await bajada(page, '.hero-scene')).toBe(0);
  });
});

test.describe('el foco de las fichas de ruta', () => {
  const foco = (page: Page, prop: 'opacity' | 'zIndex' | 'content') =>
    page.locator('.ruta-ficha').first().evaluate((el, p) => getComputedStyle(el, '::before')[p], prop);

  // PT-03 y R-20: se enciende con el `:hover`, sin JavaScript, y queda
  // detrás del texto de la ficha.
  test('con ratón se enciende al pasar, detrás del texto', async ({ page }, info) => {
    test.skip(info.project.name !== 'escritorio', 'el foco es sólo de puntero fino');
    await page.goto('/');
    /*
      El `scroll-behavior: smooth` de `base.css` vuelve animado el scroll
      con el que Playwright acerca la ficha: el ratón se posaba donde
      estaba a media bajada y, al terminar, la ficha quedaba 440 px más
      abajo, sin `:hover` (4 de 15 corridas con 5 hilos). Lo que se prueba
      es el foco, no el desplazamiento suave: se apaga sólo aquí.
    */
    await page.addStyleTag({ content: 'html { scroll-behavior: auto !important; }' });
    const ficha = page.locator('.ruta-ficha').first();
    await ficha.scrollIntoViewIfNeeded();

    expect(await foco(page, 'zIndex')).toBe('-1');
    expect(await foco(page, 'opacity')).toBe('0');
    await ficha.hover();
    await expect.poll(() => foco(page, 'opacity')).toBe('1');
  });

  test('en el táctil no existe', async ({ page }, info) => {
    test.skip(info.project.name !== 'movil', 'sólo el móvil tiene puntero grueso');
    await page.goto('/');
    expect(await foco(page, 'content')).toBe('none');
  });
});
