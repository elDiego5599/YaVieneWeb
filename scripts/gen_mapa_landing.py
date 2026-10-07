"""Genera el mapa del mockup de la landing: la pantalla real de Barranquilla
que ve la app, más las seis rutas de Sobusa proyectadas encima.

Salidas (dentro de este repo):
  src/assets/map/barranquilla.webp          fondo real (CARTO Voyager)
  src/assets/map/barranquilla-ciudad.webp   la ciudad entera, para el mapa en vivo
  src/data/rutas-landing.ts                 rutas en píxeles de ese mosaico

Entrada: rutas.json vive en el repo de la app, que ya no es este. Se busca
en ../YaViene por defecto; con otra ubicación, se le pasa por entorno:

  YAVIENE_REPO=/ruta/al/repo npm run mapa

Nada de esto es decorativo. El fondo lo dibuja MapLibre con el mismo estilo
vectorial que carga app_pasajero (basemaps.cartocdn.com/gl/voyager-gl-style/
style.json, ver map_widget.dart), al zoom de la vista del pin y del tamaño
de la pantalla del iPhone; lo pinta scripts/render_mapa.mjs en un Chromium
sin ventana. Las rutas son los waypoints reales de rutas.json. Al salir
ambos del mismo encuadre Web Mercator, la polilínea cae sobre las calles
que le tocan.

Antes el fondo se armaba bajando teselas raster de CARTO, pero ya no se
sirven sin clave: cada una trae «API KEY REQUIRED» impreso encima.

Hace falta Node con las dependencias del repo (npm install) y el Chromium
de Playwright (npx playwright install chromium).

Uso:  npm run mapa      (o python3 scripts/gen_mapa_landing.py)

Atribución obligatoria en cualquier página que muestre el mosaico:
  © OpenStreetMap contributors · © CARTO
"""
import json
import math
import os
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image

# El script se ubica solo: sale de scripts/ a la raíz del repo de la landing,
# así funciona igual desde donde se lance.
RAIZ = Path(__file__).resolve().parent.parent
YAVIENE = Path(os.environ.get("YAVIENE_REPO", RAIZ.parent / "YaViene"))

SRC = YAVIENE / "ya_viene_core" / "assets" / "data" / "rutas.json"
OUT_TS = RAIZ / "src" / "data" / "rutas-landing.ts"
OUT_IMG = RAIZ / "src" / "assets" / "map" / "barranquilla.webp"
OUT_IMG_CIUDAD = RAIZ / "src" / "assets" / "map" / "barranquilla-ciudad.webp"

# Dónde cae el pin de espera, y en qué punto de la pantalla. El punto es
# un tramo norte de la C16, la ruta que el paso 1 deja elegida, a mitad de
# camino entre dos waypoints de rutas.json (172 y 174): por ahí la ruta
# baja en diagonal, así que los buses que llegan por detrás vienen desde
# arriba a la izquierda y no se meten bajo la hoja de distancia. MIRA es
# MIRA_X/MIRA_Y de paso-demo.ts: el centro de la franja que dejan libre la
# píldora de arriba y la hoja de abajo.
#
# Antes el centro estaba en el tronco del sur por el que suben las seis
# rutas. A este zoom esa zona es un gris de manzanas apretadas que se come
# la línea azul; en el norte el Voyager es el de las capturas de la app,
# calles blancas sobre crema, y ahí la ruta se lee sola.
PIN_ESPERA = (-74.80598, 10.99770)  # lon, lat
MIRA = (0.5, 0.44)
# Zoom de MapLibre de la vista del pin en la app, medido y no supuesto: en
# el simulador (iPhone de 402 pt de ancho) el radio de 2 km del punto de
# espera ocupa 155 pt, o sea 12,9 m por punto, y eso en la latitud de
# Barranquilla es el zoom 12,54. Con él el círculo entra entero a lo ancho
# de la pantalla, como allá; a 13, como iba antes, se salía por los lados.
ZOOM_GL = 12.54
# La pantalla del iPhone que reproduce el mockup, en puntos: 402 de ancho,
# y el alto que le da el aspecto de .phone-screen (0,4594).
PANTALLA_PT = (402, 875)
# La barra de estado del iPhone: el `SafeArea` superior de 59 pt, el mismo
# `--alto-estado` de phone-simulator.css. Ahí van el reloj y la isla, y un
# rótulo del mapa debajo se lee como basura; la captura no lleva ninguno.
BARRA_ESTADO_PT = 59
# A 2x, como la pantalla retina: en el teléfono del hero cae uno a uno.
DPR = 2
# Tolerancia de la simplificación, en unidades del lienzo (medio punto a
# 2x). Dentro de la pantalla va casi a cero —0,8 unidades, menos de medio
# punto— para que la línea pase por los mismos waypoints que la de la app
# y no corte las esquinas en diagonal; fuera no se ve y se puede ser
# grueso, que es de donde sale el peso del JS. MARGEN es cuánto se
# extiende «dentro» más allá del borde: tiene que ser mayor que EPS_FUERA,
# porque la simplificación se aparta hasta eps de la línea real, y así un
# tramo de fuera nunca entra a la pantalla por un atajo.
EPS_DENTRO = 0.8
EPS_FUERA = 16
MARGEN = 40
WEBP_QUALITY = 78

