import zlib from 'node:zlib';
import { test, expect, type Page } from '@playwright/test';

/**
 * El contraste de un texto no se sabe leyendo el CSS. El fondo de verdad
 * es lo que queda tras el panel, el gradiente que respira, la capa de
 * puntitos y lo que haya encima; una cejilla puede estar declarada sobre
 * `--arena` y acabar sobre un crema que no aparece escrito en ninguna
 * parte. Así que aquí no se lee: se mira un píxel de la pantalla.
 */

/** El color de un píxel de la página, ya compuesto. */
async function pixel(page: Page, x: number, y: number): Promise<[number, number, number]> {
  const png = await page.screenshot({ clip: { x, y, width: 1, height: 1 } });
  // Un PNG es cabecera de ocho bytes y luego trozos: largo, nombre, datos,
  // control. Sólo nos interesan los `IDAT`, que juntos y descomprimidos
  // dan las filas; cada fila empieza por su byte de filtro, y en una
  // imagen de un solo píxel detrás vienen sus componentes.
  const trozos: Buffer[] = [];
  for (let i = 8; i < png.length; ) {
    const largo = png.readUInt32BE(i);
    if (png.toString('ascii', i + 4, i + 8) === 'IDAT') {
      trozos.push(png.subarray(i + 8, i + 8 + largo));
    }
    i += 12 + largo;
  }
  const filas = zlib.inflateSync(Buffer.concat(trozos));
  return [filas[1], filas[2], filas[3]];
}

