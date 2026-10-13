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

  it('lleva titular con acento verde y párrafo, sin ceja ni botón (dueño, 2026-10-12)', () => {
    expect(banda).not.toMatch(/cf-ceja/);
    expect(banda).toMatch(/<h2[^>]*>\s*Tres pasos <span class="acentuado">y ya sabes dónde viene\.<\/span>\s*<\/h2>/);
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
    expect(banda).toMatch(/class="phone-map" id="cf-mapa-tel"/);
    expect(banda).toMatch(/class="phone-map" id="cf-mapa"/);
    expect(leer('src/main.ts')).toMatch(/#cf-mapa-tel/);
    // Lo que nombra la app, con sus palabras.
    expect(banda).toContain('Elige tu ruta');
    expect(banda).toMatch(/Te avisamos a 1,0 km/);
    expect(banda).toMatch(/eta-detail-accion">Cambiar</);
    document.body.innerHTML = banda;
    const aviso = document.querySelector('.cf-aviso-notificacion')!.textContent ?? '';
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

  it('monta el mapa compartido como composición independiente para el paso del bus', () => {
    document.body.innerHTML = banda;
    expect(document.querySelectorAll('#cf-mapa')).toHaveLength(1);
    expect(document.querySelectorAll('#cf-mapa-tel')).toHaveLength(1);
    expect(banda).not.toMatch(/cf-capa--bus|cf-capa--aviso/);
    expect(document.querySelector('#cf-mapa')!.closest('.cf-mapa-tarjeta')).not.toBeNull();
    expect(document.querySelector('#cf-mapa-tel')!.closest('.phone-screen')).not.toBeNull();
    expect(document.querySelector('.cf-mapa-distancia')?.textContent).toContain('medido por la calle');
    expect(document.querySelector('.cf-mapa-distancia .eta-number')?.textContent).toBe('1,8');
    expect(document.querySelector('[role="tablist"]')!.closest('.cf-demo')).not.toBeNull();
  });

  it('muestra el selector de distancia y la notificación en la composición del aviso', () => {
    expect(banda).toContain('¿A qué distancia te avisamos?');
    expect(banda).toContain('900 m');
    expect(banda).toContain('1,0 km');
    expect(banda).toContain('1,1 km');
    expect(banda).toContain('800 m');
    expect(banda).toContain('1,2 km');
    expect(banda).toMatch(/class="cf-aviso-notificacion[^"]*"[^>]*aria-hidden="true"/);
    expect(banda).toMatch(/class="cf-guardar"[^>]*>Guardar</);
    expect(banda).toMatch(/class="eta-detail-accion">Cambiar</);
    expect(banda).toMatch(/Aviso activado/);
    expect(banda).toMatch(/Avisarme cuando esté cerca/);
    document.body.innerHTML = banda;
    expect(document.querySelector('.cf-aviso-composicion button, .cf-aviso-composicion h1, .cf-aviso-composicion h2, .cf-aviso-composicion h3')).toBeNull();
  });

  it('en el paso de la ruta enseña el selector dentro del teléfono', () => {
    // Sin esta regla las capas se quedan en `opacity: 0` y el teléfono sale
    // con el mapa pelado.
    expect(css).toMatch(/\.cf-escena\[data-paso="ruta"\] \.cf-capa--ruta\s*\{[^}]*opacity:\s*1/);
  });

  it('pone las fichas de la ruta delante de la flecha y el mapa en una tarjeta inset', () => {
    expect(css).toMatch(/\.cf-chips\s*\{[^}]*z-index:\s*2/);
    expect(css).toMatch(/\.cf-flecha\s*\{[^}]*z-index:\s*1/);
    expect(css).toMatch(/\.cf-mapa-tarjeta #cf-mapa\s*\{[^}]*width:\s*80%/);
    expect(css).toMatch(/\.cf-mapa-tarjeta #cf-mapa\s*\{[^}]*height:\s*80%/);
    expect(css).toMatch(/\.cf-tap\b/);
  });

  it('usa la ciudad completa y tokens de acabado sereno en la demo', () => {
    expect(leer('src/main.ts')).toMatch(/new PhoneMap\(svgCf, lienzoCf, \{ zoom: 1 \}\)/);
    expect(css).toMatch(/--cf-borde:\s*rgba\(/);
    expect(css).toMatch(/--cf-sombra:\s*0 1px 2px/);
    expect(css).toMatch(/scale:\s*0\.985/);
  });

  it('espeja Dart con su comentario y entra con el .reveal de la página', () => {
    expect(css).toMatch(/eta_bottom_sheet\.dart/);
    expect(css).toMatch(/bus_notification_service\.dart/);
    expect(banda).toMatch(/class="cf-demo reveal"/);
    expect(leer('src/css/components.css')).toContain("./componentes/como-funciona.css");
  });
});
