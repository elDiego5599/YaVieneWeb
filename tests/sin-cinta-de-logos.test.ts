import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Ninguna empresa está confirmada todavía (dueño, 2026-10-11), así que la
 * web no puede decir que ya conectan su flota. El 2026-10-12 el dueño
 * decidió devolver la cinta con los siete logos, pero solo en la portada,
 * como banda propia (`#marcas`) entre las dos rayas tras el hero, sin
 * rótulo ni texto que afirme nada. /empresas.html sigue sin cinta.
 *
 * Sobusa y Coolitoral siguen en la app como rutas; eso es cierto y se dice
 * así, sin «ya se mueve» ni «ya conectan».
 */
const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8');
const sinComentarios = (html: string) => html.replace(/<!--[\s\S]*?-->/g, '');

describe('la cinta de logos solo vive en su banda de la portada', () => {
  it('empresas.html: sin cinta, sin logos ni «ya conectan su flota»', () => {
    const html = sinComentarios(leer('empresas.html'));
    expect(html).not.toMatch(/empresa-marcas|marcas-claras|logos-empresas/);
    expect(html).not.toMatch(/ya conectan/i);
  });

  it('index.html: la cinta existe solo dentro de #marcas y sin «ya conectan»', () => {
    const html = sinComentarios(leer('index.html'));
    const banda = /<section[^>]*id="marcas"[^>]*>[\s\S]*?<\/section>/.exec(html)?.[0] ?? '';
    expect(banda).toContain('empresa-marcas-carrusel');
    expect(html.replace(banda, '')).not.toMatch(/empresa-marcas|marcas-claras|logos-empresas/);
    expect(html).not.toMatch(/ya conectan/i);
  });

  it('marcas.css se carga y los siete logos están en el repo', () => {
    expect(leer('src/css/components.css')).toContain('marcas.css');
    expect(readdirSync(resolve(process.cwd(), 'src/assets/logos-empresas'))).toHaveLength(7);
  });

  it('empresas.html dice la verdad y lleva al formulario', () => {
    const html = sinComentarios(leer('empresas.html'));
    expect(html).toContain('Estamos sumando las primeras empresas de Barranquilla.');
    expect(html).toMatch(/<a [^>]*href="#solicitar"[^>]*>Sea de las primeras\.<\/a>/);
    expect(html).toContain('id="solicitar"');
  });

  for (const pagina of ['index.html', 'empresas.html', 'privacidad.html', 'terminos.html']) {
    it(`${pagina}: el pie no afirma que Sobusa ya opere el servicio`, () => {
      expect(sinComentarios(leer(pagina))).not.toContain('Sobusa ya se mueve');
    });
  }
});
