"""Genera el mapa del mockup de la landing: el mosaico real de Barranquilla
más las seis rutas de Sobusa proyectadas encima.

Salidas (dentro de este repo):
  src/assets/map/barranquilla.webp   fondo real (CARTO Voyager)
  src/data/rutas-landing.ts          rutas en píxeles de ese mosaico

Entrada: rutas.json vive en el repo de la app, que ya no es este. Se busca
en ../YaViene por defecto; con otra ubicación, se le pasa por entorno:

  YAVIENE_REPO=/ruta/al/repo npm run mapa

Nada de esto es decorativo. El fondo son las teselas del mismo estilo que
carga app_pasajero (basemaps.cartocdn.com/gl/voyager-gl-style/style.json,
ver map_widget.dart) y las rutas son los waypoints reales de rutas.json.
Al salir ambos del mismo encuadre Web Mercator, la polilínea cae sobre las
calles que le tocan.

Uso:  npm run mapa      (o python3 scripts/gen_mapa_landing.py)

Atribución obligatoria en cualquier página que muestre el mosaico:
  © OpenStreetMap contributors · © CARTO
"""
import io
import json
import math
import os
import subprocess
import sys
from pathlib import Path

from PIL import Image

# El script se ubica solo: sale de scripts/ a la raíz del repo de la landing,
# así funciona igual desde donde se lance.
RAIZ = Path(__file__).resolve().parent.parent
YAVIENE = Path(os.environ.get("YAVIENE_REPO", RAIZ.parent / "YaViene"))

SRC = YAVIENE / "app_pasajero" / "assets" / "data" / "rutas.json"
OUT_TS = RAIZ / "src" / "data" / "rutas-landing.ts"
OUT_IMG = RAIZ / "src" / "assets" / "map" / "barranquilla.webp"

TILE_URL = "https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png"
TILE_PX = 512          # las teselas @2x miden 512, aunque cubran lo mismo que una de 256
ZOOM = 13
PAD_FRAC = 0.05        # aire alrededor de la red para que no quede pegada al borde
TARGET_PTS = 110
WEBP_QUALITY = 78

UA = "YaViene-landing-build/1.0 (+https://github.com/elDiego5599/YaViene)"


# ── Web Mercator en píxeles globales ────────────────────────────────────

def world_px(zoom):
    return 256.0 * (2 ** zoom)


def lon_to_px(lon, zoom):
    return (lon + 180.0) / 360.0 * world_px(zoom)


def lat_to_px(lat, zoom):
    r = math.radians(lat)
    y = math.log(math.tan(r) + 1.0 / math.cos(r))
    return (1.0 - y / math.pi) / 2.0 * world_px(zoom)


# ── Simplificación de polilíneas ────────────────────────────────────────

def perpendicular_distance(p, a, b):
    (px, py), (ax, ay), (bx, by) = p, a, b
    dx, dy = bx - ax, by - ay
    if dx == 0 and dy == 0:
        return math.hypot(px - ax, py - ay)
    t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)
    t = max(0.0, min(1.0, t))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def douglas_peucker(pts, eps):
    if len(pts) < 3:
        return list(pts)
    a, b = pts[0], pts[-1]
    idx, dmax = 0, 0.0
    for i in range(1, len(pts) - 1):
        d = perpendicular_distance(pts[i], a, b)
        if d > dmax:
            idx, dmax = i, d
    if dmax <= eps:
        return [a, b]
    left = douglas_peucker(pts[: idx + 1], eps)
    right = douglas_peucker(pts[idx:], eps)
    return left[:-1] + right


def simplify_to(pts, target):
    """Busca por bisección el epsilon que deja ~target puntos."""
    if len(pts) <= target:
        return list(pts)
    lo, hi = 0.0, 100.0
    best = list(pts)
    for _ in range(40):
        mid = (lo + hi) / 2
        out = douglas_peucker(pts, mid)
        if len(out) > target:
            lo = mid
        else:
            best = out
            hi = mid
    return best


