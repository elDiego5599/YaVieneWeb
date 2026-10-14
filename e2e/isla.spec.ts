import { expect, test } from '@playwright/test';

/*
  En la CI la isla aparecía abierta antes de tocarla, y nadie sabía quién
  la abría. Cada prueba anota lo que le llega a la isla y, si falla, lo
  adjunta: un fallo que sólo pasa allá trae su explicación.
*/
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const log: string[] = ((window as unknown as { __isla: string[] }).__isla = []);
    const t0 = performance.now();
    for (const tipo of ['pointerover', 'pointerenter', 'pointerleave', 'pointerdown', 'click', 'focusin', 'focusout', 'scroll', 'touchstart']) {
      addEventListener(tipo, e => {
        const t = e.target as Element | null;
        const pt = (e as PointerEvent).pointerType ?? '';
        log.push(`${(performance.now() - t0).toFixed(0)} ${tipo} ${pt} ${t?.className?.toString?.() ?? t?.nodeName ?? 'window'} y=${scrollY}`);
      }, true);
    }
    new MutationObserver(ms => {
      for (const m of ms) if ((m.target as Element).classList?.contains('nav-island')) log.push(`${(performance.now() - t0).toFixed(0)} clase ${(m.target as Element).className}`);
    }).observe(document, { subtree: true, attributes: true, attributeFilter: ['class'] });
  });
});
test.afterEach(async ({ page }, info) => {
  if (info.status === info.expectedStatus) return;
  const log = await page.evaluate(() => (window as unknown as { __isla?: string[] }).__isla ?? []).catch(() => []);
  await info.attach('eventos-isla', { body: log.join('\n'), contentType: 'text/plain' });
  console.log(`eventos de la isla:\n${log.join('\n')}`);
});

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

    /*
      Abrirse es una transición: la píldora crece y el botón viaja con
      ella, con retrasos de hasta 0,12 s en los enlaces. Playwright mide
      el botón dos cuadros, lo da por quieto y toca donde estaba; con 5
      hilos, 1 de cada 75 corridas el toque caía en el fondo de la isla
      y no cerraba nada. Una persona toca donde ve el botón: se espera a
      que la isla termine de moverse, como haría ella.
    */
    // `allSettled` y en vuelta: una transición que otra reemplaza se
    // cancela y su `finished` se rechaza, y la que la reemplaza también
    // hay que esperarla.
    await isla.evaluate(async (n) => {
      for (;;) {
        const vivas = n.getAnimations({ subtree: true }).filter((a) => a.playState === 'running');
        if (vivas.length === 0) return;
        await Promise.allSettled(vivas.map((a) => a.finished));
      }
    });
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

test('con el ratón se abre al entrar y se cierra al salir', async ({ page }, info) => {
  test.skip(info.project.name !== 'escritorio', 'el puntero es del escritorio');
  await page.goto('/');
  const isla = page.locator('.nav-island');
  // Como en el toque: en la CI lenta la isla aún llegaba a su sitio, se
  // iba de debajo del puntero y el `pointerleave` la cerraba. Una persona
  // apunta a donde la ve quieta.
  await page.evaluate(async () => {
    for (;;) {
      const vivas = document.getAnimations().filter(a => a.playState === 'running' && (a.effect as KeyframeEffect | null)?.target?.closest('.nav-island, header'));
      if (vivas.length === 0) return;
      await Promise.allSettled(vivas.map(a => a.finished));
    }
  });
  await isla.hover();
  await expect(isla).toHaveClass(/\bis-open\b/);
  await page.mouse.move(5, 700);
  await expect(isla).not.toHaveClass(/\bis-open\b/);
});

test('Escape la cierra y deja el foco en el botón, sin reabrirla', async ({ page }, info) => {
  test.skip(info.project.name !== 'escritorio', 'el teclado es del escritorio');
  // Con la barra plegada, que es cuando el botón está a la vista: desde
  // 880 px los enlaces van en línea y el botón no se enseña.
  await page.setViewportSize({ width: 800, height: 900 });
  await page.goto('/');
  const isla = page.locator('.nav-island');
  const boton = isla.locator('.nav-island-toggle');
  for (let i = 0; i < 6 && !(await isla.evaluate((n) => n.contains(document.activeElement))); i += 1) {
    await page.keyboard.press('Tab');
  }
  await expect(isla).toHaveClass(/\bis-open\b/);
  await page.keyboard.press('Escape');
  await expect(boton).toBeFocused();
  // Tras un Escape el foco devuelto es `:focus-visible`: sin el pestillo,
  // su `focusin` la volvería a abrir.
  await page.waitForTimeout(300);
  await expect(isla).not.toHaveClass(/\bis-open\b/);
});

test('en táctil, un toque fuera la cierra', async ({ page }, info) => {
  test.skip(info.project.name !== 'movil', 'el toque es del teléfono');
  await page.goto('/');
  const isla = page.locator('.nav-island');
  await isla.locator('.nav-island-toggle').tap();
  await expect(isla).toHaveClass(/\bis-open\b/);
  await page.touchscreen.tap(20, (page.viewportSize()?.height ?? 800) - 40);
  await expect(isla).not.toHaveClass(/\bis-open\b/);
});

test('marca la sección que se está leyendo, y ninguna en el hero', async ({ page }) => {
  await page.goto('/');
  const marcado = page.locator('.nav-island [aria-current="location"]');
  await expect(marcado).toHaveCount(0);
  for (const [id, href] of [['problema', '#problema'], ['como-funciona', '#como-funciona']]) {
    await page.locator(`#${id}`).evaluate((s) => window.scrollTo(0, s.getBoundingClientRect().top + window.scrollY - innerHeight * 0.3));
    await expect(marcado, `#${id}`).toHaveAttribute('href', href);
    await expect(marcado).toHaveCount(1);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(marcado).toHaveCount(0);
});
