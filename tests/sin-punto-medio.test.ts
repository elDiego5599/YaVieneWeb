import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * El punto medio «·» no va en lo que se lee (dueño, 2026-10-18: «trata de
 * no usar ese punto en ningún lado»). La app lo quitó de todo y lo vigila
 * en `app_pasajero/test/sin_punto_medio_test.dart`; la web la espeja: lo
 * que separaba, ahora lo separa una coma. Se mira el código sin sus
 * comentarios, así que un texto nuevo que lo traiga cae aquí.
 */
const raiz = process.cwd();
const sinComentariosHtml = (s: string): string => s.replace(/<!--[\s\S]*?-->/g, '');
const sinComentariosCodigo = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

function archivos(dir: string, ext: RegExp): string[] {
  return readdirSync(resolve(raiz, dir), { withFileTypes: true, recursive: true })
    .filter(e => e.isFile() && ext.test(e.name))
    .map(e => join(e.parentPath, e.name));
}

describe('ningún texto de la web lleva «·»', () => {
  for (const pagina of ['index.html', 'empresas.html', 'privacidad.html', 'terminos.html', '404.html']) {
    it(pagina, () => {
      expect(sinComentariosHtml(readFileSync(resolve(raiz, pagina), 'utf8'))).not.toContain('·');
    });
  }

  it('src (TypeScript y CSS)', () => {
    const conPunto = archivos('src', /\.(ts|css)$/).filter(f =>
      sinComentariosCodigo(readFileSync(f, 'utf8')).includes('·'),
    );
    expect(conPunto).toEqual([]);
  });
});
