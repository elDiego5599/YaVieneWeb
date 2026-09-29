// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import ts from 'typescript';
import { expect, it } from 'vitest';

/**
 * Ningún `destroy()` sin nadie que lo llame.
 *
 * Las piezas de la landing se montan una vez por página y no se
 * desmontan, así que un `destroy()` que nadie llama no se ejerce nunca: ni
 * la página ni una prueba sabrían si deja algo encendido. La auditoría
 * encontró cuatro así (hallazgo 13). Aquí se le pregunta al propio
 * TypeScript quién llama a cada uno, en `src/`, `tests/` y `e2e/`: si una
 * pieza necesita desmontarse, que lo diga su llamador y su prueba.
 */

const raiz = process.cwd();
const archivos = ['src', 'tests', 'e2e'].flatMap((dir) =>
  readdirSync(resolve(raiz, dir), { recursive: true, encoding: 'utf8' })
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.d.ts'))
    .map((f) => join(raiz, dir, f))
);

const servicio = ts.createLanguageService(
  {
    getScriptFileNames: () => archivos,
    getScriptVersion: () => '1',
    getScriptSnapshot: (f) => {
      try {
        return ts.ScriptSnapshot.fromString(readFileSync(f, 'utf8'));
      } catch {
        return undefined;
      }
    },
    getCurrentDirectory: () => raiz,
    getCompilationSettings: () => ({
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      allowImportingTsExtensions: true,
      noEmit: true,
    }),
    getDefaultLibFileName: ts.getDefaultLibFilePath,
    fileExists: ts.sys.fileExists,
    readFile: ts.sys.readFile,
    readDirectory: ts.sys.readDirectory,
  },
  ts.createDocumentRegistry()
);

/** Cada método `destroy` declarado en una clase de src/, con su sitio. */
function destroys(): { donde: string; archivo: string; pos: number }[] {
  const programa = servicio.getProgram()!;
  const hallados: { donde: string; archivo: string; pos: number }[] = [];
  for (const archivo of archivos.filter((f) => f.startsWith(join(raiz, 'src')))) {
    const fuente = programa.getSourceFile(archivo)!;
    const visitar = (nodo: ts.Node): void => {
      if (ts.isMethodDeclaration(nodo) && nodo.name.getText(fuente) === 'destroy') {
        const clase = ts.isClassLike(nodo.parent) ? (nodo.parent.name?.text ?? '?') : '?';
        const { line } = fuente.getLineAndCharacterOfPosition(nodo.name.getStart(fuente));
        hallados.push({
          donde: `${clase}.destroy (${archivo.slice(raiz.length + 1)}:${line + 1})`,
          archivo,
          pos: nodo.name.getStart(fuente),
        });
      }
      ts.forEachChild(nodo, visitar);
    };
    visitar(fuente);
  }
  return hallados;
}

it('cada destroy() de una pieza de src/ tiene quien lo llame', () => {
  const todos = destroys();
  expect(todos.length, 'no encontró ningún destroy: la búsqueda se rompió').toBeGreaterThan(0);
  const huerfanos = todos
    .filter(({ archivo, pos }) => {
      const usos = (servicio.findReferences(archivo, pos) ?? []).flatMap((s) => s.references);
      return !usos.some((r) => !r.isDefinition);
    })
    .map((d) => d.donde);
  expect(huerfanos).toEqual([]);
});
