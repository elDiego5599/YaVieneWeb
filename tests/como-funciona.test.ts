import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * La banda «Cómo funciona» (dueño, 2026-10-12): entre dos rayas, justo
 * después del hero y antes de «Problema». Texto a la izquierda, a la
 * derecha tres tarjetas encimadas que espejan la app del pasajero (el
 * selector, la hoja del bus y el aviso). Las tarjetas son decoración
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
  it('va entre dos divisores, tras el hero y antes de #problema', () => {
    expect(banda).not.toBe('');
    const hero = html.indexOf('id="hero"');
    const ini = html.indexOf(banda);
    const fin = ini + banda.length;
    const problema = html.indexOf('id="problema"');
    expect(hero).toBeGreaterThan(-1);
    expect(hero).toBeLessThan(ini);
    expect(problema).toBeGreaterThan(fin);
    const antes = html.slice(0, ini).trimEnd();
    const despues = html.slice(fin);
    expect(antes.endsWith(divisor)).toBe(true);
    expect(despues.trimStart().startsWith(divisor)).toBe(true);
    // El divisor de arriba es el de siempre: nada del hero lo separa de la banda.
    expect(html.slice(hero, ini).split(divisor)).toHaveLength(2);
    expect(html.slice(fin, problema).split(divisor)).toHaveLength(2);
  });

  it('lleva ceja, titular y párrafo, sin botón', () => {
    expect(banda).toMatch(/class="seccion-rotulo cf-ceja"[^>]*>\s*CÓMO FUNCIONA\s*</);
    expect(banda).toMatch(/<h2[^>]*>\s*Sal cuando tu bus esté cerca\s*<\/h2>/);
    expect(banda).toContain(
      'Escoge tu ruta, mira el bus moverse en el mapa y deja un aviso. Te avisamos cuando esté cerca de ti.'
    );
    expect(banda.slice(0, banda.indexOf('cf-tarjetas'))).not.toMatch(/<a\b|btn-primary/);
  });

  it('las tarjetas son decoración y el aviso lleva ruta, sin placa ni distancia', () => {
    expect(banda).toMatch(/class="cf-tarjetas"[^>]*aria-hidden="true"/);
    expect(banda.match(/class="cf-tarjeta /g)).toHaveLength(3);
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
    expect(banda.match(/class="cf-tarjeta [^"]*\breveal\b/g)).toHaveLength(3);
    expect(leer('src/css/components.css')).toContain("./componentes/como-funciona.css");
  });
});
