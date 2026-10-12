import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * La banda «Cómo funciona» (dueño, 2026-10-12): antes de «Problema»,
 * justo después de la cinta de logos y su divisor. Texto a la izquierda, con
 * su ceja (dueño, 2026-10-12, que la quitó y la devolvió), y a la derecha un mockup breve de la app del
 * pasajero, como el bloque de On-call de incident.io (dueño, 2026-10-12)
 * con su cuadro grande sobre el fondo blanco: un cuadro en el verde de «Problema» con el
 * teléfono (el mismo mapa que los del hero) y, debajo, los tres pasos como
 * pestañas que cambian lo que enseña la pantalla. El teléfono es
 * decoración (`aria-hidden`); cada paso lleva su descripción para el
 * lector de pantalla. El divisor que sigue a la cinta de logos queda antes
 * de esta banda, y otro la separa de «Problema» (dueño, 2026-10-12).
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
  it('va antes de #problema, con un divisor entre las dos (dueño, 2026-10-12)', () => {
    expect(banda).not.toBe('');
    const ini = html.indexOf(banda);
    const problema = html.indexOf('id="problema"');
    expect(problema).toBeGreaterThan(ini);
    expect(html.slice(ini + banda.length).trimStart().startsWith(divisor)).toBe(true);
    const finMarcas = html.indexOf('</section>', html.indexOf('id="marcas"')) + '</section>'.length;
    expect(html.slice(finMarcas).trimStart().startsWith(divisor)).toBe(true);
  });

  it('la cinta de siete logos va tras el hero sin raya y con una antes de la primera sección, sin texto (dueño, 2026-10-12)', () => {
    const franja = /<section[^>]*id="marcas"[^>]*>[\s\S]*?<\/section>/.exec(html)?.[0] ?? '';
    expect(franja).not.toBe('');
    const ini = html.indexOf(franja);
    const fin = ini + franja.length;
    expect(html.indexOf('id="hero"')).toBeLessThan(ini);
    expect(html.slice(html.indexOf('id="hero"'), ini)).not.toContain(divisor);
    expect(html.slice(fin).trimStart().startsWith(divisor)).toBe(true);
    expect(html.split(divisor)).toHaveLength(3);
    expect(html.indexOf('id="como-funciona"')).toBeGreaterThan(fin);
    expect(franja.match(/empresa-marcas-grupo/g)).toHaveLength(2);
    expect(franja).toMatch(/empresa-marcas-grupo" aria-hidden="true"/);
    expect(franja.match(/<img [^>]*alt="[^"]+"/g)).toHaveLength(7);
    expect(franja.match(/<img [^>]*alt=""/g)).toHaveLength(7);
    // Nada de texto visible: ni titulares, ni párrafos, ni enlaces.
    expect(franja).not.toMatch(/<h[1-6]|<p\b|<a\b|<span|<button/);
    expect(franja.replace(/<[^>]*>/g, '').trim()).toBe('');
  });

  it('lleva ceja, titular y párrafo, sin botón', () => {
    expect(banda).toMatch(/<span class="seccion-rotulo cf-ceja">CÓMO FUNCIONA<\/span>\s*<h2/);
    expect(css).toMatch(/\.cf-ceja \{/);
    expect(banda).toMatch(/<h2[^>]*>\s*Tres pasos y ya sabes dónde viene\.\s*<\/h2>/);
    expect(banda).toContain(
      'Escoge tu ruta, mira el bus moverse en el mapa y deja un aviso. Te avisamos cuando esté cerca de ti.'
    );
    expect(banda.slice(0, banda.indexOf('cf-demo'))).not.toMatch(/<a\b|btn-primary/);
  });

  it('la columna de texto no lleva logos ni botón', () => {
    expect(banda).not.toMatch(/empresa-marcas|logos-empresas/);
  });

  it('los tres pasos son pestañas que gobiernan la escena', () => {
    const pestanas = banda.match(/<button[^>]*role="tab"[^>]*>[\s\S]*?<\/button>/g) ?? [];
    expect(banda).toMatch(/role="tablist"/);
    expect(pestanas.map((p) => p.replace(/<[^>]*>/g, '').trim())).toEqual([
      'Elige tu ruta',
      'Mira el bus',
      'Deja un aviso',
    ]);
    expect(pestanas.map((p) => /data-paso="(\w+)"/.exec(p)?.[1])).toEqual(['ruta', 'bus', 'aviso']);
    expect(pestanas.every((p) => p.includes('aria-controls="cf-escena"'))).toBe(true);
    expect(pestanas[0]).toMatch(/aria-selected="true"/);
    expect(pestanas.slice(1).every((p) => /aria-selected="false"[^>]*tabindex="-1"/.test(p))).toBe(true);
    expect(banda).toMatch(
      /id="cf-escena" role="tabpanel" aria-labelledby="cf-paso-ruta" data-paso="ruta"/
    );
    // Una descripción por paso; sin JavaScript se lee la del primero.
    expect(banda.match(/class="solo-lectores" data-paso="\w+"/g)).toHaveLength(3);
    expect(banda.match(/class="solo-lectores" data-paso="\w+" hidden/g)).toHaveLength(2);
  });

  it('el teléfono es decoración, con el mapa de los del hero', () => {
    expect(banda).toMatch(/class="cf-telefono"[^>]*aria-hidden="true"/);
    expect(banda).toMatch(/class="phone-shell"/);
    expect(banda).toMatch(/class="phone-map" id="cf-mapa"/);
    expect(leer('src/main.ts')).toMatch(/#cf-mapa/);
    // Lo que nombra la app, con sus palabras.
    expect(banda).toContain('Elige tu ruta');
    expect(banda).toMatch(/Te avisamos a 1,0 km/);
    expect(banda).toMatch(/eta-detail-accion">Cambiar</);
    // El aviso, con ruta y sin placa ni distancia: de su capa al cierre.
    const ini = banda.indexOf('cf-capa--aviso');
    expect(ini).toBeGreaterThan(-1);
    const aviso = banda.slice(ini, banda.indexOf('</div>', banda.indexOf('cf-aviso-titulo')));
    expect(aviso).toContain('Tu bus de la ruta C16 está cerca de ti');
    expect(aviso).not.toMatch(/[A-Z]{3}\d{3}/);
    expect(aviso).not.toMatch(/\d\s?(m|km)\b/);
  });

  it('muestra las tres pantallas de la app y no duplica ids del hero', () => {
    expect(banda).toContain('Ver buses en vivo');
    expect(banda).toContain('Avisarme cuando esté cerca');
    expect(banda).toContain('Aviso activado');
    const idsHero = [...(html.matchAll(/\bid="([^"]+)"/g))].map((match) => match[1]);
    expect(new Set(idsHero).size).toBe(idsHero.length);
  });

  it('pone las capas de los tres pasos dentro de la pantalla y las pestañas en la demo', () => {
    // Un </div> de más las saca: la hoja queda sin estilos y las pestañas
    // fuera de `Pasos`.
    document.body.innerHTML = banda;
    for (const capa of ['ruta', 'aviso', 'bus']) {
      expect(document.querySelector(`.cf-capa--${capa}`)!.closest('.phone-screen')).not.toBeNull();
    }
    expect(document.querySelector('[role="tablist"]')!.closest('.cf-demo')).not.toBeNull();
  });

  it('espeja Dart con su comentario y entra con el .reveal de la página', () => {
    expect(css).toMatch(/eta_bottom_sheet\.dart/);
    expect(css).toMatch(/bus_notification_service\.dart/);
    expect(banda).toMatch(/class="cf-demo reveal"/);
    expect(leer('src/css/components.css')).toContain("./componentes/como-funciona.css");
  });
});
