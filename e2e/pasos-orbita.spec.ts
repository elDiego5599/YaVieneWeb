import { test, expect, type Page } from '@playwright/test';

/**
 * Los pasos de «Cómo funciona», a la derecha del visor, giran sobre una
 * órbita mientras se baja (pedido del dueño, 2026-09-28, con la «Circular
 * Split Roll» de hyperiux como referencia): el paso de turno llega al
 * punto más cercano al teléfono y ahí se ve entero; los otros esperan
 * más pequeños y más tenues sobre el mismo arco, arriba y abajo.
 *
 * Lo que se comprueba es la geometría y no un número de CSS: que los
 * tres caen sobre un mismo círculo, que se mueven con el dedo y no a
 * saltos, y que en el teléfono y sin animaciones la lista sigue plana.
 */

/**
 * Baja la pista de los pasos hasta `avance` (0 arriba, 1 al final). Recién
 * cargada, la página todavía puede devolver el scroll arriba (la
 * restauración del navegador, el encaje de las escenas), así que se
 * insiste hasta que se queda donde se pidió.
 */
const irA = (page: Page, avance: number) =>
  page.evaluate(async (a) => {
    const destino = (): number => {
      const pista = document.querySelector('#solucion .pista')!.getBoundingClientRect();
      return Math.round(pista.top + scrollY + (pista.height - innerHeight) * a);
    };
    for (let i = 0; i < 20; i++) {
      const y = destino();
      scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 100));
      if (Math.abs(scrollY - destino()) < 2) return;
    }
  }, avance);

interface Paso {
  /** Borde izquierdo del paso, desde el de la lista. */
  x: number;
  /** Centro vertical del paso, desde el centro de la lista. */
  y: number;
  opacidad: number;
  transform: string;
}

/** Lee los tres pasos cuando han dejado de moverse. */
const pasos = (page: Page): Promise<Paso[]> =>
  page.evaluate(async () => {
    const lista = document.querySelector('.pasos-lista')!;
    const leer = (): Paso[] => {
      const caja = lista.getBoundingClientRect();
      return [...lista.children].map((li) => {
        const b = li.getBoundingClientRect();
        const estilo = getComputedStyle(li);
        return {
          x: Math.round((b.left - caja.left) * 10) / 10,
          y: Math.round((b.top + b.height / 2 - (caja.top + caja.height / 2)) * 10) / 10,
          opacidad: Math.round(Number(estilo.opacity) * 100) / 100,
          transform: estilo.transform,
        };
      });
    };
    let antes = JSON.stringify(leer());
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 150));
      const ahora = JSON.stringify(leer());
      if (ahora === antes) break;
      antes = ahora;
    }
    return leer();
  });

/**
 * El radio del círculo que pasa por el punto más a la izquierda de la
 * órbita (el foco, en `x = foco`) y por el paso: con el centro en
 * `(foco + R, 0)` sale de `(x - foco)² + y² = 2R(x - foco)`.
 */
const radio = (p: Paso, foco: number): number => {
  const dx = p.x - foco;
  return (dx * dx + p.y * p.y) / (2 * dx);
};

test.describe('los pasos giran sobre una órbita', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'escritorio', 'la órbita es de escritorio');
  });

  test('con un paso en el foco, los otros dos esperan simétricos sobre el arco', async ({ page }) => {
    await page.goto('/');
    await irA(page, 0.5);
    const [a, b, c] = await pasos(page);

    // El del medio manda: está en el foco, entero y a plena luz.
    expect(Math.abs(b!.y)).toBeLessThan(2);
    expect(b!.opacidad).toBe(1);

    // Los otros dos, uno arriba y otro abajo, a la misma distancia y
    // corridos a la derecha lo mismo: el arco se aleja del teléfono.
    expect(a!.y).toBeLessThan(-60);
    expect(c!.y).toBeGreaterThan(60);
    expect(Math.abs(a!.y + c!.y)).toBeLessThan(2);
    expect(a!.x - b!.x).toBeGreaterThan(12);
    expect(Math.abs(a!.x - c!.x)).toBeLessThan(2);
    expect(a!.opacidad).toBeLessThan(0.7);
    expect(c!.opacidad).toBeLessThan(0.7);
  });

  test('entre dos pasos los tres siguen sobre el mismo círculo, y se mueven con el dedo', async ({ page }) => {
    await page.goto('/');
    await irA(page, 0.5);
    const foco = (await pasos(page))[1]!.x;

    await irA(page, 0.4);
    const entre = await pasos(page);

    // Ninguno está en el foco: la rueda va a medio camino.
    for (const p of entre) expect(p.x - foco).toBeGreaterThan(1);

    // Y los tres caen sobre el mismo círculo.
    const radios = entre.map((p) => radio(p, foco));
    const medio = radios.reduce((s, r) => s + r, 0) / radios.length;
    for (const r of radios) expect(Math.abs(r - medio) / medio).toBeLessThan(0.03);

    // Un poco más abajo, el mismo paso ya está en otro sitio del arco.
    await irA(page, 0.44);
    const despues = await pasos(page);
    expect(despues[1]!.y).toBeLessThan(entre[1]!.y - 10);
  });

  test('tocar un paso lo trae al foco', async ({ page }) => {
    await page.goto('/');
    await irA(page, 0.5);
    const foco = (await pasos(page))[1]!.x;

    await page.locator('.paso-boton').nth(2).click();
    await expect.poll(async () => {
      const p = (await pasos(page))[2]!;
      return Math.abs(p.x - foco) < 1 && Math.abs(p.y) < 2;
    }).toBe(true);
  });

  test('sin animaciones la lista se queda plana', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await irA(page, 0.4);
    for (const p of await pasos(page)) expect(p.transform).toBe('none');
  });
});

test('en el teléfono la lista se queda plana', async ({ page }, info) => {
  test.skip(info.project.name !== 'movil', 'el teléfono no tiene sitio para la órbita');
  await page.goto('/');
  await irA(page, 0.4);
  for (const p of await pasos(page)) expect(p.transform).toBe('none');
});
