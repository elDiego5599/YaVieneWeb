/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs';

import { defineConfig, type Plugin } from 'vite';
import { coverageConfigDefaults } from 'vitest/config';

/*
  Las tres piezas que un buscador espera encontrar en la raíz —`robots.txt`,
  `sitemap.xml` y las URL absolutas de las etiquetas sociales— dependen todas
  del mismo dato: el dominio. Escribirlas a mano en `public/` significaría
  tener el dominio repetido en cuatro sitios y olvidarse de uno el día que
  cambie, así que se generan en la construcción a partir de `VITE_SITE_URL`,
  que es la única fuente.

  Con la variable vacía —que es como está mientras no haya dominio— no se
  emite ninguno de los dos ficheros. Es a propósito: un `sitemap.xml` con
  rutas relativas es inválido para el protocolo, y un `robots.txt` que
  apunta a un sitemap que no resuelve es peor que no tenerlo.
*/
const PAGINAS = ['/', '/empresas.html', '/privacidad.html', '/terminos.html'];

// Se exporta para que `tests/csp-contacto.test.ts` pueda pedirle el candado
// del `connect-src` sin construir la web entera. El plugin se sigue montando
// abajo igual; la exportación no cambia lo que corre en la construcción.
export function seoDeRaiz(): Plugin {
  let sitio = '';

  return {
    name: 'yaviene-seo-raiz',
    apply: 'build',

    /*
      El canonical no se escribe en el HTML con `%VITE_SITE_URL%`, se escribe
      aquí. Motivo: Vite trata el `href` de un `<link>` como un recurso, y con
      la variable vacía `%VITE_SITE_URL%/empresas.html` queda en la ruta
      relativa `/empresas.html` — que existe —, así que la copia a /assets con
      hash y apunta la etiqueta a la copia. Escrito desde el plugin, o es una
      URL absoluta (que Vite no toca) o no está: un canonical sin dominio no
      le sirve a nadie.
    */
    transformIndexHtml: {
      order: 'pre',
      handler(original, ctx) {
        /*
          `%VITE_SITE_URL%` se sustituye aquí, antes que Vite, con el valor
          ya sin barra final. Vite lo pone tal cual: con `https://sitio.co/`
          el og:image y el JSON-LD salían con la barra doblada, y si la
          variable no existe —una construcción sin `.env`— dejaba el texto
          `%VITE_SITE_URL%` literal en las etiquetas publicadas.
        */
        const html = original.replaceAll('%VITE_SITE_URL%', sitio);
        const ruta = ctx.path === '/index.html' ? '/' : ctx.path;
        const etiqueta = /[^\S\n]*<link rel="canonical"[^>]*>\n?/;
        if (!etiqueta.test(html)) return html;
        return html.replace(
          etiqueta,
          sitio ? `  <link rel="canonical" href="${sitio}${ruta}" />\n` : ''
        );
      }
    },

    configResolved(config) {
      // `config.env` ya trae las VITE_* cargadas del `.env`, así que no hace
      // falta leer el fichero ni arrastrar los tipos de Node para ello.
      sitio = String(config.env.VITE_SITE_URL ?? '').replace(/\/+$/, '');

      /*
        El hero carga sus videos locales, por eso `media-src 'self'` permite
        únicamente archivos servidos desde este sitio.

        El `connect-src 'self'` de vercel.json bloquea cualquier fetch a otro
        origen, y el formulario manda a VITE_CONTACT_ENDPOINT. Con la variable
        vacía —como está hoy— no pasa nada, porque el formulario se va por
        WhatsApp. El día que se configure un endpoint externo, el navegador
        cortaría el envío en producción y el fallo se vería con una empresa
        real escribiendo. Mejor que reviente aquí, con el arreglo al lado.
      */
      const endpoint = String(config.env.VITE_CONTACT_ENDPOINT ?? '').trim();
      if (endpoint && !endpoint.startsWith('/')) {
        let origen: string;
        try {
          origen = new URL(endpoint).origin;
        } catch {
          throw new Error(
            `VITE_CONTACT_ENDPOINT no es una URL válida ni una ruta relativa: ${endpoint}`
          );
        }
        const csp = String(
          JSON.parse(readFileSync(new URL('./vercel.json', import.meta.url), 'utf8'))
            .headers?.[0]?.headers?.find(
              (h: { key: string }) => h.key === 'Content-Security-Policy'
            )?.value ?? ''
        );
        const conectar = csp.match(/connect-src ([^;]*)/)?.[1] ?? '';
        if (!conectar.includes(origen)) {
          throw new Error(
            `VITE_CONTACT_ENDPOINT apunta a ${origen}, que el CSP de vercel.json ` +
              `no permite (connect-src ${conectar.trim()}). Añade ${origen} a ` +
              'connect-src o el navegador bloqueará el formulario en producción.'
          );
        }
      }
    },

    generateBundle() {
      if (!sitio) {
        this.warn(
          'VITE_SITE_URL está vacía: no se generan robots.txt ni sitemap.xml, ' +
            'las etiquetas og: quedan en rutas relativas y el canonical no se escribe. ' +
            'Rellénala en .env antes de publicar.'
        );
        return;
      }

      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source:
          'User-agent: *\n' +
          'Allow: /\n' +
          '\n' +
          `Sitemap: ${sitio}/sitemap.xml\n`
      });

      const urls = PAGINAS.map(
        (ruta) =>
          '  <url>\n' +
          `    <loc>${sitio}${ruta}</loc>\n` +
          `    <changefreq>${ruta === '/' ? 'weekly' : 'yearly'}</changefreq>\n` +
          `    <priority>${ruta === '/' ? '1.0' : '0.3'}</priority>\n` +
          '  </url>'
      ).join('\n');

      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source:
          '<?xml version="1.0" encoding="UTF-8"?>\n' +
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
          urls +
          '\n</urlset>\n'
      });
    }
  };
}

