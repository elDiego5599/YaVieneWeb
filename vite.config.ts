/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';

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

function seoDeRaiz(): Plugin {
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
      handler(html, ctx) {
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
    // Sólo los de humo: e2e/ es de Playwright y Vitest se atraganta con su
    // `test.describe` al recogerlo.
    include: ['tests/**/*.test.ts'],
  },
  build: {
    outDir: 'dist',
    // El mosaico de Barranquilla pesa ~160 KB. Si se inline como data URI
    // deja de cachearse aparte y engorda el HTML en cada visita.
    assetsInlineLimit: 4096,
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
  },
  // Las demos sin deploy pasan por túneles de Cloudflare. Sin esto, el
  // preview responde 403 a cualquier Host que no sea localhost (la
  // protección anti DNS-rebinding de Vite). El punto inicial cubre los
  // subdominios aleatorios que genera cada túnel efímero.
  preview: {
    allowedHosts: ['.trycloudflare.com']
  }
});
