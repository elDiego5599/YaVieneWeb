import { test, expect, type Page } from '@playwright/test';

/**
 * Las dos averías que sólo se ven en un teléfono, y que la gente notó
 * antes que nosotros: la escena pegada temblando al bajar, y los nombres
 * del riel de momentos saliéndose de su tercio.
 *
 * La primera se descubrió en el problema, que entonces era una pista con
 * su escena pegada. Hoy el problema es una franja —no se pega, no encoge—
 * y la única escena pegada que queda es la de «Cómo funciona», que es
 * donde se comprueba.
 *
 * Las dos aparecen por tamaño de pantalla, no por navegador, y el
 * teléfono del proyecto `movil` —412 de ancho por 915 de alto— es
 * demasiado holgado para ninguna de las dos: ahí la escena cabe sin
 * encoger y los nombres caben sin apretarse. Por eso cada prueba de aquí
 * se corre a mano sobre los tamaños donde sí duele, que son los de los
 * teléfonos que nos escribieron.
 */

const TELEFONOS = [
  { nombre: '320×690', ancho: 320, alto: 690 },
  { nombre: '360×740', ancho: 360, alto: 740 },
  { nombre: '390×844', ancho: 390, alto: 844 },
];

test.describe('la escena en un teléfono', () => {
  test.skip(({ isMobile }) => !isMobile, 'sólo tiene sentido en un teléfono');

  /** Deja la página quieta a `y` píxeles del principio. */
  async function irA(page: Page, y: number): Promise<void> {
    await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), y);
    await page.waitForTimeout(120);
  }

  async function abrir(page: Page, ancho: number, alto: number): Promise<void> {
    await page.setViewportSize({ width: ancho, height: alto });
    await page.goto('/', { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(350);
  }

  /*
    El temblor era esto: el factor de encogido se sacaba con una regla de
    tres —lo que ocupa la escena, deshecho el factor puesto—, y esa cuenta
    da por hecho que encoger a la mitad ocupa la mitad. No es verdad: al
    encoger, `zoom` vuelve a maquetar y el texto se reparte en menos
    líneas. En un teléfono de 390 la escena medía 945 con un factor y 835
    con el otro, y cada medida pedía justo la contraria. 0.926 → 0.818 →
    0.926, cuadro tras cuadro, para siempre.

    Un solo factor, quieto en el tiempo y a cualquier altura de la pista,
    es la prueba de que eso no pasa.
  */
  for (const { nombre, ancho, alto } of TELEFONOS) {
    for (const seccion of ['#solucion']) {
      test(`${seccion} no tiembla en ${nombre}`, async ({ page }) => {
        await abrir(page, ancho, alto);

        const [arriba, largo] = await page.evaluate((s) => {
          const el = document.querySelector(s) as HTMLElement;
          return [el.getBoundingClientRect().top + window.scrollY, el.offsetHeight] as const;
        }, seccion);

        const vistos = new Set<string>();
        for (const parte of [0.2, 0.45, 0.7]) {
          await irA(page, arriba + largo * parte);
          // Diez lecturas seguidas: el temblor cambiaba de factor en cada
          // cuadro, así que con la página quieta se delata igual.
          for (let i = 0; i < 10; i += 1) {
            vistos.add(
              await page.evaluate((s) => {
                const esc = document.querySelector(`${s} .escena`);
                return esc ? getComputedStyle(esc).getPropertyValue('--encaje').trim() || '1' : '1';
              }, seccion)
            );
            await page.waitForTimeout(50);
          }
        }

        expect([...vistos], 'el factor de encogido no se queda quieto').toHaveLength(1);
      });
    }

    test(`la escena pegada cabe entera en ${nombre}`, async ({ page }) => {
      await abrir(page, ancho, alto);

      const arriba = await page.evaluate(
        () => document.querySelector('#solucion')!.getBoundingClientRect().top + window.scrollY
      );
      await irA(page, arriba + alto);
      await page.waitForTimeout(300);

      const sobra = await page.evaluate(() => {
        const esc = document.querySelector('#solucion .escena') as HTMLElement;
        const dentro = esc.firstElementChild as HTMLElement;
        const cs = getComputedStyle(esc);
        const libre =
          Number.parseFloat(cs.minHeight) -
          (Number.parseFloat(cs.paddingTop) || 0) -
          (Number.parseFloat(cs.paddingBottom) || 0);
        return dentro.getBoundingClientRect().height - libre;
      });

      // De una escena pegada, lo que se sale por abajo no se alcanza ni
      // bajando ni subiendo: así se cortaba el reloj.
      expect(sobra, 'la escena se sale de la ventana').toBeLessThanOrEqual(1);
    });

    /*
      Y esto era lo otro: el bloque de móvil del riel iba escrito DEBAJO
      de las reglas de escritorio. Una consulta de medios no suma
      especificidad, así que ganaban las de abajo y el teléfono se
      quedaba con el icono al lado del nombre. «Punto de espera» pedía
      ciento dos píxeles para los noventa y uno de su tercio: se salía
      por los dos lados y su última letra caía debajo del icono de la
      pestaña de al lado.
    */
    test(`los nombres del riel salen enteros en ${nombre}`, async ({ page }) => {
      await abrir(page, ancho, alto);

      const arriba = await page.evaluate(
        () => document.querySelector('#solucion')!.getBoundingClientRect().top + window.scrollY
      );
      await irA(page, arriba + alto);
      await page.waitForTimeout(500);

      const pestanas = await page.evaluate(() =>
        Array.from(document.querySelectorAll('.pasos-tab')).map((tab) => {
          const nombre = tab.querySelector('.pasos-tab-nombre') as HTMLElement;
          const caja = nombre.getBoundingClientRect();
          // El ancho de la letra dibujada, no `scrollWidth`: dentro de
          // una escena encogida `scrollWidth` viene redondeado a entero
          // y acusa de cortadas frases que caben de sobra.
          const rango = document.createRange();
          rango.selectNodeContents(nombre);
          const dibujo = rango.getBoundingClientRect();
          const suya = tab.getBoundingClientRect();
          return {
            texto: (nombre.textContent || '').trim(),
            cortado: dibujo.width > caja.width + 1,
            fuera: dibujo.left < suya.left - 1 || dibujo.right > suya.right + 1,
          };
        })
      );

      expect(pestanas.length).toBe(3);
      expect(pestanas.filter((p) => p.cortado).map((p) => p.texto), 'nombres cortados').toEqual([]);
      expect(
        pestanas.filter((p) => p.fuera).map((p) => p.texto),
        'nombres fuera de su pestaña'
      ).toEqual([]);
    });
  }
});