/*
  El parpadeo de la recarga, y sólo en `vite dev`.

  En la página construida el CSS va en tres `<link>` dentro del `<head>`:
  el navegador no pinta nada hasta tenerlos, así que no hay parpadeo. En
  desarrollo no hay `<link>` ninguno —Vite sirve los módulos sin
  empaquetar y las hojas las inyecta `main.ts` en cuanto se ejecuta—, así
  que entre el primer pintado y esa inyección hay unos milisegundos con
  el HTML desnudo: los SVG sin medidas se van al ancho de su contenedor
  (de ahí el «icono gigante»), los teléfonos se apilan y el pie sale
  arriba. Es un artefacto del servidor de desarrollo, no un fallo de la
  página, pero se ve en cada F5 y desconcierta.

  Se tapa como se tapa esto: el documento sale escondido y se enseña
  cuando los módulos ya corrieron. Va aquí y no en el HTML a propósito
  —`apply: 'serve'`—, para que no cueste ni un byte en producción ni
  retrase el primer pintado de verdad. Y lleva un plazo de gracia: si
  `main.ts` reventara, a los tres segundos la página aparece igual, con
  su error a la vista y no en negro.
*/
const GUARDA = `
  <!-- Inyectado por vite.config.ts. Sólo en desarrollo. -->
  <style>html.yv-sin-css body { visibility: hidden; }</style>
  <script>
    (function () {
      var raiz = document.documentElement;
      raiz.classList.add('yv-sin-css');
      var listo = function () { raiz.classList.remove('yv-sin-css'); };
      addEventListener('DOMContentLoaded', function () { requestAnimationFrame(listo); });
      setTimeout(listo, 3000);
    })();
  </script>
`;

