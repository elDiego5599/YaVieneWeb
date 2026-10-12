import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * El teléfono se veía «super alejado» en Safari de iPhone:
 * la isla y la rayita de inicio en dos tercios de su tamaño, dentro de un
 * aparato del tamaño correcto. En el hero, perfecto.
 *
 * La causa era un `zoom` en la escena: en
 * WebKit una unidad de contenedor dentro de un elemento con `zoom` recibe
 * el zoom dos veces —medido en el simulador con `zoom: .7`, `50cqw` de una
 * caja de 300 px da 73,5 px y no 105—. La carcasa, medida en píxeles, se
 * encogía una vez; la pantalla, en `cqw`, dos. Chromium lo hace bien, así
 * que Playwright no lo ve.
 *
 * Por eso lo que vive dentro del teléfono no usa unidades de contenedor:
 * `--u` sale de la misma cuenta en píxeles que la carcasa.
 */
const css = (ruta: string): string => readFileSync(resolve(__dirname, '..', ruta), 'utf8');

/** Quita los comentarios, que sí hablan de `cqw`. */
const sinComentarios = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '');

const CQ = /\d(?:cqw|cqh|cqi|cqb|cqmin|cqmax)\b|container-type|@container/;

describe('la pantalla del teléfono no depende de unidades de contenedor', () => {
  it.each(['src/css/phone-simulator.css'])('%s', (ruta) => {
    expect(sinComentarios(css(ruta))).not.toMatch(CQ);
  });

  it('`--u` es el ancho de la pantalla —el de la carcasa menos los dos biseles— entre 402', () => {
    const regla = /\.phone-screen\s*\{([^}]*)\}/.exec(sinComentarios(css('src/css/phone-simulator.css')));
    expect(regla?.[1]).toMatch(/--u:\s*calc\(\(var\(--ancho\) - 2 \* var\(--bisel\)\) \/ 402\);/);
  });
});
