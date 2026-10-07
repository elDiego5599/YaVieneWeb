import { test, expect, type Page } from '@playwright/test';

/**
 * Los pasos de «Cómo funciona», a la derecha del visor, ruedan en vertical
 * mientras se baja (pedido del dueño, 2026-09-28, con la «Circular Split
 * Roll» de hyperiux como referencia): el paso de turno llega al centro de
 * la lista y ahí se ve entero; los otros esperan arriba y abajo, más
 * pequeños y más tenues. Primero se probó sobre un arco y el dueño lo
 * quiso recto: todo en vertical, nada se corre hacia los lados.
 *
 * Lo que se comprueba es la geometría y no un número de CSS: que los tres
 * van en la misma columna, que se detienen en cada paso y siguen al
 * dedo entre uno y otro, y que
 * en el teléfono y sin animaciones la lista sigue plana.
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

test.describe('los pasos ruedan en vertical', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'escritorio', 'el rodillo es de escritorio');
  });

  test('con un paso en el foco, los otros dos esperan simétricos arriba y abajo', async ({ page }) => {
    await page.goto('/');
    await irA(page, 0.5);
    const [a, b, c] = await pasos(page);

    // El del medio manda: está en el foco, entero y a plena luz.
    expect(Math.abs(b!.y)).toBeLessThan(2);
    expect(b!.opacidad).toBe(1);

    // Los otros dos, uno arriba y otro abajo, a la misma distancia y en
    // la misma columna que él: nada se corre hacia los lados.
    expect(a!.y).toBeLessThan(-60);
    expect(c!.y).toBeGreaterThan(60);
    expect(Math.abs(a!.y + c!.y)).toBeLessThan(2);
    expect(Math.abs(a!.x - b!.x)).toBeLessThan(1);
    expect(Math.abs(c!.x - b!.x)).toBeLessThan(1);
    expect(a!.opacidad).toBeLessThan(0.7);
    expect(c!.opacidad).toBeLessThan(0.7);
  });

  // Sigue al dedo entre dos pasos y se detiene un trecho en cada uno
  // (dueño, 2026-10-07): ni suelto ni a saltos.
  test('se queda quieto en un paso y sigue al dedo al cruzar', async ({ page }) => {
    await page.goto('/');
    await irA(page, 0.42);
    const quieto = await pasos(page);
    expect(Math.abs(quieto[1]!.y), 'el segundo en el foco').toBeLessThan(2);

    await irA(page, 0.58);
    expect(await pasos(page), 'bajar dentro de la parada no lo mueve').toEqual(quieto);

    await irA(page, 2 / 3);
    const cruce = await pasos(page);
    expect(cruce[1]!.y, 'en el cruce va a medio camino').toBeLessThan(-20);
    expect(cruce[2]!.y).toBeGreaterThan(20);

    await irA(page, 0.85);
    const siguiente = await pasos(page);
    expect(Math.abs(siguiente[2]!.y), 'el tercero llega al foco').toBeLessThan(2);
    for (const p of siguiente) expect(Math.abs(p.x - quieto[1]!.x)).toBeLessThan(1);
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
