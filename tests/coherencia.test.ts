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
});

/**
 * La app avisa por distancia: cuando el bus entra a 1 km de donde está el
 * pasajero (`alertRadiusMeters = 1000` en app_pasajero). No sabe de paradas
 * ni calcula minutos. La web prometía «antes de que llegue a tu parada», que
 * es otra cosa, y la promesa vive justo donde nadie la relee: la descripción,
 * las tarjetas de compartir y el JSON-LD.
 *
 * Se mira la promesa, no toda la copia. «El bus puede tardar tres minutos o
 * treinta» describe el problema, y las paradas del mockup son dibujo.
 */
describe('la web promete lo que la app hace', () => {
  const RADIO_KM = 1;
  const promesas = (html: string): string[] => [
    ...Array.from(
      html.matchAll(/<meta\s+(?:name|property)="(?:description|og:description|twitter:description)"\s+content="([^"]*)"/g),
      (m) => m[1]
    ),
    ...Array.from(html.matchAll(/"description":\s*"([^"]*)"/g), (m) => m[1]),
  ];

  for (const pagina of PAGINAS) {
    it(`${pagina} no promete parada ni minutos`, () => {
      const html = leer(pagina);
      expect(html).not.toMatch(/tu parada|su parada|antes de que llegue/i);
      for (const texto of promesas(html)) {
        expect(texto, texto).not.toMatch(/parada|minuto|\bmin\b/i);
      }
    });
  }

  it('index.html promete el radio de la app en los cuatro sitios', () => {
    const avisos = promesas(leer('index.html')).filter((t) => /avisa/i.test(t));
    expect(avisos).toHaveLength(4);
    for (const texto of avisos) {
      expect(texto).toContain(`a menos de ${RADIO_KM} km`);
    }
  });
});