# ── Mosaico ─────────────────────────────────────────────────────────────

def fetch_tile(z, x, y):
    # Vía curl y no urllib: el Python de este Mac no tiene el almacén de
    # certificados configurado y la descarga falla en el handshake TLS.
    url = TILE_URL.format(z=z, x=x, y=y)
    res = subprocess.run(
        ["curl", "-sS", "--fail", "-A", UA, url],
        capture_output=True,
        timeout=60,
    )
    if res.returncode != 0:
        raise RuntimeError(f"no se pudo bajar {url}: {res.stderr.decode().strip()}")
    return Image.open(io.BytesIO(res.stdout)).convert("RGB")


def build_mosaic(left, top, right, bottom, zoom):
    """Descarga y recorta el mosaico que cubre el rectángulo dado, en
    píxeles globales de Web Mercator. Devuelve (imagen, ancho, alto)."""
    scale = TILE_PX / 256.0  # cuántos píxeles de imagen por píxel global

    tx0, tx1 = int(left // 256), int(right // 256)
    ty0, ty1 = int(top // 256), int(bottom // 256)
    cols, rows = tx1 - tx0 + 1, ty1 - ty0 + 1

    sheet = Image.new("RGB", (cols * TILE_PX, rows * TILE_PX))
    for i, tx in enumerate(range(tx0, tx1 + 1)):
        for j, ty in enumerate(range(ty0, ty1 + 1)):
            sheet.paste(fetch_tile(zoom, tx, ty), (i * TILE_PX, j * TILE_PX))
            print(f"  tesela {zoom}/{tx}/{ty}")

    # Recorte fino: del origen del mosaico al rectángulo pedido.
    ox, oy = tx0 * 256.0, ty0 * 256.0
    box = (
        int(round((left - ox) * scale)),
        int(round((top - oy) * scale)),
        int(round((right - ox) * scale)),
        int(round((bottom - oy) * scale)),
    )
    crop = sheet.crop(box)
    return crop, crop.width, crop.height


def emitir_ts(body, generado, out_w, out_h):
    """Escribe el módulo TypeScript.

    A mano y no con json.dumps porque el resultado es código, no datos: las
    claves van sin comillas, la URL del mosaico es un import —para que el
    empaquetador la versione y avise si el archivo falta— y el objeto lleva
    su tipo, que es lo que hace que un cambio en el generador se note al
    compilar y no en la página ya publicada.
    """
    lineas = [
        "// GENERADO — no editar a mano.",
        "// Fuente: app_pasajero/assets/data/rutas.json del repo YaViene (%s)." % generado,
        "// Las seis rutas reales de Sobusa proyectadas sobre el mosaico",
        "// src/assets/map/barranquilla.webp (%d x %d, CARTO" % (out_w, out_h),
        "// Voyager z%d), el mismo mapa base que carga la app. Se regenera con" % ZOOM,
        "// `npm run mapa`.",
        "",
        "import mapaUrl from '../assets/map/barranquilla.webp';",
        "import type { DatosLanding } from '../types';",
        "",
        "export const YV_RUTAS: DatosLanding = {",
        "  viewBox: [%s]," % ",".join(str(v) for v in body["viewBox"]),
        "  mapa: {",
        "    // El empaquetador resuelve y versiona la URL del mosaico.",
        "    src: mapaUrl,",
        "    ancho: %d," % body["mapa"]["ancho"],
        "    alto: %d," % body["mapa"]["alto"],
        "    atribucion: %s" % json.dumps(body["mapa"]["atribucion"], ensure_ascii=False),
        "  },",
        "  rutas: [",
    ]
    for i, r in enumerate(body["rutas"]):
        coma = "," if i < len(body["rutas"]) - 1 else ""
        extremos = ",".join(
            "[%s]" % ",".join(str(v) for v in par) for par in r["extremos"]
        )
        lineas += [
            "    {",
            "      id: %s," % json.dumps(r["id"], ensure_ascii=False),
            "      nombre: %s," % json.dumps(r["nombre"], ensure_ascii=False),
            "      terminalA: %s," % json.dumps(r["terminalA"], ensure_ascii=False),
            "      terminalB: %s," % json.dumps(r["terminalB"], ensure_ascii=False),
            "      km: %s," % r["km"],
            "      d: %s," % json.dumps(r["d"], ensure_ascii=False),
            "      extremos: [%s]" % extremos,
            "    }" + coma,
        ]
    lineas += ["  ]", "};", ""]

    OUT_TS.parent.mkdir(parents=True, exist_ok=True)
    OUT_TS.write_text("\n".join(lineas), encoding="utf-8")


def main():
    if not SRC.exists():
        sys.exit(
            "no encuentro %s\n"
            "El repo de la app va aparte; indícalo con YAVIENE_REPO=/ruta/al/repo"
            % SRC
        )

    data = json.loads(SRC.read_text(encoding="utf-8"))
    rutas = data["rutas"]

    lons = [p["lon"] for r in rutas for p in r["waypoints"]]
    lats = [p["lat"] for r in rutas for p in r["waypoints"]]

    # Rectángulo de la red en píxeles globales, más un margen.
    left = lon_to_px(min(lons), ZOOM)
    right = lon_to_px(max(lons), ZOOM)
    top = lat_to_px(max(lats), ZOOM)
    bottom = lat_to_px(min(lats), ZOOM)
    pad_x = (right - left) * PAD_FRAC
    pad_y = (bottom - top) * PAD_FRAC
    left, right = left - pad_x, right + pad_x
    top, bottom = top - pad_y, bottom + pad_y

    print(f"encuadre z{ZOOM}: {right - left:.0f} x {bottom - top:.0f} px globales")
    img, out_w, out_h = build_mosaic(left, top, right, bottom, ZOOM)

    OUT_IMG.parent.mkdir(parents=True, exist_ok=True)
    img.save(OUT_IMG, "WEBP", quality=WEBP_QUALITY, method=6)

    # El lienzo del SVG es el mosaico en sus propios píxeles, así la
    # polilínea y el fondo comparten sistema de coordenadas.
    scale = out_w / (right - left)

    def project(lon, lat):
        x = (lon_to_px(lon, ZOOM) - left) * scale
        y = (lat_to_px(lat, ZOOM) - top) * scale
        return (round(x, 1), round(y, 1))

    out_rutas = []
    for r in rutas:
        pts = [project(p["lon"], p["lat"]) for p in r["waypoints"]]
        simple = simplify_to(pts, TARGET_PTS)
        d = "M" + " L".join(f"{x} {y}" for x, y in simple)
        out_rutas.append(
            {
                "id": r["routeId"],
                "nombre": r["name"],
                "terminalA": r["terminalA"],
                "terminalB": r["terminalB"],
                "km": r["lengthKm"],
                "puntos": len(r["waypoints"]),
                "simples": len(simple),
                "d": d,
                "extremos": [list(simple[0]), list(simple[-1])],
            }
        )

    body = {
        "viewBox": [0, 0, out_w, out_h],
        "mapa": {
            # La ruta real la resuelve el import del módulo generado.
            "src": "src/assets/map/barranquilla.webp",
            "ancho": out_w,
            "alto": out_h,
            "atribucion": "© OpenStreetMap · © CARTO",
        },
        "rutas": out_rutas,
    }
    emitir_ts(body, data.get("generado", "sin fecha"), out_w, out_h)

    print(f"mosaico {out_w} x {out_h} -> {OUT_IMG.stat().st_size / 1024:.0f} KB")
    for r in out_rutas:
        print(f"  {r['id']} {r['nombre']}: {r['puntos']} -> {r['simples']} pts")
    print("datos:", OUT_TS.stat().st_size, "bytes")


if __name__ == "__main__":
    main()
