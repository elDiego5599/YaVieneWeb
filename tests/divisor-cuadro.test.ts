import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * La raya entre la cinta de logos y «Cómo funciona» mide lo que el cuadro
 * grande de abajo (dueño, 2026-10-12): el mismo tope y la misma calle.
 */
const leer = (ruta: string) => readFileSync(resolve(process.cwd(), ruta), 'utf8');
const regla = (css: string, sel: string) =>
  new RegExp(`${sel.replace(/[.+#]/g, '\\$&')}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '';

describe('el divisor tras los logos', () => {
  it('tiene el ancho del cuadro de «Cómo funciona»', () => {
    const tope = /max-width:\s*(\d+)px/.exec(regla(leer('src/css/componentes/como-funciona.css'), '.cf-grid'))?.[1];
    expect(tope).toBeDefined();
    const divisor = regla(leer('src/css/layout.css'), '#marcas + .divisor');
    expect(divisor).toMatch(new RegExp(`width:\\s*min\\(${tope}px,\\s*100% - 2 \\* var\\(--calle\\)\\)`));
    expect(divisor).toMatch(/margin-inline:\s*auto/);
  });
});
