import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * «Cambiar», en la nota de la distancia del aviso, se pinta como «Quitar»
 * en la píldora de la ubicación de la app pero con la letra roja (dueño,
 * 2026-10-06): `_PildoraCambiar` de eta_bottom_sheet.dart.
 */

const leer = (nombre: string): string => readFileSync(resolve(process.cwd(), nombre), 'utf8');

const regla = (css: string, selector: string): string =>
  new RegExp(`(?:^|\\n)${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '';

describe('«Cambiar» en la nota de la distancia', () => {
  const css = regla(leer('src/css/phone-simulator.css'), '.eta-detail-accion');

  it('es la píldora gris de «Quitar»: surfaceMuted, filo y radio de píldora', () => {
    expect(css).toMatch(/background:\s*var\(--surface-muted\)/);
    expect(css).toMatch(/border:\s*1px solid var\(--app-hairline\)/);
    expect(css).toMatch(/border-radius:\s*999px/);
    // EdgeInsets.symmetric(horizontal: 12, vertical: 7).
    expect(css).toMatch(/padding:\s*calc\(7 \* var\(--u\)\) calc\(12 \* var\(--u\)\)/);
  });

  it('con la letra roja de la app y en AppTextStyles.etiqueta (13, w600)', () => {
    expect(css).toMatch(/color:\s*var\(--app-coral-accessible\)/);
    expect(css).toMatch(/font-size:\s*calc\(13 \* var\(--u\)\)/);
    expect(css).toMatch(/font-weight:\s*600/);
    expect(css).not.toMatch(/azul-boton/);
  });
});
