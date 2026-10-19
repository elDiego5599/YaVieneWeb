import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { colorRuta, coloresRuta } from '../src/data/color-ruta';

/**
 * La ruta del mapa, en el color de su ruta sobre orla blanca.
 *
 * Fue verde para todas (2026-09-28); desde el 2026-10-19 cada ruta lleva
 * el suyo, el de su ficha, su trazo y su bus, como las líneas en Transit
 * (dueño). La app lo lleva en `color_ruta.dart` y `estilo_ruta.dart`, y
 * este es su espejo en el teléfono.
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

  it('la línea del teléfono va en el color de su ruta, entera', () => {
    const linea = reglas(telefono, '.map-route-active');
    expect(linea).toMatch(/stroke:\s*var\(--ruta, var\(--azul-boton\)\)/);
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

  it('los terminales, blancos con filo del color de la ruta', () => {
    expect(reglas(telefono, '.map-terminals circle')).toMatch(/stroke:\s*var\(--ruta, var\(--azul-boton\)\)/);
  });

  it('el bus del teléfono va en el color de su ruta, no en coral', () => {
    // `createFlatTransitMarker(color)`: de arriba el color aclarado un 30 %
    // con blanco, abajo el color entero.
    const ts = leer('src/phone-map.ts');
    expect(ts).not.toMatch(/E86A5E|EF978E/i);
    expect(ts).toMatch(/stop-color:\s*color-mix\(in srgb, var\(--ruta\) 70%, #FFFFFF\)/);
    expect(ts).toMatch(/style\.setProperty\('--ruta', colorRuta\(route\.nombre\)\)/);
  });

  it('phone-map.ts dibuja la orla antes que la línea', () => {
    const ts = leer('src/phone-map.ts');
    const orla = ts.indexOf("'map-route-casing'");
    const linea = ts.indexOf("'map-route-active'");
    expect(orla).toBeGreaterThan(-1);
    expect(orla).toBeLessThan(linea);
  });
});

describe('el color de cada ruta (color_ruta.dart)', () => {
  it('los mismos valores que la app', () => {
    expect(coloresRuta).toEqual({
      B18: '#1E56A8',
      C11: '#047857',
      C12: '#7E22CE',
      C13: '#0F766E',
      C14: '#BE185D',
      C16: '#4338CA',
      A1: '#0E7490',
      A3: '#A21CAF',
      A4: '#4D7C0F',
    });
  });

  it('lee el código del nombre, sin importar mayúsculas, y si no cae al azul de botón', () => {
    expect(colorRuta('C16 Calle 72 Uninorte')).toBe('#4338CA');
    expect(colorRuta('c11 Silencio')).toBe('#047857');
    expect(colorRuta('Ruta Norte')).toBe('#1E56A8');
    expect(colorRuta('Z99 Nueva')).toBe('#1E56A8');
  });
});
