import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Los miembros privados de las clases de `src/` van con `#`, no con el
 * `private` de TypeScript. El motivo es el peso: el minificador no acorta
 * nombres de propiedades, así que un `private cuadroActual` viaja entero
 * en cada `this.cuadroActual` del paquete, y un `#cuadroActual` sale como
 * `#e`. Pasarlos a `#` bajó el JavaScript de 65,9 a 60,2 KB con el tope en
 * 66; un `private` nuevo no rompe nada ni avisa, sólo devuelve esos bytes
 * poco a poco hasta que el presupuesto revienta sin que se sepa por qué.
 */

const SRC = resolve(process.cwd(), 'src');

/** Todos los .ts de src/, también los de las subcarpetas. */
const fuentes = (): string[] =>
  readdirSync(SRC, { recursive: true, encoding: 'utf8' })
    .filter((f) => f.endsWith('.ts'))
    .map((f) => join(SRC, f));

/**
 * Las líneas que declaran algo con `private`: como modificador de un
 * miembro de clase o de un parámetro del constructor. Los comentarios se
 * quitan antes para que la palabra en prosa no cuente.
 */
function privados(codigo: string): string[] {
  const sinComentarios = codigo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  return sinComentarios
    .split('\n')
    .filter((l) => /(^|[(,])\s*(?:(?:public|protected|static|readonly|override|abstract|declare)\s+)*private\s+[\w$#]/.test(l))
    .map((l) => l.trim());
}

describe('miembros privados con #', () => {
  // Riesgo: la guarda no ve nada porque el detector está roto, y pasa siempre.
  it('el detector reconoce un private y no se deja engañar por la prosa', () => {
    expect(privados('class A {\n  private x = 1;\n}')).toEqual(['private x = 1;']);
    expect(privados('class A {\n  private static readonly R = 1;\n}')).toHaveLength(1);
    expect(privados('class A {\n  constructor(private a: number) {}\n}')).toHaveLength(1);
    expect(privados('class A {\n  #x = 1;\n}')).toEqual([]);
    expect(privados('// private x\n/* private y */\nconst s = 1;')).toEqual([]);
  });

  // Riesgo: un `private` nuevo devuelve al paquete su nombre entero y el presupuesto de JS se pierde sin aviso.
  it('ninguna clase de src/ usa private de TypeScript', () => {
    const hallados = fuentes().flatMap((f) =>
      privados(readFileSync(f, 'utf8')).map((l) => `${f.slice(SRC.length + 1)}: ${l}`)
    );
    expect(hallados, 'usa #nombre en vez de private nombre').toEqual([]);
  });
});
