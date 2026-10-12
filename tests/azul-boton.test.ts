import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * El azul de los botones de la app (#1E56A8, `AppColors.acento` en
 * ya_viene_core/lib/core/theme/app_theme.dart) llega a la web
 * (2026-09-28). El dueño lo eligió para lo que va lleno y no para
 * íconos, y pidió tres cosas:
 *
 * - el botón del teléfono de la portada («Elegir empresa») lo espeja,
 *   como el de `route_selector_sheet.dart`;
 * - el panel de flota dibujado en empresas.html pinta el filtro de ruta
 *   y la pestaña activos como el panel de control (`AppColors.boton`);
 * - (y «Qué resuelve» cambió su rojo por ese azul, pero el dueño lo vio
 *   y pidió el rojo de vuelta el mismo día: la cara «A ciegas» es una
 *   alerta y el azul le quitaba la alarma).
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
const contraste = (a: string, b: string): number => {
  const [claro, oscuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro + 0.05) / (oscuro + 0.05);
};

/** Las reglas de un selector exacto en la hoja de estilos (todas). */
const reglas = (css: string, selector: string): string =>
  Array.from(
    css.matchAll(new RegExp(`(?:^|\\n)${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`, 'g')),
    (m) => m[1]
  ).join('\n');

const variable = (css: string, nombre: string): string =>
  css.match(new RegExp(`${nombre}:\\s*(#[0-9A-Fa-f]{6});`))?.[1] ?? '';

describe('el azul de los botones de la app, en la web', () => {
  const variables = leer('src/css/variables.css');
  const azul = variable(variables, '--azul-boton');

  it('es el mismo de la app', () => {
    expect(azul.toUpperCase()).toBe('#1E56A8');
  });

  it('se lee: blanco encima, y como letra sobre la banda', () => {
    expect(contraste('#FFFFFF', azul)).toBeGreaterThanOrEqual(4.5);
    expect(contraste(azul, variable(variables, '--banda'))).toBeGreaterThanOrEqual(4.5);
  });

  it('el botón del teléfono lo espeja', () => {
    const css = leer('src/css/phone-simulator.css');
    expect(reglas(css, '.app-launch')).toMatch(/background:\s*var\(--azul-boton\)/);
  });

  it('el panel de flota dibujado pinta lo activo como el panel de control', () => {
    const css = leer('src/css/componentes/empresas-pagina.css');
    expect(reglas(css, '.flota-filtros .es-activo')).toMatch(/background:\s*var\(--azul-boton\)/);
    expect(reglas(css, '.flota-filtros .es-activo')).toMatch(/border-color:\s*var\(--azul-boton\)/);
    expect(reglas(css, '.flota-pestanas .es-activa')).toMatch(/background:\s*var\(--azul-boton\)/);
  });

  it('«Qué resuelve» conserva su rojo: ni el azul ni su tinte llegan ahí', () => {
    const css = leer('src/css/componentes/problema.css');
    expect(css).not.toMatch(/azul-boton/);
    expect(variables).not.toMatch(/--azul-boton-claro/);
    expect(reglas(css, '.escenario-estado')).toMatch(/background:\s*var\(--coral-accessible\)/);
    expect(reglas(css, '#problema .cara--ciego .apagado')).toMatch(/var\(--coral-accessible\)/);
    // Las baldosas de las fichas llevaban su tinte coral; desde que el
    // escenario son avisos (2026-10-12) el rojo es sólo de la píldora:
    // lo vigila tests/escenario-avisos.test.ts.
  });
});
