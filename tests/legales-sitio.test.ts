import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Términos y privacidad se ven como el resto del sitio (2026-09-28).
 *
 * Tenían cabecera y pie propios —un «Ya Viene» espaciado con «Volver a la
 * página» y una línea de pie— sobre fondo arena, y el dueño las vio como
 * de otra web. Ahora llevan la misma isla de navegación y el mismo pie que
 * la portada y empresas.html, sobre el papel blanco, y la pestaña dice
 * «Ya Viene Términos» / «Ya Viene Privacidad», con la marca primero como
 * «Ya Viene para empresas».
 */

const leer = (nombre: string): string =>
  readFileSync(resolve(process.cwd(), nombre), 'utf8');

/** El enlace de la marca de la isla, con el logo en SVG: es el mismo en todas. */
const marca = (html: string): string =>
  html.match(/<a href="\/" class="nav-island-brand"[\s\S]*?<\/a>/)?.[0] ?? '';

const PAGINAS = [
  { fichero: 'terminos.html', titulo: 'Ya Viene Términos', lugar: 'Términos' },
  { fichero: 'privacidad.html', titulo: 'Ya Viene Privacidad', lugar: 'Privacidad' },
];

describe('las páginas legales, como el resto del sitio', () => {
  for (const { fichero, titulo, lugar } of PAGINAS) {
    describe(fichero, () => {
      const html = leer(fichero);

      it(`la pestaña dice «${titulo}»`, () => {
        expect(html).toContain(`<title>${titulo}</title>`);
      });

      it('lleva la isla de navegación de las otras páginas, con su logo', () => {
        expect(html).toContain('<header class="site-header is-arriba">');
        expect(marca(html)).not.toBe('');
        expect(marca(html)).toBe(marca(leer('empresas.html')));
        expect(html).toMatch(new RegExp(`<span class="nav-lugar" aria-hidden="true">${lugar}</span>`));
        expect(html).toContain('class="nav-island-toggle"');
        expect(html).not.toMatch(/legal-top|legal-marca|legal-volver/);
      });

      it('y el pie de las otras páginas', () => {
        expect(html).toContain('<footer class="site-footer" id="pie">');
        expect(html).toContain('class="footer-legal-links"');
        expect(html).not.toMatch(/legal-pie/);
      });

      it('sobre el papel blanco: sin la clase que ponía la arena', () => {
        expect(html).toMatch(/<body id="top">/);
      });

      it('arranca con su propio guion, que enciende la isla', () => {
        expect(html).toContain('<script type="module" src="/src/legal.ts"></script>');
      });
    });
  }

  it('el guion de las legales enciende la isla y el rebote del pie', () => {
    const ts = leer('src/legal.ts');
    expect(ts).toMatch(/new NavIsland\(/);
    expect(ts).toMatch(/reboteDelPie\(\)/);
  });

  it('legales.css ya no pinta la arena ni dibuja cabecera y pie propios', () => {
    const css = leer('src/css/componentes/legales.css');
    expect(css).not.toMatch(/\.legal-(body|top|marca|volver|pie)\b/);
  });
});
