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

  /**
   * En iPhone el aviso solo suena con la app abierta: la app no declara
   * `UIBackgroundModes` y no hay push. La pantalla de avisos de la app lo
   * dice con esta frase, y el paso del aviso de la web, con la misma.
   */
  it('index.html dice en el paso del aviso que en iPhone suena con la app abierta', () => {
    const paso = leer('index.html').match(/data-paso-boton="2"[\s\S]*?<\/button>/)?.[0] ?? '';
    expect(paso, 'ya no está el paso del aviso').toContain('Te avisamos');
    expect(paso).toContain('En iPhone el aviso suena con la app abierta.');
  });
});

/**
 * Desde T6.9 (decisión D3) el pasajero no tiene cuenta: la app no pide
 * correo ni contraseña, no tiene «Cerrar sesión» y no usa Firebase. Las
 * páginas legales describían esa cuenta en varios sitios —qué guarda, cómo
 * se borra, la contraseña, Firebase entre los apoyos— y un aviso legal que
 * describe lo que la app ya no hace engaña igual que uno que se calla.
 *
 * Quien creó una cuenta en una versión anterior sí puede leer sobre ella:
 * por eso se mira el texto que describe la app de hoy (títulos, la lista de
 * apoyos, la contraseña, la sesión), no cada vez que sale la palabra.
 */
describe('lo legal no describe una cuenta que la app ya no tiene', () => {
  const sinComentarios = (html: string): string => html.replace(/<!--[\s\S]*?-->/g, '');

  for (const pagina of ['privacidad.html', 'terminos.html']) {
    it(`${pagina} no habla de contraseña, de sesión ni de «tu cuenta» en un título`, () => {
      const html = sinComentarios(leer(pagina));
      expect(html).not.toMatch(/contraseña|sesión/i);
      const titulos = Array.from(html.matchAll(/<h2>([^<]*)<\/h2>/g), (m) => m[1]);
      expect(titulos.length, 'la página ya no tiene títulos').toBeGreaterThan(0);
      expect(titulos.filter((t) => /cuenta/i.test(t))).toEqual([]);
    });
  }

  it('privacidad.html ya no cuenta a Firebase entre los apoyos de la app', () => {
    const apoyos =
      sinComentarios(leer('privacidad.html')).match(/Con quién se apoya la app<\/h2>\s*<ul[\s\S]*?<\/ul>/)?.[0] ?? '';
    expect(apoyos, 'ya no está la lista de apoyos').toContain('OpenStreetMap');
    expect(apoyos).not.toMatch(/firebase/i);
  });
});

/**
 * Lo que pasa cuando el pasajero sale de la app (T5.5, paso 3).
 *
 * En Android la app arranca un servicio en primer plano para que el socket no
 * muera al salir de ella, y eso le deja al usuario una notificación fija. Lo
 * que ese servicio **no** hace es seguir leyendo el GPS: la app pide «solo
 * mientras la uso» y no declara `ACCESS_BACKGROUND_LOCATION`, así que la
 * distancia se mide contra el último punto conocido o contra el punto de
 * espera marcado a mano.
 *
 * La política publicada no lo decía, y callarlo tiene dos caras malas: quien
 * cierra la app cree que lo sigue midiendo en vivo, y quien ve la notificación
 * fija cree que la app le está siguiendo el rastro. La copia de la app
 * (`legal_docs.dart` en el repo de Flutter) dice ahora lo mismo; allí la
 * vigila `test/legal_segundo_plano_test.dart`, y el permiso que haría falsa
 * la frase lo vigila esa prueba leyendo el manifiesto.
 */
describe('la privacidad dice qué pasa con la app cerrada', () => {
  const texto = (): string =>
    leer('privacidad.html')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/\s+/g, ' ');

  it('dice que la ubicación deja de actualizarse y contra qué se mide', () => {
    const html = texto();
    expect(html).toContain('solo mientras la uso');
    expect(html).toContain('no el de segundo plano');
    expect(html).toContain('la distancia se mide contra el último punto que conoció');
  });

  it('nombra la notificación fija de Android y el caso del iPhone', () => {
    const html = texto();
    expect(html).toContain('notificación fija');
    expect(html).toContain('En iPhone el aviso solo suena con la app abierta.');
  });

  it('dice que cerrar la app del todo detiene el seguimiento', () => {
    // Desde la auditoría 2026-09 (H1 de la app) el servicio de Android solo
    // vive con un aviso armado y muere al cerrar la app desde recientes.
    const html = texto();
    expect(html).toContain('sin cerrarla y tienes un aviso activo');
    expect(html).toContain('Si cierras la app del todo, el seguimiento se detiene');
    expect(html).not.toContain('aunque cierres la app');
  });

  it('la fecha del documento acompaña al cambio', () => {
    // Un texto legal que cambia sin cambiar su fecha no se distingue del
    // anterior, y la app usa la misma fecha para decir cuál está leyendo.
    expect(leer('privacidad.html')).toContain('Actualizado el 29 de septiembre de 2026');
  });
});
