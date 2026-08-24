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
const PAGINAS = ['/', '/privacidad.html', '/terminos.html'];

function seoDeRaiz(): Plugin {
  let sitio = '';

  return {
    name: 'yaviene-seo-raiz',
    apply: 'build',

    configResolved(config) {
      // `config.env` ya trae las VITE_* cargadas del `.env`, así que no hace
      // falta leer el fichero ni arrastrar los tipos de Node para ello.
      sitio = String(config.env.VITE_SITE_URL ?? '').replace(/\/+$/, '');
    },

    generateBundle() {
      if (!sitio) {
        this.warn(
          'VITE_SITE_URL está vacía: no se generan robots.txt ni sitemap.xml, ' +
            'y las etiquetas og:/canonical quedan en rutas relativas. ' +
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

export default defineConfig({
  // La landing se sirve desde la raíz del dominio.
  base: '/',
  plugins: [seoDeRaiz()],
  // Los tests de humo montan el formulario real: necesitan un DOM.
  test: {
    environment: 'happy-dom',
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
      // arrastrar los tipos de Node sólo para resolver tres nombres.
      input: {
        index: 'index.html',
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
});
