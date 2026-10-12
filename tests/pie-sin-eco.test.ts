import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * El pie decía «6 rutas reales» dos veces seguidas: en la nota bajo los
 * botones («En movimiento con Sobusa y sus 6 rutas reales.») y, una
 * pantalla más abajo, en la caja «En movimiento · 6 rutas reales · Las
 * rutas de Sobusa ya están en la app». La misma frase dos veces en el mismo pie
 * se lee como relleno. Se queda la caja, que es la que lo dice con cifra.
 */
describe('el pie no repite lo que dice', () => {
  for (const pagina of ['index.html', 'empresas.html']) {
    it(`${pagina}: «rutas reales» una sola vez`, () => {
      const html = readFileSync(resolve(process.cwd(), pagina), 'utf8');
      const pie = html.match(/<footer[\s\S]*?<\/footer>/)![0].replace(/<!--[\s\S]*?-->/g, '');
      expect(pie.match(/rutas reales/g)).toHaveLength(1);
      expect(pie).not.toContain('footer-cta-note');
    });
  }
});
