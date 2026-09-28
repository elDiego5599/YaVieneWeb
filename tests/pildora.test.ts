import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * La píldora de búsqueda de los teléfonos espeja `search_pill_bar.dart`.
 * El dueño quitó el punto verde de delante del texto en la app
 * (2026-09-27) y pidió lo mismo aquí: en las dos píldoras de index.html
 * (la del simulador y la del primer momento) el bloque de texto no lleva
 * nada delante.
 *
 * Con ruta, la app pone arriba «Ruta activa» en pequeño y debajo el nombre
 * de la ruta (`_rutaActiva`), sin «Toca para cambiar»; la etiqueta lleva un
 * destello que la cruza y descansa (`EtiquetaRutaActiva`). El dueño pidió
 * la web alineada con eso (2026-09-27).
 */

const leer = (nombre: string): string =>
  readFileSync(resolve(process.cwd(), nombre), 'utf8');

/** Luminancia relativa de WCAG de un color #RRGGBB. */
const luminancia = (hex: string): number => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contraste = (hex: string): number => 1.05 / (luminancia(hex) + 0.05);

/** Las reglas de un selector exacto en la hoja de estilos (todas). */
const reglas = (css: string, selector: string): string =>
  Array.from(
    css.matchAll(new RegExp(`(?:^|\\n)${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`, 'g')),
    (m) => m[1]
  ).join('\n');

describe('la píldora de la landing va como la de la app', () => {
  const doc = new DOMParser().parseFromString(leer('index.html'), 'text/html');
  const textos = Array.from(doc.querySelectorAll('.app-pill-text'));
  const css = leer('src/css/phone-simulator.css');

  it('index.html tiene las dos píldoras', () => {
    expect(textos.length).toBe(2);
  });

  it('con ruta, «Ruta activa» va arriba y el nombre debajo, sin nada delante', () => {
    for (const bloque of textos) {
      const hijos = Array.from(bloque.children, (h) => h.className);
      expect(hijos.slice(0, 2)).toEqual(['app-pill-etiqueta', 'app-pill-title']);
      expect(bloque.querySelector('.app-pill-etiqueta')?.textContent).toBe('Ruta activa');
    }
  });

  it('ya no dice «Toca para cambiar» en ningún sitio', () => {
    expect(leer('index.html')).not.toMatch(/Toca para cambiar/);
    expect(leer('src/phone-simulator.ts')).not.toMatch(/Toca para cambiar/);
  });

  it('no queda estilo ni guion para un punto que ya no existe', () => {
    expect(css).not.toMatch(/app-pill-dot|app-pill-linea/);
    expect(leer('src/phone-simulator.ts')).not.toMatch(/pill-dot/);
  });

  describe('el destello de «Ruta activa»', () => {
    const etiqueta = reglas(css, '.app-pill-etiqueta');

    it('la tinta y la franja son las de la app, legibles y con luz que se nota', () => {
      expect(etiqueta).toMatch(/#064E3B/i);
      expect(etiqueta).toMatch(/#008846/i);
      // F4: 4,5:1 en toda la pasada. El degradado va de una a otra, así
      // que basta con que lo cumpla la más clara.
      expect(contraste('#008846')).toBeGreaterThanOrEqual(4.5);
      expect(contraste('#064E3B')).toBeGreaterThanOrEqual(4.5);
      // La primera versión de la app no se notaba: la franja pide el
      // triple de luz que la tinta.
      expect(luminancia('#008846') / luminancia('#064E3B')).toBeGreaterThanOrEqual(3);
      expect(etiqueta).toMatch(/font-weight:\s*600/);
    });

    it('cruza en 1,6 s y descansa 1,4 s: un ciclo de 3 s', () => {
      expect(etiqueta).toMatch(/animation:\s*pill-destello\s+3s\b[^;]*infinite/);
      const fotogramas = /@keyframes pill-destello\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? '';
      // La pasada acaba a 1,6 de 3 s y de ahí se queda quieta.
      expect(fotogramas).toMatch(/53\.333%,\s*100%/);
      expect(fotogramas).toMatch(/cubic-bezier\(0\.45,\s*0,\s*0\.55,\s*1\)/);
    });

    it('con el movimiento reducido se queda quieta, en tinta', () => {
      const reducido = /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.app-pill-etiqueta\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
      expect(reducido).toMatch(/animation:\s*none/);
    });
  });
});

describe('la hoja vacía va como la de la app', () => {
  const css = leer('src/css/phone-simulator.css');

  it('el icono va en su medallón de 56, blanco, radio 16 y filo de pelo', () => {
    const medallon = reglas(css, '.sheet-empty-icon');
    expect(medallon).toMatch(/width:\s*calc\(56 \* var\(--u\)\)/);
    expect(medallon).toMatch(/height:\s*calc\(56 \* var\(--u\)\)/);
    expect(medallon).toMatch(/border-radius:\s*calc\(16 \* var\(--u\)\)/);
    expect(medallon).toMatch(/border:\s*1px solid var\(--app-hairline\)/);
    expect(reglas(css, '.sheet-empty-icon svg')).toMatch(/width:\s*calc\(26 \* var\(--u\)\)/);
  });
});
