/**
 * Pinta el mapa base de la landing con el estilo vectorial de la app y lo
 * guarda en PNG. Lo llama gen_mapa_landing.py; a mano no hace falta.
 *
 * Por qué así y no bajando teselas: CARTO dejó de servir las raster de
 * Voyager sin clave —cada tesela sale con «API KEY REQUIRED» impreso
 * encima—, y el estilo vectorial es además lo que de verdad dibuja
 * app_pasajero: MapLibre sobre voyager-gl-style, con los edificios y con
 * los rótulos al tamaño de la pantalla, no los de una imagen z13 que al
 * acercarse salían enormes. Aquí lo dibuja MapLibre GL JS en un Chromium
 * sin ventana, que es el mismo motor con otra envoltura.
 *
 * Uso: node scripts/render_mapa.mjs <lon> <lat> <zoom> <ancho> <alto> <dpr> <salida.png>
 */
import { chromium } from '@playwright/test';

const [lon, lat, zoom, ancho, alto, dpr, salida] = process.argv.slice(2);
if (!salida) {
  console.error('uso: node scripts/render_mapa.mjs <lon> <lat> <zoom> <ancho> <alto> <dpr> <salida.png>');
  process.exit(2);
}

// El mismo estilo que map_widget.dart.
const ESTILO = 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';
// Versión fija: una nueva podría pintar distinto y el mapa cambiaría solo.
const MAPLIBRE = 'https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl';

// Sin GPU a mano, SwiftShader hace de WebGL por software.
const navegador = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
});

try {
  const pagina = await navegador.newPage({
    viewport: { width: Number(ancho), height: Number(alto) },
    deviceScaleFactor: Number(dpr)
  });
  const errores = [];
  pagina.on('pageerror', e => errores.push(e.message));

  // Sin atribución dibujada —la landing la pone en texto— y sin fundidos,
  // para que la captura no pille un rótulo a medio aparecer. `idle` llega
  // cuando no queda tesela por cargar ni nada por pintar.
  await pagina.setContent(`<!doctype html><html><head>
<link rel="stylesheet" href="${MAPLIBRE}.css">
<script src="${MAPLIBRE}.js"></script>
<style>html, body, #mapa { margin: 0; width: 100%; height: 100%; }</style>
</head><body><div id="mapa"></div><script>
  window.listo = false;
  const mapa = new maplibregl.Map({
    container: 'mapa',
    style: ${JSON.stringify(ESTILO)},
    center: [${Number(lon)}, ${Number(lat)}],
    zoom: ${Number(zoom)},
    attributionControl: false,
    interactive: false,
    fadeDuration: 0
  });
  mapa.on('idle', () => { window.listo = true; });
</script></body></html>`);

  await pagina.waitForFunction(() => window.listo, null, { timeout: 120000 });
  if (errores.length > 0) throw new Error(errores.join('\n'));
  await pagina.screenshot({ path: salida });
} finally {
  await navegador.close();
}
