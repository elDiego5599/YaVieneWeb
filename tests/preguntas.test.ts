import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * «Preguntas frecuentes» (dueño, 2026-10-12: «haz lo que creas que se vea
 * mejor»): la última sección antes del pie. El pie ya invita a las
 * empresas; esto le contesta al pasajero lo que se pregunta antes de
 * bajarse la app. `<details>` nativos: se abren con teclado y el lector
 * los anuncia sin una línea de JavaScript. Cada respuesta dice lo que hace
 * el producto hoy (D3, D4, D13, el GPS en el bus, la distancia por la
 * calle), no lo que hará.
 */
const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8');
const html = leer('index.html').replace(/<!--[\s\S]*?-->/g, '');
const css = leer('src/css/componentes/preguntas.css');
const indice = leer('src/css/components.css');

const seccion = /<section[^>]*id="preguntas"[^>]*>[\s\S]*?<\/section>/.exec(html)?.[0] ?? '';
const preguntas = [...seccion.matchAll(/<summary[^>]*>([\s\S]*?)<\/summary>/g)].map((m) =>
  m[1].replace(/<[^>]+>/g, '').trim()
);

describe('«Preguntas frecuentes»', () => {
  it('va tras #problema y justo antes del pie', () => {
    expect(seccion).not.toBe('');
    const ini = html.indexOf(seccion);
    expect(html.indexOf('id="problema"')).toBeLessThan(ini);
    expect(html.slice(ini + seccion.length).trimStart()).toMatch(/^<\/main>\s*<footer/);
  });

  it('tiene su titular y lo nombra como región', () => {
    expect(seccion).toMatch(/aria-labelledby="preguntas-titulo"/);
    expect(seccion).toMatch(/<h2[^>]*id="preguntas-titulo"[^>]*>Preguntas frecuentes/);
  });

  it('contesta lo que se pregunta el pasajero, con details nativos', () => {
    expect(preguntas).toEqual([
      '¿Tengo que crear una cuenta?',
      '¿Cómo sabe dónde viene el bus?',
      '¿La distancia es en línea recta?',
      '¿Me avisa con la app cerrada?',
      '¿Qué pasa con mi ubicación?',
    ]);
    expect(seccion.match(/<details/g)).toHaveLength(5);
    expect(seccion).not.toMatch(/<button|onclick|role="button"/);
  });

  it('dice la verdad del producto: sin cuenta, GPS en el bus, por la calle, iPhone abierta', () => {
    const texto = seccion.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    expect(texto).toMatch(/no tiene cuenta|sin cuenta/i);
    expect(texto).toMatch(/GPS va (montado )?en el bus/);
    expect(texto).toMatch(/por la calle/);
    expect(texto).toMatch(/En iPhone[^.]*app abierta/);
    // Sin «qué empresas están»: las rutas están en la app, pero todavía no
    // se trabaja con ninguna empresa (dueño, 2026-10-12).
    expect(texto).not.toMatch(/Sobusa|Coolitoral|empresas están/);
    expect(texto).not.toMatch(/minutos|llega en|tiempo de llegada/i);
    expect(texto).not.toMatch(/\bETA\b/);
    expect(texto).not.toMatch(/rutas reales/);
    expect(seccion).toMatch(/href="\/privacidad\.html"/);
  });

  it('el CSS entra por el índice, antes del pie, y respeta el movimiento reducido', () => {
    expect(indice.indexOf("./componentes/preguntas.css")).toBeGreaterThan(-1);
    expect(indice.indexOf("./componentes/preguntas.css")).toBeLessThan(indice.indexOf("./componentes/pie.css"));
    expect(css).toMatch(/prefers-reduced-motion/);
    expect(css).toMatch(/summary::-webkit-details-marker/);
  });
});
