import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

/**
 * T6.5 · Los rótulos de la interfaz viven en dos sitios: en la app
 * (Flutter) y aquí, donde la landing los repite en los pasos, en el
 * selector y en el simulador del teléfono. Nadie los mira juntos: un día
 * la app pasa a decir «Elige tu empresa» y la página sigue con «Elige
 * empresa» meses, porque ninguna prueba cruza los dos repos.
 *
 * Los documentos legales ya se ataron así —`tests/coherencia.test.ts`
 * aquí, `test/legal_*` allá—, con la misma lista afirmada en los dos
 * lados. Esto hace lo mismo con la interfaz.
 *
 * El listado espejo, con los archivos de la app, vive en
 * `YaViene/app_pasajero/test/coherencia_textos_test.dart`: si cambia una
 * frase, se cambia en los dos archivos de código y en las dos pruebas.
 * Ninguna CI trae el otro repo, así que cada lado se vigila solo y la
 * lista compartida es el eslabón.
 */

// Desde la raíz del proyecto, que es donde vitest se planta.
const leer = (nombre: string): string =>
  readFileSync(resolve(process.cwd(), nombre), 'utf8');

/** El HTML parte rótulos a lo largo de varias líneas; la app no. */
const enUnaLinea = (texto: string): string => texto.replace(/\s+/g, ' ');

/**
 * Solo lo que se pinta. La versión anterior buscaba la frase en el archivo
 * entero, y la auditoría del 2026-09-27 (R-04) cambió «Ruta activa» en la
 * píldora del simulador sin que la prueba se enterara: la frase seguía en
 * un comentario del mismo archivo. Aquí no cuentan los comentarios, ni los
 * atributos (`aria-label`, `alt`, `title`, `data-*`), ni los scripts y
 * estilos en línea del HTML.
 */
function textoPintado(nombre: string): string {
  const fuente = leer(nombre);
  if (nombre.endsWith('.html')) {
    // Vitest corre sobre happy-dom. Dentro de un `<template>` el HTML se
    // parsea inerte: un DOMParser iría a buscar las hojas de estilo.
    const plantilla = document.createElement('template');
    plantilla.innerHTML = fuente;
    const cuerpo = plantilla.content;
    cuerpo.querySelectorAll('script, style').forEach((nodo) => nodo.remove());
    return enUnaLinea(cuerpo.textContent ?? '');
  }
  // En TypeScript lo pintado sale de literales de texto (`this.texto(...)`,
  // `textContent = ...`, las tablas del selector); los comentarios no son
  // nodos del árbol y no llegan aquí.
  const arbol = ts.createSourceFile(nombre, fuente, ts.ScriptTarget.Latest, true);
  const textos: string[] = [];
  const visitar = (nodo: ts.Node): void => {
    if (
      (ts.isStringLiteralLike(nodo) || ts.isTemplateLiteralToken(nodo)) &&
      !esRotuloAccesible(nodo)
    ) {
      textos.push(nodo.text);
    }
    ts.forEachChild(nodo, visitar);
  };
  visitar(arbol);
  return enUnaLinea(textos.join('\n'));
}

/** `setAttribute('aria-…', x)` o `el.ariaLabel = x`: se oye, no se ve. */
function esRotuloAccesible(nodo: ts.Node): boolean {
  const padre = nodo.parent;
  if (ts.isCallExpression(padre)) {
    const [atributo] = padre.arguments;
    return (
      atributo !== nodo &&
      atributo !== undefined &&
      ts.isStringLiteralLike(atributo) &&
      atributo.text.startsWith('aria-')
    );
  }
  return (
    ts.isBinaryExpression(padre) &&
    ts.isPropertyAccessExpression(padre.left) &&
    padre.left.name.text === 'ariaLabel'
  );
}

/** frase → archivos de la web donde la frase tiene que verse. */
const FRASES: Record<string, string[]> = {
  '¿Qué bus esperas?': ['index.html'],
  'Toca para buscar tu ruta': ['index.html'],
  'Ruta activa': ['index.html'],
  'Elige tu ruta': ['index.html'],
  'Empresa de transporte masivo': ['index.html'],
  'Ver buses en vivo': ['index.html'],
  'Dos pasos y ves los buses moviéndose.': ['index.html'],
  'Avisarme cuando esté cerca': ['index.html'],
  'Aviso activado': ['src/phone-simulator.ts'],
  'Toca el mapa para indicar dónde estás': ['index.html'],
  'Ahí ponemos tu punto de espera y medimos desde él': ['index.html'],
  // La nota del aviso puesto en el iPhone (`_Nota.distancia`), en la
  // distancia con la que arranca la rueda; los teléfonos de la página son
  // iPhone, así que la nota de Android no se repite aquí.
  'Te avisamos a 1,0 km': ['index.html'],
  'Cambiar': ['index.html'],
  'Localizando tu ubicación…': ['index.html'],
  'Tu ciudad en vivo.': ['index.html', 'empresas.html'],
};

describe('los rótulos de la interfaz son los de la app', () => {
  for (const [frase, archivos] of Object.entries(FRASES)) {
    for (const archivo of archivos) {
      it(`«${frase}» se pinta en ${archivo}`, () => {
        expect(textoPintado(archivo), `${frase} · ${archivo}`).toContain(frase);
      });
    }
  }
});

/**
 * La marca firma con un solo lema. En la app, bajo el logo del arranque y
 * de la bienvenida (`ink_hero.dart`), dice «Tu ciudad en vivo.» (antes «en
 * tiempo real», dueño, 2026-10-27); el
 * pie de las dos páginas, bajo el mismo logo, decía «Tu ruta, cuando
 * importa. Barranquilla se mueve contigo.»: dos lemas para una marca.
 */
describe('el pie firma con el lema de la app', () => {
  for (const pagina of ['index.html', 'empresas.html']) {
    it(pagina, () => {
      const plantilla = document.createElement('template');
      plantilla.innerHTML = leer(pagina);
      const lema = plantilla.content.querySelector('.footer-intro p')?.textContent;
      expect(enUnaLinea(lema ?? '').trim()).toBe('Tu ciudad en vivo.');
    });
  }
});
