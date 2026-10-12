import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * La ruta del mapa, verde sobre orla blanca (2026-09-28).
 *
 * El teléfono la pintaba en el azul eléctrico, sola, espejando el azul que
 * llevaba map_widget.dart. El dueño pidió una sola ruta, la del producto,
 * en la web y en la app. La app la lleva en `estilo_ruta.dart` y este es su
 * espejo en el teléfono.
 */

const leer = (nombre: string): string =>
  readFileSync(resolve(process.cwd(), nombre), 'utf8');

const reglas = (css: string, selector: string): string =>
  Array.from(
    css.matchAll(new RegExp(`(?:^|\\n)${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`, 'g')),
    (m) => m[1]
  ).join('\n');

describe('la ruta del teléfono', () => {
  const telefono = leer('src/css/phone-simulator.css');

  it('la línea del teléfono va en el mismo verde, entera', () => {
    const linea = reglas(telefono, '.map-route-active');
    expect(linea).toMatch(/stroke:\s*var\(--green\)/);
    expect(linea).not.toMatch(/stroke-opacity/);
    expect(telefono).not.toMatch(/electric-blue/);
  });

  it('con su orla blanca debajo, al doble de ancho (8 contra 4, estilo_ruta.dart)', () => {
    const orla = reglas(telefono, '.map-route-casing');
    expect(orla).toMatch(/stroke:\s*#FFFFFF/i);
    expect(orla).toMatch(/stroke-width:\s*calc\(8 \* var\(--u\)\)/);
    expect(orla).toMatch(/stroke-opacity:\s*0\.95/);
    expect(reglas(telefono, '.map-route-active')).toMatch(/stroke-width:\s*calc\(4 \* var\(--u\)\)/);
  });

  it('los terminales, blancos con filo verde', () => {
    expect(reglas(telefono, '.map-terminals circle')).toMatch(/stroke:\s*var\(--green\)/);
  });

  it('phone-map.ts dibuja la orla antes que la línea', () => {
    const ts = leer('src/phone-map.ts');
    const orla = ts.indexOf("'map-route-casing'");
    const linea = ts.indexOf("'map-route-active'");
    expect(orla).toBeGreaterThan(-1);
    expect(orla).toBeLessThan(linea);
  });
});