/** Luminancia relativa, tal como la define la WCAG. */
function luz([r, g, b]: [number, number, number]): number {
  const canal = (c: number): number => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

function contraste(a: [number, number, number], b: [number, number, number]): number {
  const [alto, bajo] = luz(a) >= luz(b) ? [luz(a), luz(b)] : [luz(b), luz(a)];
  return (alto + 0.05) / (bajo + 0.05);
}

/** `rgb(...)` o `rgba(...)` tal como lo devuelve el navegador. */
function aRgb(css: string): [number, number, number, number] {
  const n = css.match(/\d+(\.\d+)?/g)!.map(Number);
  return [n[0], n[1], n[2], n[3] === undefined ? 1 : n[3]];
}

/**
 * Media tinta sobre un fondo. Casi todos los grises de la página son el
 * mismo azul con alfa, así que su color de verdad no existe hasta que se
 * sabe qué hay detrás: comparar el `rgba` a pelo contra el fondo daría
 * siempre el contraste del negro y no fallaría nunca.
 */
function sobre(
  [r, g, b, a]: [number, number, number, number],
  fondo: [number, number, number]
): [number, number, number] {
  return [
    r * a + fondo[0] * (1 - a),
    g * a + fondo[1] * (1 - a),
    b * a + fondo[2] * (1 - a),
  ];
}

/* Lo que se mide en cada página. No es la lista de todo lo que lleva
   letra: son los sitios donde el color del texto no es la tinta plena
   —cejillas, rótulos del pie, cifras de colores, la palabra en verde del
   titular— que es donde el contraste se cae sin que nadie lo note. */
const MUESTRAS: Record<string, string[]> = {
  '/': [
    '.tracked-eyebrow',
    '.hero-title .highlight',
    '.acentuado',
    '.nav-island-cta',
    '.btn-green',
    '.hero-description',
    '.hero-subtext-lead',
    '.apagado',
    // La banda de «Qué resuelve»: fondo propio, así que su rótulo en
    // rojo y su letra chica se miden aparte de los de papel blanco.
    '#problema .seccion-rotulo',
    '#problema .columna-texto',
    '.rutas-dato-numero',
    '.rutas-dato-rotulo',
    // El rótulo «Simulación» del mapa en vivo (T6.10): letra de 10,5 en la
    // pastilla de la atribución, que es blanca a medias sobre el mosaico.
    '[data-mapa-simulacion]',
    '.footer-nav-group > span',
    '.footer-status > span',
    '.footer-nav a',
    '.footer-legal-links a',
  ],
  '/empresas.html': [
    '.tracked-eyebrow',
    '.nav-island-cta',
    '.btn-green',
    '.form-submit-btn',
    // La cabecera del panel y las tres razones, que van sobre la banda:
    // el rótulo, la parte en verde de los dos titulares —la de
    // «Beneficios» ya no va apagada, así que en esta página no queda
    // ningún `.apagado` que medir— y la letra chica de cada columna.
    '.seccion-rotulo',
    '.seccion-lead',
    '.acentuado',
    '#beneficios .columna-texto',
    '.empresa-razon-pieza',
    // La atribución del plano, que salió del mapa a la página: letra de
    // 12 en gris tenue sobre el papel.
    '.despacho-credito',
    '.footer-nav-group > span',
    '.footer-legal-links a',
  ],
};

/**
 * Lo que la norma pide para este texto: 3:1 si es grande —24 px, o 18.66
 * en negrita— y 4.5:1 si no (WCAG 1.4.3, nivel AA).
 */
function pedido(px: number, peso: number): number {
  const grande = px >= 24 || (px >= 18.66 && peso >= 700);
  return grande ? 3 : 4.5;
}

test.describe('contraste del texto que no va en tinta plena', () => {
  // Cada muestra son tres viajes al navegador y una captura de pantalla, con
  // su espera para que el color esté compuesto: veinte y pico muestras por
  // página se van a medio minuto largo, y con la máquina ocupada corriendo el
  // resto de la suite en paralelo se pasaba de los 30 s por defecto y fallaba
  // por tiempo sin haber medido nada. El tope es sólo tiempo: lo que se
  // comprueba y lo que se da por bueno no cambia.
  test.describe.configure({ timeout: 150_000 });

  for (const [ruta, selectores] of Object.entries(MUESTRAS)) {
    test(`el texto de ${ruta} llega a AA`, async ({ page }) => {
      await page.goto(ruta, { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);

      const flojos: string[] = [];
      let medidos = 0;

      for (const sel of selectores) {
        const cuantos = await page.locator(sel).count();
        expect(cuantos, `«${sel}» no existe en ${ruta}`).toBeGreaterThan(0);

        for (let i = 0; i < cuantos; i += 1) {
          // Primero se trae a la vista y se deja terminar la aparición. Lo
          // que va dentro de un `.reveal` entra fundiéndose en 0.7 s, más
          // su turno de `data-reveal-delay`, y medido a mitad de camino el
          // fondo sale mezclado con lo de detrás: el botón del formulario
          // salió a 4.35:1 porque el píxel era su verde al 86 % sobre
          // blanco, no su verde. Y antes de que el observador lo destape
          // está en `opacity: 0`, que `checkVisibility` da por escondido y
          // se saltaba sin medir. Se espera a que todo `.reveal` por
          // encima esté entero; si alguno no llega, se mide igual y lo que
          // salga lo dirá la cuenta de abajo, no un tiempo agotado mudo.
          await page.evaluate(
            ([s, n]: [string, number]) => {
              const el = document.querySelectorAll(s)[n] as HTMLElement;
              el.scrollIntoView({ block: 'center', behavior: 'instant' });
            },
            [sel, i] as [string, number]
          );
          await page
            .waitForFunction(
              ([s, n]: [string, number]) => {
                const el = document.querySelectorAll(s)[n] as HTMLElement;
                for (let p = el.closest('.reveal'); p; p = p.parentElement?.closest('.reveal') ?? null) {
                  if (getComputedStyle(p).opacity !== '1') return false;
                }
                return true;
              },
              [sel, i] as [string, number],
              { timeout: 3_000 }
            )
            .catch(() => {});

          // Se apaga la letra antes de mirar el píxel: así lo que se mide
          // es el fondo de verdad —panel, gradiente, puntitos y lo que
          // haya debajo— y no una mezcla a medias con la propia letra. Sin
          // transición: el rótulo de «Qué resuelve» funde su color en
          // 0,5 s, y a los 120 ms de la captura la letra seguía a medio
          // irse y teñía el «fondo» (salía rosa con el rojo y azulado con
          // el azul, y el rótulo daba menos contraste del que tiene).
          const sitio = await page.evaluate(
            ([s, n]: [string, number]) => {
              const el = document.querySelectorAll(s)[n] as HTMLElement;
              const cs = getComputedStyle(el);
              const c = el.getBoundingClientRect();
              const x = Math.round(c.left + Math.min(c.width / 2, 8));
              const y = Math.round(c.top + c.height / 2);
              // Lo que está guardado detrás del menú cerrado, apagado o
              // fuera de la ventana no se mide: ahí el píxel no es el
              // fondo de nadie. `checkVisibility` mira también a los
              // padres, que es donde suele estar el escondite.
              const visible =
                c.width > 0 &&
                c.height > 0 &&
                el.checkVisibility({ opacityProperty: true, visibilityProperty: true }) &&
                x >= 0 &&
                y >= 0 &&
                x < window.innerWidth &&
                y < window.innerHeight;
              const color = cs.color;
              if (visible) {
                el.dataset.contrasteColor = el.style.color;
                el.dataset.contrasteTransicion = el.style.transition;
                el.style.transition = 'none';
                el.style.color = 'transparent';
              }
              return {
                texto: (el.textContent || '').trim().slice(0, 40),
                color,
                px: parseFloat(cs.fontSize),
                peso: Number(cs.fontWeight) || 400,
                visible,
                x,
                y,
              };
            },
            [sel, i] as [string, number]
          );

          if (!sitio.visible) continue;
          await page.waitForTimeout(120);
          const fondo = await pixel(page, sitio.x, sitio.y);

          await page.evaluate(
            ([s, n]: [string, number]) => {
              const el = document.querySelectorAll(s)[n] as HTMLElement;
              el.style.color = el.dataset.contrasteColor || '';
              el.style.transition = el.dataset.contrasteTransicion || '';
              delete el.dataset.contrasteColor;
              delete el.dataset.contrasteTransicion;
            },
            [sel, i] as [string, number]
          );

          medidos += 1;
          const razon = contraste(sobre(aRgb(sitio.color), fondo), fondo);
          const minimo = pedido(sitio.px, sitio.peso);
          if (razon < minimo) {
            flojos.push(
              `${sel} «${sitio.texto}» ${sitio.color} sobre rgb(${fondo}) → ` +
                `${razon.toFixed(2)}:1, hace falta ${minimo}:1`
            );
          }
        }
      }

      expect(medidos, 'no se midió nada').toBeGreaterThan(0);
      expect(flojos, 'texto por debajo del contraste que pide la norma').toEqual([]);
    });
  }
});
