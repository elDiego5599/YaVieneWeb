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

function aRgb(css: string): [number, number, number] {
  const n = css.match(/\d+(\.\d+)?/g)!.map(Number);
  return [n[0], n[1], n[2]];
}

const PAGINAS = ['/', '/empresas.html'];

test.describe('contraste de las cejillas', () => {
  for (const ruta of PAGINAS) {
    test(`las cejillas de ${ruta} llegan a AA`, async ({ page }) => {
      await page.goto(ruta, { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);

      const cuantas = await page.locator('.tracked-eyebrow').count();
      expect(cuantas, 'no hay cejillas que medir').toBeGreaterThan(0);

      const flojas: string[] = [];
      for (let i = 0; i < cuantas; i += 1) {
        const sitio = await page.evaluate((n) => {
          const el = document.querySelectorAll('.tracked-eyebrow')[n] as HTMLElement;
          el.scrollIntoView({ block: 'center', behavior: 'instant' });
          const c = el.getBoundingClientRect();
          return {
            texto: (el.textContent || '').trim(),
            color: getComputedStyle(el).color,
            // Justo a la izquierda de la letra: mismo fondo, sin letra
            // encima que ensucie la medida.
            x: Math.max(0, Math.round(c.left) - 6),
            y: Math.round(c.top + c.height / 2),
          };
        }, i);
        await page.waitForTimeout(200);

        const fondo = await pixel(page, sitio.x, sitio.y);
        const razon = contraste(aRgb(sitio.color), fondo);
        // Once píxeles en mayúsculas es texto pequeño para la norma: 4.5:1.
        if (razon < 4.5) {
          flojas.push(`«${sitio.texto}» ${sitio.color} sobre rgb(${fondo}) → ${razon.toFixed(2)}:1`);
        }
      }

      expect(flojas, 'cejillas por debajo de 4.5:1').toEqual([]);
    });
  }
});
