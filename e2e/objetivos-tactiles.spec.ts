import { expect, test } from '@playwright/test';

/**
 * Objetivos táctiles de 44 px como mínimo (Apple HIG, WCAG 2.5.5) en el
 * teléfono: todo lo tocable que se ve tiene un blanco de dedo de al menos
 * 44 × 44. Se mide el blanco y no sólo la caja: nav.css y pie.css crecen el
 * blanco con un pseudo-elemento invisible para no engordar el dibujo, y ese
 * `::before`/`::after` absoluto se suma a la caja del elemento. Un enlace
 * dentro de una frase (en línea) queda exento, como en la norma.
 */
const PAGINAS = ['/', '/empresas.html', '/privacidad.html', '/terminos.html'];
const MIN = 44;
// Medio píxel de tolerancia: el redondeo de subpíxeles del navegador.
const TOLERANCIA = 0.5;

for (const ruta of PAGINAS) {
  test(`${ruta}: todo lo tocable mide 44 px`, async ({ page }, info) => {
    test.skip(info.project.name !== 'movil', 'los blancos de dedo son del teléfono');
    await page.goto(ruta);
    // Que los `.reveal` ya estén en su sitio: se mide la caja, no el gesto.
    await page.evaluate(() => document.documentElement.classList.add('sin-reveal'));
    const cortos = await page.evaluate(
      ({ min, tol }) => {
        const tocables = document.querySelectorAll<HTMLElement>(
          'a[href], button, input:not([type="hidden"]), select, textarea, summary, [role="button"], [role="tab"], [role="slider"]'
        );
        const malos: string[] = [];
        /** La caja del elemento más la de sus pseudo-elementos absolutos. */
        const blanco = (el: HTMLElement): { ancho: number; alto: number } => {
          const c = el.getBoundingClientRect();
          let izq = c.left, arr = c.top, der = c.right, aba = c.bottom;
          for (const pseudo of ['::before', '::after']) {
            const p = getComputedStyle(el, pseudo);
            if (p.content === 'none' || p.position !== 'absolute') continue;
            const l = c.left + el.clientLeft + parseFloat(p.left);
            const t = c.top + el.clientTop + parseFloat(p.top);
            const w = parseFloat(p.width);
            const h = parseFloat(p.height);
            if ([l, t, w, h].some(Number.isNaN)) continue;
            izq = Math.min(izq, l);
            arr = Math.min(arr, t);
            der = Math.max(der, l + w);
            aba = Math.max(aba, t + h);
          }
          return { ancho: der - izq, alto: aba - arr };
        };
        for (const el of tocables) {
          const estilo = getComputedStyle(el);
          if (estilo.display === 'none' || estilo.visibility === 'hidden') continue;
          if (el.closest('[inert], [hidden], [aria-hidden="true"]')) continue;
          // Enlace dentro de una frase: exento.
          if (estilo.display === 'inline' && el.parentElement?.textContent !== el.textContent) continue;
          const caja = el.getBoundingClientRect();
          if (caja.width === 0 || caja.height === 0) continue;
          const { ancho, alto } = blanco(el);
          if (ancho < min - tol || alto < min - tol) {
            const nombre = (el.getAttribute('aria-label') ?? el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 30);
            malos.push(`${el.tagName.toLowerCase()}.${el.className.toString().split(' ')[0]} «${nombre}» ${ancho.toFixed(0)}×${alto.toFixed(0)}`);
          }
        }
        return malos;
      },
      { min: MIN, tol: TOLERANCIA }
    );
    expect(cortos).toEqual([]);
  });
}
