import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { YV_RUTAS } from '../src/data/rutas-landing';
import { WHATSAPP } from '../src/contact-form';

/**
 * Los datos del mapa se regeneran solos (`npm run mapa`) desde el repo de
 * la app. La copia de la landing, no: «seis rutas», «diez terminales» y el
 * WhatsApp están escritos a mano, repartidos entre dos páginas y metidos
 * también en las etiquetas de compartir, que es donde nadie mira.
 *
 * El día que Sobusa abra una ruta, los datos dirán siete y la página
 * seguirá diciendo seis en diez sitios distintos. Esto lo caza ese día.
 */

// Desde la raíz del proyecto, que es donde vitest se planta. `import.meta`
// aquí dentro apunta al documento que monta happy-dom, no al fichero.
const leer = (nombre: string): string =>
  readFileSync(resolve(process.cwd(), nombre), 'utf8');

const PAGINAS = ['index.html', 'empresas.html'];

/** Los números como se escriben en la copia, no como los cuenta la máquina. */
const EN_LETRA: Record<number, string> = {
  1: 'una', 2: 'dos', 3: 'tres', 4: 'cuatro', 5: 'cinco', 6: 'seis',
  7: 'siete', 8: 'ocho', 9: 'nueve', 10: 'diez', 11: 'once', 12: 'doce',
};

/** Toda cantidad que la copia le atribuye a `sustantivo`, en cifra o en letra. */
function cantidadesDe(html: string, sustantivo: string): string[] {
  const cifras = String.raw`\d+`;
  const letras = Object.values(EN_LETRA).join('|');
  const patron = new RegExp(`\\b(${cifras}|${letras})\\s+${sustantivo}\\b`, 'gi');
  return Array.from(html.matchAll(patron), (m) => m[1].toLowerCase());
}

describe('la copia dice lo mismo que los datos', () => {
  const rutas = YV_RUTAS.rutas.length;
  const terminales = new Set(YV_RUTAS.rutas.flatMap((r) => [r.terminalA, r.terminalB])).size;

  for (const pagina of PAGINAS) {
    it(`${pagina} cuenta bien las rutas`, () => {
      const dichas = cantidadesDe(leer(pagina), 'rutas');
      expect(dichas.length, 'la página ya no habla de rutas').toBeGreaterThan(0);
      const validas = [String(rutas), EN_LETRA[rutas]];
      expect(dichas.filter((d) => !validas.includes(d))).toEqual([]);
    });

    it(`${pagina} cuenta bien las terminales`, () => {
      const dichas = cantidadesDe(leer(pagina), 'terminales');
      const validas = [String(terminales), EN_LETRA[terminales]];
      expect(dichas.filter((d) => !validas.includes(d))).toEqual([]);
    });

    it(`${pagina} manda al WhatsApp de verdad`, () => {
      const enlaces = Array.from(leer(pagina).matchAll(/wa\.me\/(\d+)/g), (m) => m[1]);
      expect(enlaces.length, 'la página ya no enlaza a WhatsApp').toBeGreaterThan(0);
      expect(enlaces.filter((n) => n !== WHATSAPP)).toEqual([]);
    });
  }

  /*
    Las tres cifras de cabecera de la portada están escritas en el HTML
    para que la sección no salga vacía si el guion no llega, y `rutas.ts`
    las recalcula de estos mismos datos al arrancar. Son dos copias del
    mismo número, y dos copias se separan: la escrita se queda quieta el
    día que entre una ruta más, y entonces la página diría una cosa antes
    de cargar y otra después. Esto lo caza ese día.
  */
  it('index.html trae escritas las mismas cifras que calcula el guion', () => {
    const km = YV_RUTAS.rutas.reduce((suma, r) => suma + r.km, 0);
    const esperadas = [
      [String(rutas), 'rutas'],
      [String(terminales), 'terminales'],
      [String(Number(km.toFixed(1))).replace('.', ','), 'kilómetros'],
    ];

    const html = leer('index.html');
    const bloque = html.match(/<div class="rutas-cifras[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/);
    expect(bloque, 'ya no hay bloque de cifras en la portada').not.toBeNull();

    const escritas = Array.from(
      bloque![0].matchAll(
        /<strong class="rutas-dato-numero[^"]*">([^<]+)<\/strong><span class="rutas-dato-rotulo">([^<]+)<\/span>/g
      ),
      (m) => [m[1], m[2]]
    );

    expect(escritas).toEqual(esperadas);
  });

  /*
    La tabla de «Cobertura hoy» está escrita renglón a renglón para que la
    sección se lea aunque el guion no llegue, y por eso es la copia que más
    fácil se separa de los datos: son veinticuatro celdas a mano. Aquí se
    comparan todas, en orden, contra `rutas.json`.
  */
  it('index.html trae la tabla de cobertura tal como está en los datos', () => {
    const html = leer('index.html');
    const cuerpo = html.match(/<tbody>([\s\S]*?)<\/tbody>/);
    expect(cuerpo, 'ya no hay tabla de cobertura en la portada').not.toBeNull();

    const escritas = Array.from(
      cuerpo![1].matchAll(
        /<td class="cobertura-codigo">([^<]*)<\/td>\s*<th scope="row" class="cobertura-ruta">([^<]*)<\/th>\s*<td class="cobertura-recorrido"><span>([^<]*)<\/span><span class="cobertura-flecha" aria-hidden="true">[^<]*<\/span><span>([^<]*)<\/span><\/td>\s*<td class="cobertura-km">([^<]*)<\/td>/g
      ),
      (m) => m.slice(1, 6)
    );

    const esperadas = YV_RUTAS.rutas.map((r) => [
      r.id,
      r.nombre,
      r.terminalA,
      r.terminalB,
      String(r.km).replace('.', ','),
    ]);

    expect(escritas).toEqual(esperadas);
  });
});
