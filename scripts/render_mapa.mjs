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
 * Uso: node scripts/render_mapa.mjs <lon> <lat> <zoom> <ancho> <alto> <dpr> <salida.png> [franja]
 *
 * Ningún rótulo toca los bordes: MapLibre coloca los rótulos sin mirar el
 * canto de la ventana, y en la captura quedaban cortados —«…RES» de «LAS
 * FLORES» asomando por la esquina del teléfono—. `franja` son los puntos
 * de arriba que tampoco llevan rótulo: en el teléfono, la barra de estado
 * (59 pt, el `SafeArea` de iOS), donde un rótulo se mete bajo el reloj.
 */
import { chromium } from '@playwright/test';

const [lon, lat, zoom, ancho, alto, dpr, salida, franja = '0'] = process.argv.slice(2);
if (!salida) {
  console.error('uso: node scripts/render_mapa.mjs <lon> <lat> <zoom> <ancho> <alto> <dpr> <salida.png> [franja]');
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
  mapa.on('error', (e) => { window.errorMapa = String(e.error?.message ?? e); });
</script></body></html>`);

  await pagina.waitForFunction(() => window.listo, null, { timeout: 120000 });

  // Se buscan los rótulos que pisan la franja o un canto y se apagan por
  // nombre en su capa. Quitar uno libera sitio y MapLibre puede colocar
  // otro en el mismo borde, así que se repite hasta que no quede ninguno.
  // `queryRenderedFeatures` en una capa de símbolos mira la caja del
  // rótulo dibujado, no el punto del que cuelga: justo lo que hace falta.
  for (let vuelta = 0; ; vuelta++) {
    const quitados = await pagina.evaluate((franja) => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const cajas = [
        [[0, 0], [w, Math.max(franja, 1)]],
        [[0, 0], [1, h]],
        [[w - 1, 0], [w, h]],
        [[0, h - 1], [w, h]]
      ];
      const capas = mapa.getStyle().layers.filter((l) => l.type === 'symbol').map((l) => l.id);
      const porCapa = new Map();
      for (const caja of cajas) {
        for (const f of mapa.queryRenderedFeatures(caja, { layers: capas })) {
          const nombre = f.properties.name;
          if (nombre === undefined) continue;
          if (!porCapa.has(f.layer.id)) porCapa.set(f.layer.id, new Set());
          porCapa.get(f.layer.id).add(nombre);
        }
      }
      if (porCapa.size === 0) return 0;
      window.fuera ??= new Map();
      for (const [capa, nombres] of porCapa) {
        const todos = new Set([...(window.fuera.get(capa) ?? []), ...nombres]);
        window.fuera.set(capa, todos);
        window.filtroOriginal ??= new Map();
        if (!window.filtroOriginal.has(capa)) window.filtroOriginal.set(capa, mapa.getFilter(capa));
        const original = window.filtroOriginal.get(capa);
        // En la sintaxis vieja de filtros, la misma del estilo: las dos no
        // se pueden mezclar dentro de un `all`.
        const sin = ['!in', 'name', ...todos];
        mapa.setFilter(capa, original ? ['all', original, sin] : sin);
      }
      window.listo = false;
      mapa.once('idle', () => { window.listo = true; });
      return [...porCapa.values()].reduce((n, s) => n + s.size, 0);
    }, Number(franja));
    if (quitados === 0) break;
    if (vuelta === 10) throw new Error('los rótulos de los bordes no se acaban');
    await pagina.waitForFunction(() => window.listo, null, { timeout: 120000 });
  }

  const errorMapa = await pagina.evaluate(() => window.errorMapa);
  if (errorMapa) errores.push(errorMapa);
  if (errores.length > 0) throw new Error(errores.join('\n'));
  await pagina.screenshot({ path: salida });
} finally {
  await navegador.close();
}
