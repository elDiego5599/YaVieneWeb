import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { VACIO } from '../src/panel-flota';

/**
 * Los huecos y errores de la web, mirados de una vez (T6.7 · inventario de
 * estados vacíos y de error).
 *
 * `VACIO` es el texto que el panel de /empresas.html enseña cuando una
 * pestaña no tiene buses. Los cuatro literales son espejo de los del panel
 * de escritorio (`app_control/lib/features/fleet/presentation/screens/
 * dashboard_screen.dart:877-886`): si allá cambian un copy, aquí hay que
 * cambiarlo igual. La web no puede mirar el otro repo en CI, así que el
 * eslabón es esta lista escrita a mano —igual que `coherencia-textos`—.
 *
 * El inventario completo (los 3 productos) vive en
 * `inventario-estados.md` del workspace.
 */

const leer = (nombre: string): string => readFileSync(resolve(process.cwd(), nombre), 'utf8');

describe('los huecos del panel web', () => {
  it('enseñan los mismos literales que el panel de escritorio', () => {
    expect(VACIO).toEqual({
      todos: 'Sin buses registrados',
      linea: 'Ningún bus en línea en esta ruta',
      ocultos: 'Ningún bus oculto en esta ruta',
      'sin-senal': 'Ningún bus sin señal en esta ruta',
    });
  });

  it('cada una de las cuatro pestañas tiene su texto', () => {
    for (const texto of Object.values(VACIO)) {
      expect(texto.length, texto).toBeGreaterThan(0);
    }
    expect(Object.keys(VACIO)).toEqual([
      'todos',
      'linea',
      'ocultos',
      'sin-senal',
    ]);
  });
});

describe('la página 404', () => {
  const pagina = leer('404.html');

  it('dice que no sabemos dónde está la página pedida', () => {
    expect(pagina).toContain('No sabemos dónde está esta página.');
  });

  it('explica la idea comparándola con cómo la app marca un bus sin señal', () => {
    expect(pagina).toContain('enseña su última posición como si fuera la de ahora');
    expect(pagina).toContain('te dice que no sabe. Con las direcciones hacemos lo mismo.');
  });
});
