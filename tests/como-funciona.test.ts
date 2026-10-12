import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * La banda «Cómo funciona» (dueño, 2026-10-12): después de «Problema»
 * (dueño, 2026-10-12, que antes la puso entre el hero y «Problema»). Texto a la izquierda, sin
 * ceja (dueño, 2026-10-12), y a la derecha un mockup breve de la app del
 * pasajero, como el de incident.io: el mapa de la C16 detrás y encima el
 * selector, la hoja del bus y el aviso. Las tarjetas son decoración
 * (`aria-hidden`); lo accesible es la columna de texto.
 *
 * Su id NO es `solucion`: `sin-como-funciona.test.ts` sigue vigilando
 * que la sección vieja no vuelva.
 */
const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8');
const html = leer('index.html').replace(/<!--[\s\S]*?-->/g, '');
const css = leer('src/css/componentes/como-funciona.css');

const banda = /<section[^>]*id="como-funciona"[^>]*>[\s\S]*?<\/section>/.exec(html)?.[0] ?? '';
const divisor = '<hr class="divisor" aria-hidden="true" />';

describe('banda «Cómo funciona»', () => {
  it('va tras #problema, con un divisor entre las dos, y es la última banda', () => {
    expect(banda).not.toBe('');
    const ini = html.indexOf(banda);
    const problema = html.indexOf('id="problema"');
    expect(problema).toBeGreaterThan(-1);
    expect(problema).toBeLessThan(ini);
    expect(html.slice(0, ini).trimEnd().endsWith(divisor)).toBe(true);
    expect(html.slice(problema, ini).split(divisor)).toHaveLength(2);
  });

  it('la cinta de siete logos va sola entre los dos divisores tras el hero, sin texto (dueño, 2026-10-12)', () => {
    const franja = /<section[^>]*id="marcas"[^>]*>[\s\S]*?<\/section>/.exec(html)?.[0] ?? '';
    expect(franja).not.toBe('');
    const ini = html.indexOf(franja);
    const fin = ini + franja.length;
    expect(html.indexOf('id="hero"')).toBeLessThan(ini);
    expect(html.slice(0, ini).trimEnd().endsWith(divisor)).toBe(true);
    expect(html.slice(fin).trimStart().startsWith(divisor)).toBe(true);
    expect(html.slice(html.indexOf('id="hero"'), ini).split(divisor)).toHaveLength(2);
    expect(html.indexOf('id="problema"')).toBeGreaterThan(fin);
    expect(franja.match(/empresa-marcas-grupo/g)).toHaveLength(2);
    expect(franja).toMatch(/empresa-marcas-grupo" aria-hidden="true"/);
    expect(franja.match(/<img [^>]*alt="[^"]+"/g)).toHaveLength(7);
    expect(franja.match(/<img [^>]*alt=""/g)).toHaveLength(7);
    // Nada de texto visible: ni titulares, ni párrafos, ni enlaces.
    expect(franja).not.toMatch(/<h[1-6]|<p\b|<a\b|<span|<button/);
    expect(franja.replace(/<[^>]*>/g, '').trim()).toBe('');
  });

  it('lleva titular y párrafo, sin ceja ni botón', () => {
    expect(banda).not.toMatch(/seccion-rotulo|cf-ceja|CÓMO FUNCIONA/);
    expect(css).not.toMatch(/\.cf-ceja/);
    expect(banda).toMatch(/<h2[^>]*>\s*Sal cuando tu bus esté cerca\s*<\/h2>/);
    expect(banda).toContain(
      'Escoge tu ruta, mira el bus moverse en el mapa y deja un aviso. Te avisamos cuando esté cerca de ti.'
    );
    expect(banda.slice(0, banda.indexOf('cf-tarjetas'))).not.toMatch(/<a\b|btn-primary/);
  });

  it('la columna de texto no lleva logos ni botón', () => {
    expect(banda).not.toMatch(/empresa-marcas|logos-empresas/);
  });

  it('las tarjetas son decoración y el aviso lleva ruta, sin placa ni distancia', () => {
    expect(banda).toMatch(/class="cf-tarjetas"[^>]*aria-hidden="true"/);
    expect(banda.match(/class="cf-tarjeta /g)).toHaveLength(4);
    // Detrás, el mapa de verdad: el mismo lienzo que los teléfonos.
    expect(banda).toMatch(/cf-tarjeta--mapa[\s\S]*?class="phone-map" id="cf-mapa"[\s\S]*?<svg class="routes-svg-layer" id="cf-mapa-rutas">/);
    expect(leer('src/main.ts')).toMatch(/#cf-mapa-rutas[\s\S]*?setRoute\('R-106'\)/);
    // Las del selector y la hoja nombran lo que la app nombra.
    expect(banda).toContain('Elige tu ruta');
    expect(banda).toMatch(/Te avisamos a 1,0 km/);
    expect(banda).toMatch(/eta-detail-accion">Cambiar</);
    // El aviso es la última tarjeta: de ahí al final de la banda.
    const aviso = banda.slice(banda.indexOf('cf-tarjeta--aviso'));
    expect(aviso).not.toBe('');
    expect(aviso).toContain('Tu bus de la ruta C16 está cerca de ti');
    expect(aviso).not.toMatch(/[A-Z]{3}\d{3}/);
    expect(aviso).not.toMatch(/\d\s?(m|km)\b/);
  });

  it('espeja Dart con su comentario y entra con el .reveal de la página', () => {
    expect(css).toMatch(/eta_bottom_sheet\.dart/);
    expect(css).toMatch(/bus_notification_service\.dart/);
    expect(banda.match(/class="cf-tarjeta [^"]*\breveal\b/g)).toHaveLength(4);
    expect(leer('src/css/components.css')).toContain("./componentes/como-funciona.css");
  });
});
