import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Ninguna empresa está confirmada todavía (dueño, 2026-10-11), así que la
 * web no puede enseñar logos como si ya conectaran su flota. Si vuelve la
 * cinta, que sea porque hay una empresa confirmada y este archivo se
 * cambia a propósito, no porque alguien la restauró de un commit viejo.
 *
 * Sobusa y Coolitoral siguen en la app como rutas; eso es cierto y se dice
 * así, sin «ya se mueve» ni «ya conectan».
 */
const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8');
const sinComentarios = (html: string) => html.replace(/<!--[\s\S]*?-->/g, '');

describe('sin cinta de logos hasta que haya empresa confirmada', () => {
  for (const pagina of ['index.html', 'empresas.html']) {
    it(`${pagina}: sin cinta, sin logos de empresas ni «ya conectan su flota»`, () => {
      const html = sinComentarios(leer(pagina));
      expect(html).not.toMatch(/empresa-marcas|marcas-claras|logos-empresas/);
      expect(html).not.toMatch(/ya conectan/i);
    });
  }

  it('los logos y la hoja de la cinta ya no están en el repo', () => {
    expect(existsSync(resolve(process.cwd(), 'src/assets/logos-empresas'))).toBe(false);
    expect(existsSync(resolve(process.cwd(), 'src/css/componentes/marcas.css'))).toBe(false);
    expect(leer('src/css/components.css')).not.toContain('marcas.css');
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
