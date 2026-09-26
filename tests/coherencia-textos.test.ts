import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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

/** frase → archivos de la web donde la frase tiene que estar. */
const FRASES: Record<string, string[]> = {
  '¿Qué bus esperas?': ['index.html'],
  'Toca para buscar tu ruta': ['index.html'],
  'Ruta activa': ['src/phone-simulator.ts'],
  'Elige tu ruta': ['index.html'],
  'Elige empresa': ['index.html'],
  'Elegir empresa': ['index.html'],
  'Elige ruta': ['index.html'],
  'Cuál esperas': ['index.html', 'src/selector.ts'],
  'Con cuál viajas': ['index.html', 'src/selector.ts'],
  'Empresa de transporte masivo': ['index.html', 'src/selector.ts'],
  'Ver buses en vivo': ['index.html'],
  'Dos pasos y ves los buses moviéndose.': ['index.html'],
  'Avisarme cuando esté cerca': ['index.html', 'src/paso-demo.ts'],
  'Aviso activado': ['index.html', 'src/phone-simulator.ts'],
  'Toca el mapa para indicar dónde estás': ['index.html'],
  'Puedes cambiar de aplicación; no cierres Ya Viene del todo': ['index.html'],
  'Localizando tu ubicación…': ['index.html', 'src/paso-demo.ts'],
  'Arrástralo para moverlo': ['index.html', 'src/paso-demo.ts'],
  'Fija tu punto de espera': ['index.html'],
  'Tu ciudad en tiempo real.': ['index.html'],
};

describe('los rótulos de la interfaz son los de la app', () => {
  for (const [frase, archivos] of Object.entries(FRASES)) {
    for (const archivo of archivos) {
      it(`«${frase}» sigue en ${archivo}`, () => {
        expect(enUnaLinea(leer(archivo)), `${frase} · ${archivo}`).toContain(
          frase
        );
      });
    }
  }
});
