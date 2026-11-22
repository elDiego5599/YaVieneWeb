import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * La hoja del bus con el diseño que eligió el dueño (2026-09-30, «A»),
 * espejo de eta_bottom_sheet.dart: sin la franja de color de arriba,
 * «BUS» y la placa blanca encabezan, un filo separa quién es de cuánto
 * falta, y el detalle va en una nota con su ícono. Las dos hojas de la
 * portada —el teléfono del hero y el del paso 3— lo llevan igual.
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

/** Las hojas de distancia de la portada, cada una hasta su botón. */
const hojas = (html: string): string[] =>
  Array.from(html.matchAll(/<span class="sheet-handle"><\/span>([\s\S]*?)data-el="alert-btn"|data-view="eta">([\s\S]*?)data-el="alert-btn"/g), (m) => m[1] ?? m[2] ?? '').filter((h) =>
    h.includes('eta-value')
  );

describe('la hoja del bus, diseño «A», en la web', () => {
  const html = leer('index.html');
  const css = leer('src/css/phone-simulator.css');
  const variables = leer('src/css/variables.css');

  it('la franja de color de arriba ya no está en ningún lado', () => {
    for (const nombre of ['index.html', 'src/phone-simulator.ts']) {
      expect(leer(nombre), nombre).not.toMatch(/eta-bar|eta-strip|eta-route/);
    }
    expect(css).not.toMatch(/\.eta-strip|\.eta-route/);
  });

  it('la hoja lleva «BUS», la placa y el filo, en ese orden', () => {
    const encontradas = hojas(html);
    expect(encontradas).toHaveLength(1);
    for (const hoja of encontradas) {
      const bus = hoja.indexOf('<span class="eta-bus">BUS</span>');
      const placa = hoja.indexOf('class="eta-placa"');
      const filo = hoja.indexOf('class="eta-filo"');
      const numero = hoja.indexOf('data-el="eta-value"');
      expect(bus).toBeGreaterThanOrEqual(0);
      expect([bus < placa, placa < filo, filo < numero]).toEqual([true, true, true]);
    }
  });

  it('el detalle es una nota: ícono mudo y su texto', () => {
    for (const hoja of hojas(html)) {
      expect(hoja).toMatch(
        /class="eta-detail"[^>]*>\s*<span class="eta-detail-icono" aria-hidden="true">[\s\S]*?<\/span>\s*<span[^>]*>/
      );
    }
    // El texto del hero lo pone el simulador en su propio nodo, sin pisar
    // el ícono.
    expect(html).toContain('data-el="eta-sub-texto"');
    expect(leer('src/phone-simulator.ts')).toContain("'eta-sub-texto'");
    expect(leer('src/phone-simulator.ts')).toContain("'eta-placa'");
  });

  it('la placa es la blanca del servicio público y la letra negra se lee encima', () => {
    const placa = variable(variables, '--app-placa');
    expect(placa.toUpperCase()).toBe('#FFFFFF');
    expect(contraste(variable(variables, '--app-text-primary'), placa)).toBeGreaterThanOrEqual(4.5);
  });

  it('la placa lleva el filo oscuro: sin él, el blanco se pierde en la arena', () => {
    const placa = variable(variables, '--app-placa');
    expect(contraste(placa, variable(variables, '--arena'))).toBeLessThan(3);
    const regla = reglas(css, '.eta-placa');
    expect(regla).toMatch(/background:\s*var\(--app-placa\)/);
    expect(regla).toMatch(/border:\s*calc\(1\.5 \* var\(--u\)\) solid var\(--app-text-primary\)/);
    expect(regla).toMatch(/color:\s*var\(--app-text-primary\)/);
  });

  it('la placa y la distancia van en la tarjeta con marco; la nota y el botón, fuera', () => {
    for (const hoja of hojas(html)) {
      const tarjeta = hoja.match(/<div class="eta-tarjeta">([\s\S]*?)<div class="eta-unit"[^>]*>[^<]*<\/div>\s*<\/div>/)?.[1] ?? '';
      for (const dentro of ['class="eta-placa"', 'class="eta-filo"', 'data-el="eta-value"']) {
        expect(tarjeta, dentro).toContain(dentro);
      }
      const despues = hoja.slice(hoja.indexOf('class="eta-tarjeta"') + tarjeta.length);
      expect(despues).toContain('data-el="eta-sub"');
      expect(tarjeta).not.toContain('eta-detail');
    }
    const regla = reglas(css, '.eta-tarjeta');
    expect(regla).toMatch(/border:\s*1px solid var\(--app-hairline\)/);
    expect(regla).toMatch(/border-radius:\s*calc\(24 \* var\(--u\)\)/);
    expect(regla).toMatch(/background:\s*#FFFFFF/);
    // AppShadows.soft (eta_bottom_sheet.dart): blanca sobre la hoja blanca,
    // la despega la sombra suave.
    expect(regla).toMatch(/box-shadow:\s*var\(--sombra-suave\)/);
  });

  it('el filo es de un punto en el hairline de la app', () => {
    const regla = reglas(css, '.eta-filo');
    expect(regla).toMatch(/height:\s*1px/);
    expect(regla).toMatch(/background:\s*var\(--app-hairline\)/);
  });
});