# El mapa en vivo no es un teléfono: enseña la ciudad entera y deja elegir
# cualquiera de las seis rutas, así que el recorte de la pantalla del pin le
# deja fuera medio recorrido —la R-105 tiene la terminal a 700 unidades a la
# izquierda del borde— y buses y pin se le salían del dibujo. Lleva su
# propio fondo, pintado sobre la caja de toda la red y en las MISMAS
# unidades del lienzo del teléfono: las polilíneas, las terminales y
# `metrosPorUnidad` sirven tal cual para los dos, sólo cambia el viewBox.
#
# Zoom 12 de MapLibre es el z13 de las teselas raster @2x que llevaba el
# mosaico de la ciudad antes del render vectorial (512 píxeles por tesela
# de 256): la ciudad sale del mismo tamaño que entonces, unos 1250 x 1900
# píxeles, que es lo que pide el lienzo del mapa en vivo a 2x. AIRE_CIUDAD
# es el 5 % de cada lado que dejaba aquel mosaico, para que ninguna
# terminal quede pegada al borde de la tarjeta.
ZOOM_CIUDAD_GL = 12
AIRE_CIUDAD = 0.05


# ── Web Mercator en píxeles globales ────────────────────────────────────

def world_px(zoom):
    return 256.0 * (2 ** zoom)


def lon_to_px(lon, zoom):
    return (lon + 180.0) / 360.0 * world_px(zoom)


def lat_to_px(lat, zoom):
    r = math.radians(lat)
    y = math.log(math.tan(r) + 1.0 / math.cos(r))
    return (1.0 - y / math.pi) / 2.0 * world_px(zoom)


def px_to_lon(x, zoom):
    return x / world_px(zoom) * 360.0 - 180.0


def px_to_lat(y, zoom):
    n = math.pi * (1.0 - 2.0 * y / world_px(zoom))
    return math.degrees(math.atan(math.sinh(n)))


# ── Simplificación de polilíneas ────────────────────────────────────────

def perpendicular_distance(p, a, b):
    (px, py), (ax, ay), (bx, by) = p, a, b
    dx, dy = bx - ax, by - ay
    if dx == 0 and dy == 0:
        return math.hypot(px - ax, py - ay)
    t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)
    t = max(0.0, min(1.0, t))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def douglas_peucker(pts, eps_de):
    """Douglas-Peucker con la tolerancia que pida cada tramo.

    `eps_de(tramo)` la decide mirando los puntos del tramo: uno que toca la
    pantalla se sigue partiendo con la fina hasta que sus pedazos quedan
    todos fuera, y sólo esos se simplifican grueso. Antes había una sola
    tolerancia para toda la ruta, buscada para dejar 110 puntos, y en
    pantalla la línea cortaba las esquinas en diagonales que la app no
    tiene.
    """
    if len(pts) < 3:
        return list(pts)
    a, b = pts[0], pts[-1]
    idx, dmax = 0, 0.0
    for i in range(1, len(pts) - 1):
        d = perpendicular_distance(pts[i], a, b)
        if d > dmax:
            idx, dmax = i, d
    if dmax <= eps_de(pts):
        return [a, b]
    left = douglas_peucker(pts[: idx + 1], eps_de)
    right = douglas_peucker(pts[idx:], eps_de)
    return left[:-1] + right


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
        "// Fuente: ya_viene_core/assets/data/rutas.json del repo YaViene (%s)." % generado,
        "// Las seis rutas reales de Sobusa proyectadas sobre el mosaico",
        "// src/assets/map/barranquilla.webp (%d x %d, CARTO Voyager" % (out_w, out_h),
        "// vectorial a zoom %s, la vista del pin en la app). Se regenera con" % ZOOM_GL,
        "// `npm run mapa`.",
        "",
        "import mapaUrl from '../assets/map/barranquilla.webp';",
        "import ciudadUrl from '../assets/map/barranquilla-ciudad.webp';",
        "import type { DatosLanding } from '../types';",
        "",
        "export const YV_RUTAS: DatosLanding = {",
        "  viewBox: [%s]," % ",".join(str(v) for v in body["viewBox"]),
        "  metrosPorUnidad: %s," % body["metrosPorUnidad"],
        "  mapa: {",
        "    // El empaquetador resuelve y versiona la URL del mosaico.",
        "    src: mapaUrl,",
        "    ancho: %d," % body["mapa"]["ancho"],
        "    alto: %d," % body["mapa"]["alto"],
        "    atribucion: %s" % json.dumps(body["mapa"]["atribucion"], ensure_ascii=False),
        "  },",
        "  // La ciudad entera para el mapa en vivo, en las mismas unidades.",
        "  ciudad: {",
        "    viewBox: [%s]," % ",".join(str(v) for v in body["ciudad"]["viewBox"]),
        "    mapa: {",
        "      src: ciudadUrl,",
        "      ancho: %d," % body["ciudad"]["mapa"]["ancho"],
        "      alto: %d," % body["ciudad"]["mapa"]["alto"],
        "      atribucion: %s" % json.dumps(body["ciudad"]["mapa"]["atribucion"], ensure_ascii=False),
        "    }",
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


