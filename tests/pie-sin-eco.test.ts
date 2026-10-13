import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * El pie decía «6 rutas reales» dos veces seguidas: en la nota bajo los
 * botones («En movimiento con Sobusa y sus 6 rutas reales.») y, una
 * pantalla más abajo, en la caja «En movimiento · 6 rutas reales · Las
 * rutas de Sobusa ya están en la app». La misma frase dos veces en el mismo pie
 * se lee como relleno. Se quedó la caja, que lo decía con cifra.
 *
 * Y la caja también se fue (dueño, 2026-10-12): las rutas de Sobusa
 * están en la app, pero no se trabaja todavía con ninguna empresa, y «Las
 * rutas de Sobusa ya están en la app» al pie de cada página se leía como
 * un acuerdo que no hay.
 */
describe('el pie no repite lo que dice', () => {
  for (const pagina of ['index.html', 'empresas.html', 'privacidad.html', 'terminos.html']) {
    it(`${pagina}: sin la caja «En movimiento · 6 rutas reales»`, () => {
      const html = readFileSync(resolve(process.cwd(), pagina), 'utf8');
      const pie = html.match(/<footer[\s\S]*?<\/footer>/)![0].replace(/<!--[\s\S]*?-->/g, '');
      expect(pie).not.toMatch(/rutas reales|En movimiento|EN MOVIMIENTO|Sobusa/);
      expect(pie).not.toContain('footer-status');
      expect(pie).not.toContain('footer-cta-note');
    });
  }
});