function sinParpadeo(): Plugin {
  return {
    name: 'yaviene-sin-parpadeo',
    apply: 'serve',
    transformIndexHtml: {
      order: 'pre',
      /*
        Después del `charset`, no antes: la codificación tiene que caber
        en el primer kilobyte del documento y no se le adelanta nada.
      */
      handler: (html) =>
        html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />${GUARDA}`)
    }
  };
}

export default defineConfig({
  // La landing se sirve desde la raíz del dominio.
  base: '/',
  plugins: [seoDeRaiz(), sinParpadeo()],
  // Los tests de humo montan el formulario real: necesitan un DOM.
  test: {
    environment: 'happy-dom',
    // happy-dom no baja CSS: sin esto, cada <link> de las páginas que una
    // prueba carga deja un error en la consola (AUD29-30) y tapa los de
    // verdad. Una hoja no bajada cuenta como cargada.
    environmentOptions: {
      happyDOM: { settings: { handleDisabledFileLoadingAsSuccess: true } },
    },
    // Sólo los de humo: e2e/ es de Playwright y Vitest se atraganta con su
    // `test.describe` al recogerlo.
    include: ['tests/**/*.test.ts'],
    /*
      Trinquete de cobertura (T8.7). Los umbrales son la cobertura del día
      que se puso, redondeada hacia abajo, y sólo suben: quien los baje tiene
      que decir en el commit por qué.

      Mide los módulos que las pruebas de Vitest tocan, no todo `src/`. Con
      `all: true` el número sale en 10 %, porque la mayor parte de la landing
      es código de navegador —animaciones, mapa, simulador del teléfono— que
      se prueba con Playwright, no aquí; un trinquete en 10 % no frena nada.

      **Hueco declarado**: así, un módulo nuevo sin pruebas no baja el
      número, porque no entra en la cuenta. Lo que este trinquete cuida es
      que no se destape lo que ya está probado.
    */
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      // El trinquete mide el sitio; scripts/ entraría solo porque una prueba
      // importa la lista de la prueba de fuego.
      exclude: [...coverageConfigDefaults.exclude, 'scripts/**'],
      thresholds: {
        statements: 98,
        branches: 90,
        functions: 100,
        lines: 99,
      },
    },
  },
  build: {
    outDir: 'dist',
    /*
      Nada en línea. El mosaico de Barranquilla pesa ~160 KB y como data URI
      dejaría de cachearse aparte, pero el motivo de bajar el límite a cero
      es otro: la CSP de vercel.json dice `img-src 'self'` y un data URI no
      es 'self'. Con el límite por defecto de 4096 el empaquetador metía en
      línea los dos logos más ligeros de la banda de empresas —Transmetro y
      Tras Alfa— y en producción salían bloqueados y no se veían. La prueba
      «aguanta la política de contenido de producción» de e2e/paginas.spec.ts
      lo caza, y así se cazó.

      Se prefiere esto a añadir `data:` a la política: la landing no necesita
      ni un solo data URI, y abrir la puerta por dos ficheros de 3 KB es
      cambiar seguridad por nada. De paso el HTML adelgaza, que base64 abulta
      un tercio más que el binario.
    */
    assetsInlineLimit: 0,
    target: 'es2022',
    rollupOptions: {
      // Tres páginas, no una: los enlaces de «Términos» y «Privacidad» del
      // pie apuntan a documentos de verdad, y si no se declaran aquí el
      // empaquetador sólo construye la portada.
      // Rutas relativas a la raíz del proyecto: así no hace falta
      // arrastrar los tipos de Node sólo para resolver unos nombres.
      input: {
        index: 'index.html',
        empresas: 'empresas.html',
        404: '404.html',
        privacidad: 'privacidad.html',
        terminos: 'terminos.html'
      }
    }
  },
  server: {
    port: 8091,
    open: false
  }
  // Sin `preview.allowedHosts`: la vista previa sólo contesta a localhost.
  // Abría `*.trycloudflare.com` para túneles que el proyecto ya no usa; ver
  // tests/vista-previa.test.ts.
});
