import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * La sombra del bus, espejo de map_markers.dart y del `_FlatBusPainter`
 * del panel. El ícono gira con el rumbo: la sombra de antes, del color del
 * bus y corrida hacia abajo del dibujo, quedaba detrás de él como una
 * estela, y al dueño le pareció rarísima (2026-09-30). Ahora es gris y
 * centrada, así que se ve igual gire como gire.
 */

const leer = (nombre: string): string => readFileSync(resolve(process.cwd(), nombre), 'utf8');

/** Las declaraciones de un selector exacto en la hoja de estilos. */
const regla = (css: string, selector: string): string =>
  css.match(new RegExp(`(?:^|\\n)${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`))?.[1] ?? '';

describe('la sombra del bus en la web', () => {
  it('el bus del teléfono: gris, centrada, σ 2,4 del sprite', () => {
    const art = regla(leer('src/css/phone-simulator.css'), '.map-bus-art');
    // En CSS el desenfoque de drop-shadow es 2σ: 2 × 2,4 = 4,8.
    expect(art).toMatch(/filter:\s*drop-shadow\(0 0 4\.8px rgba\(0, 0, 0, 0\.24\)\)/);
  });

  it('el bus en línea del panel dibujado: gris y centrada, σ = h × 0,04', () => {
    const css = leer('src/css/componentes/empresas-pagina.css');
    const enLinea = regla(css, ".flota-bus[data-bus-estado='en-linea']::after");
    // h = 33 u, σ = 1,32 u y el desenfoque de box-shadow es 2σ = 2,64 u.
    expect(enLinea).toMatch(/box-shadow:\s*0 0 calc\(2\.64 \* var\(--u\)\) rgba\(0, 0, 0, 0\.24\);/);
    expect(enLinea).not.toMatch(/45%, transparent/);
  });
});
