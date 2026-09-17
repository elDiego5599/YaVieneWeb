import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Las dos familias se sirven desde el propio dominio, troceadas en
 * subconjuntos como las servía Google: `latin` y `latin-ext`. El navegador
 * sólo se baja el trozo que necesita —cada `@font-face` declara qué letras
 * cubre—, así que el `latin-ext` de las dos no se descargaba nunca: la
 * página está en español y el español entero cabe en `latin`.
 *
 * No descargarse no es no pesar. Los dos ficheros se empaquetaban igual y
 * ocupaban 51 KB de los 797 del presupuesto, que es el que decide si la
 * integración continua deja pasar un cambio.
 *
 * La primera prueba es la que manda: mide si de verdad no hace falta. Si
 * algún día la copia trae una letra que sólo vive en `latin-ext` —un
 * apellido con ă, un precio en zł—, falla y dice cuál, y entonces hay que
 * volver a traer el subconjunto de esa familia antes que nada, porque sin
 * él esa letra se pinta con la tipografía del sistema y desentona. La
 * segunda es la consecuencia: mientras la primera esté en verde, en
 * `src/assets/fonts/` no hay más que los dos `latin`.
 */

const raiz = (...partes: string[]): string => resolve(process.cwd(), ...partes);

/** Los rangos que cubría el `latin-ext` de Google, tal cual los declaraba. */
const LATIN_EXT: [number, number][] = [
  [0x0100, 0x02ba], [0x02bd, 0x02c5], [0x02c7, 0x02cc], [0x02ce, 0x02d7],
  [0x02dd, 0x02ff], [0x0304, 0x0304], [0x0308, 0x0308], [0x0329, 0x0329],
  [0x1d00, 0x1dbf], [0x1e00, 0x1e9f], [0x1ef2, 0x1eff], [0x2020, 0x2020],
  [0x20a0, 0x20ab], [0x20ad, 0x20c0], [0x2113, 0x2113], [0x2c60, 0x2c7f],
  [0xa720, 0xa7ff],
];

const esLatinExt = (letra: string): boolean => {
  const punto = letra.codePointAt(0) ?? 0;
  return LATIN_EXT.some(([desde, hasta]) => punto >= desde && punto <= hasta);
};

/** Todo lo que puede acabar escrito en pantalla: las páginas y las fuentes
 *  de las que salen sus textos. Se mira el código y no `dist/` para que la
 *  prueba avise al escribir la letra, no al construir. */
const EXTENSIONES = ['.html', '.ts', '.css', '.json', '.svg'];

function ficheros(dir: string): string[] {
  const salida: string[] = [];
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) salida.push(...ficheros(ruta));
    else if (EXTENSIONES.some((e) => nombre.endsWith(e))) salida.push(ruta);
  }
  return salida;
}

describe('las tipografías que se empaquetan son las que se usan', () => {
  it('no hay una sola letra que pida el subconjunto latin-ext', () => {
    const paginas = ['index.html', 'empresas.html', 'privacidad.html',
      'terminos.html', '404.html'].map((p) => raiz(p));
    const fuera: string[] = [];

    for (const ruta of [...paginas, ...ficheros(raiz('src'))]) {
      const texto = readFileSync(ruta, 'utf8');
      for (const letra of new Set(texto)) {
        if (!esLatinExt(letra)) continue;
        const punto = (letra.codePointAt(0) ?? 0).toString(16).toUpperCase();
        fuera.push(`${ruta.replace(process.cwd() + '/', '')}: «${letra}» (U+${punto})`);
      }
    }

    expect(fuera).toEqual([]);
  });

  it('en la carpeta de fuentes sólo están los dos latin', () => {
    const carpeta = raiz('src/assets/fonts');
    const woff2 = readdirSync(carpeta).filter((n) => n.endsWith('.woff2')).sort();

    expect(woff2).toEqual([
      'bricolage-grotesque-latin.woff2',
      'plus-jakarta-sans-latin.woff2',
    ]);

    // Y la hoja declara uno por familia: un `@font-face` que apunte a un
    // fichero que no está deja el texto en la tipografía del sistema.
    const hoja = readFileSync(raiz('src/css/fonts.css'), 'utf8');
    const declarados = Array.from(hoja.matchAll(/url\('([^']+)'\)/g), (m) =>
      m[1].split('/').pop()
    ).sort();

    expect(declarados).toEqual(woff2);
  });
});
