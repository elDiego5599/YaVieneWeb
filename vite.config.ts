import { defineConfig } from 'vite';

export default defineConfig({
  // La landing se sirve desde la raíz del dominio.
  base: '/',
  build: {
    outDir: 'dist',
    // El mosaico de Barranquilla pesa ~160 KB. Si se inline como data URI
    // deja de cachearse aparte y engorda el HTML en cada visita.
    assetsInlineLimit: 4096,
    target: 'es2022'
  },
  server: {
    port: 8091,
    open: false
  }
});
