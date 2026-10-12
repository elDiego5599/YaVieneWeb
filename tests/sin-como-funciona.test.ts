import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * La sección «Cómo funciona» se quitó entera (dueño, 2026-10-11). Si vuelve
 * `id="solucion"` o un enlace a `#solucion`, que sea porque el dueño la
 * pidió y este archivo se cambia a propósito, no porque alguien restauró
 * un commit viejo.
 */
const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8');
const sinComentarios = (html: string) => html.replace(/<!--[\s\S]*?-->/g, '');

describe('sin la sección «Cómo funciona»', () => {
  for (const pagina of ['index.html', 'empresas.html', 'privacidad.html', 'terminos.html', '404.html']) {
    it(`${pagina}: ni id="solucion" ni enlaces a #solucion`, () => {
      const html = sinComentarios(leer(pagina));
      expect(html).not.toMatch(/id="solucion"/);
      expect(html).not.toMatch(/href="[^"]*#solucion"/);
    });
  }

  it('sus módulos y su hoja ya no están en el repo', () => {
    for (const ruta of ['src/paso-foco.ts', 'src/paso-demo.ts', 'src/encaje.ts', 'src/selector.ts', 'src/css/componentes/pasos.css']) {
      expect(existsSync(resolve(process.cwd(), ruta)), ruta).toBe(false);
    }
    expect(leer('src/css/components.css')).not.toContain('pasos.css');
  });
});