def pintar(centro, zoom_gl, ancho, alto, destino, franja=0):
    """Pinta con render_mapa.mjs y guarda en WebP; devuelve su tamaño.

    [franja] son los puntos de arriba sin rótulos (ver render_mapa.mjs).
    """
    with tempfile.TemporaryDirectory() as tmp:
        png = Path(tmp) / "mapa.png"
        subprocess.run(
            [
                "node", str(RAIZ / "scripts" / "render_mapa.mjs"),
                "%.6f" % centro[0], "%.6f" % centro[1], str(zoom_gl),
                str(ancho), str(alto), str(DPR), str(png), str(franja),
            ],
            check=True,
            cwd=RAIZ,
        )
        img = Image.open(png).convert("RGB")
    destino.parent.mkdir(parents=True, exist_ok=True)
    img.save(destino, "WEBP", quality=WEBP_QUALITY, method=6)
    return img.size


def main():
    if not SRC.exists():
        sys.exit(
            "no encuentro %s\n"
            "El repo de la app va aparte; indícalo con YAVIENE_REPO=/ruta/al/repo"
            % SRC
        )

    data = json.loads(SRC.read_text(encoding="utf-8"))
    rutas = data["rutas"]

    # MapLibre mide el mundo en teselas de 512, así que su zoom z es el
    # z + 1 de estas cuentas, que van en teselas de 256: un punto de la
    # captura es un píxel global a ese zoom.
    zoom = ZOOM_GL + 1
    ancho, alto = PANTALLA_PT
    # La esquina se pone para que el pin caiga en MIRA, y el centro que se
    # le pasa a MapLibre sale de ella.
    left = lon_to_px(PIN_ESPERA[0], zoom) - MIRA[0] * ancho
    top = lat_to_px(PIN_ESPERA[1], zoom) - MIRA[1] * alto
    centro = (px_to_lon(left + ancho / 2, zoom), px_to_lat(top + alto / 2, zoom))

    # Metros por unidad del lienzo: la circunferencia del ecuador por el
    # coseno de la latitud, repartida en los píxeles del mundo a este zoom
    # y en los DPR de cada punto. Web Mercator es conforme, así que vale
    # igual a lo ancho que a lo alto, y en los 11 km de alto de la pantalla
    # la latitud la mueve menos de un 0,1 %.
    metros_por_unidad = (
        40075016.686 * math.cos(math.radians(PIN_ESPERA[1])) / world_px(zoom) / DPR
    )

    print(f"encuadre: {ancho} x {alto} pt a zoom {ZOOM_GL}, x{DPR}")
    out_w, out_h = pintar(centro, ZOOM_GL, ancho, alto, OUT_IMG, BARRA_ESTADO_PT)

    # El lienzo del SVG es la captura en sus propios píxeles, así la
    # polilínea y el fondo comparten sistema de coordenadas. Se simplifica
    # con decimales y se redondea al escribir: a 2x una unidad es medio
    # punto, así que el decimal no se ve y quitarlo ahorra dos caracteres
    # por coordenada del JS.
    def project(lon, lat):
        x = (lon_to_px(lon, zoom) - left) * DPR
        y = (lat_to_px(lat, zoom) - top) * DPR
        return (x, y)

    def dentro(p):
        return (-MARGEN <= p[0] <= out_w + MARGEN
                and -MARGEN <= p[1] <= out_h + MARGEN)

    def eps_de(tramo):
        return EPS_DENTRO if any(dentro(p) for p in tramo) else EPS_FUERA

    out_rutas = []
    for r in rutas:
        pts = [project(p["lon"], p["lat"]) for p in r["waypoints"]]
        simple = []
        for x, y in douglas_peucker(pts, eps_de):
            q = (round(x), round(y))
            if not simple or simple[-1] != q:
                simple.append(q)
        d = "M" + " L".join(f"{x} {y}" for x, y in simple)
        # Las terminales. Los recorridos de rutas.json son de ida y vuelta:
        # salen de la terminal A y acaban donde empezaron, así que el primer
        # y el último punto —lo que se tomaba antes— caen en el mismo sitio
        # y la otra punta no se marcaba. rutas.json no trae paradas, así que
        # la B se deduce del trazo: es donde el bus da la vuelta, el vértice
        # más alejado de la salida. En las seis cae entre el 47 y el 54 % del
        # largo, que es lo que se espera de una vuelta. Se busca entre los
        # vértices ya simplificados, y no en los waypoints crudos, para que
        # el círculo caiga sobre la línea que se dibuja y `d` no cambie.
        vuelta = max(
            simple,
            key=lambda p: math.hypot(p[0] - simple[0][0], p[1] - simple[0][1]),
        )
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
                "extremos": [list(simple[0]), list(vuelta)],
            }
        )

    # La caja de la ciudad sale de los waypoints crudos y no de los
    # simplificados: Douglas-Peucker sólo conserva puntos originales, así que
    # todo lo que se dibuja cae dentro de ella, redondeo incluido.
    todos = [project(p["lon"], p["lat"]) for r in rutas for p in r["waypoints"]]
    x0, x1 = min(p[0] for p in todos), max(p[0] for p in todos)
    y0, y1 = min(p[1] for p in todos), max(p[1] for p in todos)
    # Puntos del render de la ciudad por unidad del lienzo del teléfono: la
    # razón de los dos zooms, sobre los DPR de cada punto del teléfono.
    escala = 2 ** (ZOOM_CIUDAD_GL - ZOOM_GL) / DPR
    c_ancho = math.ceil((x1 - x0) * (1 + 2 * AIRE_CIUDAD) * escala)
    c_alto = math.ceil((y1 - y0) * (1 + 2 * AIRE_CIUDAD) * escala)
    # El viewBox se deduce del tamaño entero de la captura, y no al revés,
    # para que imagen y viewBox tengan exactamente la misma proporción y el
    # fondo no se estire ni una décima.
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    vw, vh = c_ancho / escala, c_alto / escala
    centro_c = (px_to_lon(left + cx / DPR, zoom), px_to_lat(top + cy / DPR, zoom))
    print(f"ciudad: {c_ancho} x {c_alto} pt a zoom {ZOOM_CIUDAD_GL}, x{DPR}")
    ciudad_w, ciudad_h = pintar(centro_c, ZOOM_CIUDAD_GL, c_ancho, c_alto, OUT_IMG_CIUDAD)

    body = {
        "viewBox": [0, 0, out_w, out_h],
        "ciudad": {
            "viewBox": [
                round(cx - vw / 2, 1), round(cy - vh / 2, 1), round(vw, 1), round(vh, 1)
            ],
            "mapa": {
                "src": "src/assets/map/barranquilla-ciudad.webp",
                "ancho": ciudad_w,
                "alto": ciudad_h,
                "atribucion": "© OpenStreetMap · © CARTO",
            },
        },
        "metrosPorUnidad": round(metros_por_unidad, 4),
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
    print(f"ciudad {ciudad_w} x {ciudad_h} -> {OUT_IMG_CIUDAD.stat().st_size / 1024:.0f} KB")
    for r in out_rutas:
        print(f"  {r['id']} {r['nombre']}: {r['puntos']} -> {r['simples']} pts")
    print("datos:", OUT_TS.stat().st_size, "bytes")


if __name__ == "__main__":
    main()
