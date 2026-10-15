import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { YV_RUTAS } from '../src/data/rutas-landing';
import { WHATSAPP } from '../src/whatsapp';

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
 * La app avisa por distancia: cuando el bus entra a la distancia que eligió
 * el pasajero, de 500 m a 3 km (`distanciasDeAviso` en app_pasajero, dueño
 * 2026-10-06; hasta entonces era un kilómetro fijo). No sabe de paradas
 * ni calcula minutos. La web prometía «antes de que llegue a tu parada», que
 * es otra cosa, y la promesa vive justo donde nadie la relee: la descripción,
 * las tarjetas de compartir y el JSON-LD.
 *
 * Se mira la promesa, no toda la copia. «El bus puede tardar tres minutos o
 * treinta» describe el problema, y las paradas del mockup son dibujo.
 */
describe('la web promete lo que la app hace', () => {
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

  it('index.html promete la distancia que elige el pasajero en los cuatro sitios', () => {
    const avisos = promesas(leer('index.html')).filter((t) => /avisa/i.test(t));
    expect(avisos).toHaveLength(4);
    for (const texto of avisos) {
      expect(texto).toContain('a la distancia que elijas');
      expect(texto).not.toMatch(/\bkm\b|kilómetro/);
    }
  });

  /**
   * El kilómetro fijo vivía también en la copia que se lee: la entrada de
   * «Qué resuelve» y la columna de la espera. Los
   * comentarios sí pueden nombrarlo —las demos arrancan en el kilómetro, que
   * es donde arranca la rueda de la app—, el texto que ve la gente no.
   */
  it('index.html ya no dice que el aviso suena a un kilómetro', () => {
    const visible = leer('index.html').replace(/<!--[\s\S]*?-->/g, '');
    expect(visible).not.toMatch(/a un kilómetro|en el kilómetro|a menos de 1 km/);
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

  it('privacidad.html ya no cuenta a Firebase Authentication entre los apoyos de la app', () => {
    // Desde el 2 de octubre de 2026 Firebase vuelve a la lista, pero solo
    // Cloud Messaging (el aviso de Android con la app cerrada): la cuenta
    // sigue sin existir.
    const apoyos =
      sinComentarios(leer('privacidad.html')).match(/Con quién se apoya la app<\/h2>\s*<ul[\s\S]*?<\/ul>/)?.[0] ?? '';
    expect(apoyos, 'ya no está la lista de apoyos').toContain('OpenStreetMap');
    expect(apoyos).not.toMatch(/authentication|google sign/i);
    expect(apoyos.match(/firebase/gi)).toEqual(['Firebase']);
    expect(apoyos).toContain('<strong>Firebase Cloud Messaging</strong>');
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
    expect(leer('privacidad.html')).toContain('Actualizado el 6 de octubre de 2026');
  });
});

/**
 * Desde el 6 de octubre de 2026 el aviso no suena a un kilómetro sino a la
 * distancia que elige la persona, de 500 m a 3 km, y en Android esa distancia
 * viaja con el punto al servidor. La política lo dice con las mismas frases
 * que `legal_docs.dart` de la app, que vigila `legal_segundo_plano_test.dart`.
 */
describe('la privacidad dice a qué distancia suena el aviso', () => {
  const texto = (): string =>
    leer('privacidad.html')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/\s+/g, ' ');

  it('suena a la distancia que elige la persona', () => {
    const html = texto();
    expect(html).toContain('cuando entra a la distancia que elijas (de 500 metros a 3 kilómetros)');
    expect(html).not.toContain('un kilómetro a la redonda');
  });

  it('dice que la distancia viaja con el punto', () => {
    expect(texto()).toContain(
      'Con él van el bus y la ruta del aviso, la distancia a la que pediste que te avise y el código'
    );
  });
});

/**
 * Los avisos con la app cerrada (D13 del backend, 2 de octubre de 2026). En
 * Android, mientras hay un aviso armado, el punto de espera redondeado y el
 * código de Firebase Cloud Messaging van al servidor. Hasta entonces la
 * política decía que la ubicación no salía nunca del teléfono y que no había
 * push; las dos frases dejaron de ser ciertas y aquí se vigila que no
 * vuelvan. La copia de la app la vigila `test/legal_segundo_plano_test.dart`,
 * que además lee el manifiesto (FCM no arranca solo).
 */
describe('la privacidad dice qué sale del teléfono con un aviso de Android', () => {
  const texto = (): string =>
    leer('privacidad.html')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/\s+/g, ' ');

  it('dice qué sale, cuándo, redondeado y hasta cuándo', () => {
    const html = texto();
    expect(html).toContain('La excepción es el aviso en Android');
    expect(html).toContain('redondeado a unos 100 metros');
    expect(html).toContain('como mucho a las tres horas de armarlo');
    expect(html).toContain('En iPhone tu ubicación no sale del teléfono.');
  });

  it('ya no promete lo que dejó de ser cierto', () => {
    const html = texto();
    expect(html).not.toContain('no usa ningún servicio de mensajería');
    expect(html).not.toContain('<h2>Tu ubicación no sale del teléfono</h2>');
    expect(html).not.toContain('tu ubicación se queda en tu teléfono');
  });
});

