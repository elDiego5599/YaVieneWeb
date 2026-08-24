import { defineConfig } from 'vite';

export default defineConfig({
  // La landing se sirve desde la raíz del dominio.
  base: '/',
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