/**
 * Ley 1581 de 2012 y Decreto 1377 de 2013: el formulario de empresas recoge
 * datos personales (nombre, empresa y teléfono de quien escribe), así que la
 * política dice quién responde por ellos, para qué se usan, qué derechos hay
 * y en qué plazos se atienden, y el formulario pide la autorización justo
 * donde se dan los datos, con un enlace a esa parte de la política.
 */
// La cédula del responsable no se publica (decisión del dueño): ni la
// palabra, ni «C.C.» delante de un número, ni el número en sus formas
// (seguido, con puntos o con espacios cada tres).
const SEP = String.raw`(?:\.|\s|&nbsp;)`;
const CEDULA = new RegExp(
  [
    String.raw`c[ée]dula`,
    String.raw`\bc\.?\s?c\.?\s?(?:n[oº°]\.?\s?)?\d`,
    String.raw`\b\d{8,10}\b(?![^<]*@)`,
    String.raw`\b\d{1,3}(?:${SEP}\d{3}){2,3}\b`,
  ].join('|'),
  'i',
);

describe('el formulario de empresas cumple lo de la Ley 1581', () => {
  const texto = (pagina: string): string =>
    leer(pagina)
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/\s+/g, ' ');

  it('la privacidad dice qué se recoge y para qué', () => {
    const html = texto('privacidad.html');
    expect(html).toContain('<h2 id="empresas">Si nos escribes como empresa</h2>');
    expect(html).toContain('pide tu nombre, el de tu empresa y un teléfono');
    expect(html).toContain('Esta web no los guarda');
  });

  it('nombra al responsable con domicilio, correo y teléfono, sin cédula', () => {
    const html = texto('privacidad.html');
    expect(html).toContain('Diego Alejandro Angarita Silvera, en Barranquilla, Colombia');
    expect(html).toContain('href="mailto:diegoangarita930@gmail.com"');
    expect(html).toContain('WhatsApp 300 443 8626');
    // Sobre el texto que se lee, no sobre las etiquetas: las coordenadas de
    // un SVG («0 512 512») tienen la forma de un número con espacios.
    expect(html.replace(/<[^>]*>/g, ' ')).not.toMatch(CEDULA);
    expect(html).not.toMatch(/c[ée]dula/i);
  });

  it('la guarda de la cédula ve las formas en que se escribe', () => {
    // Verificación 2026-09-29: la guarda solo veía los dígitos seguidos, y
    // una cédula se escribe casi siempre con puntos. El teléfono y el año
    // de la política tienen que seguir pasando.
    for (const colada of [
      'C.C. 1.045.678.901',
      'CC 1045678901',
      'c. c. no. 72.345.678',
      'identificado con 1 045 678 901',
      '1&nbsp;045&nbsp;678&nbsp;901',
      '1045678901',
      'cédula',
    ]) {
      expect(colada, colada).toMatch(CEDULA);
    }
    for (const limpia of ['WhatsApp 300 443 8626', 'Ley 1581 de 2012', 'Decreto 1377 de 2013', '2 de octubre de 2026']) {
      expect(limpia, limpia).not.toMatch(CEDULA);
    }
  });

  it('cuenta los derechos y los plazos de la ley', () => {
    const html = texto('privacidad.html');
    expect(html).toContain('Ley 1581 de 2012');
    expect(html).toMatch(/corrijamos o los borremos y retirar el permiso/);
    expect(html).toContain('máximo 10 días hábiles');
    expect(html).toContain('en máximo 15');
    expect(html).toContain('Superintendencia de Industria y Comercio');
  });

  it('el formulario pide la autorización y enlaza a la política', () => {
    const form = texto('empresas.html').match(/<form id="contact-form"[\s\S]*?<\/form>/)?.[0] ?? '';
    expect(form, 'ya no está el formulario').toContain('form-submit-btn');
    const nota = form.match(/<p class="form-autoriza">[\s\S]*?<\/p>/)?.[0] ?? '';
    expect(nota, 'el formulario no pide la autorización').toContain('usted autoriza');
    expect(nota).toContain('href="/privacidad.html#empresas"');
    expect(form.indexOf('form-autoriza')).toBeGreaterThan(form.indexOf('form-submit-btn'));
  });
});
