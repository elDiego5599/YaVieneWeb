# rutaviva — especificación

Librería abierta, en Dart y en TypeScript, que convierte reportes GPS
escasos y con ruido en un vehículo que avanza **por su ruta**, sin saltos
hacia atrás y con la distancia que le falta medida **por el recorrido**.

Estado: **aplazado** (dueño, 2026-10-08). Nombre libre en npm y pub.dev
(404 en los dos registros el 2026-10-08).

> **Decisión del dueño.** El diagnóstico se queda; el alcance no. Hoy la
> flota es simulada y va pegada a la ruta, así que el ruido y los saltos de
> sentido no se ven, y no hay trazas reales con qué probar (el GPS real
> espera al AMB, D2). Dos librerías, dos registros, página de pruebas y
> artículo son semanas para algo que hoy no se ve: va contra YAGNI.
>
> **Lo que se hace ahora** está en [tickets.md](tickets.md), grupo «Ahora»:
> 1. Distancia por la ruta en el core de Dart, con proyección por ventana,
>    para la hoja y el aviso.
> 2. Hallazgo 9 de la web, con un arreglo pequeño en `mapa-vivo.ts`.
>
> El paquete abierto (todo lo de abajo) queda como guía para cuando haya
> GPS real y trazas que lo justifiquen.

---

## 1. El problema

Una app de seguimiento recibe un reporte cada 1–30 s, con 5–30 m de error,
y conoce la ruta del vehículo. Lo que muestra hoy casi cualquier app:

| Síntoma | Causa |
|---|---|
| El bus corta esquinas | Se anima en línea recta entre dos reportes |
| El bus tiembla o retrocede unos metros | El ruido del GPS se pinta tal cual |
| En calles de ida y vuelta, el bus «salta» al otro sentido | Se pega al tramo **más cercano**, no al tramo **coherente** con por dónde iba |
| Se queda congelado o desaparece sin explicación | No hay estado para «señal vieja» |
| «Está a 400 m» cuando faltan 3 km de recorrido | La distancia se mide en línea recta |

Las librerías de *map matching* (OSRM, Valhalla, Mapbox) resuelven otro
problema: pegar a la **red vial** desconocida, en un servidor. Aquí la ruta
ya se conoce y la respuesta tiene que salir en el teléfono, en microsegundos.

### Evidencia en YaViene (app `main` 9d0f3a0, web `main` ac234af)

- **La distancia que promete el producto se mide en línea recta** (`haversineMeters`)
  en `eta_bottom_sheet.dart`, `alert_toggle_provider.dart` y
  `proximity_alerts_provider.dart`. Si la ruta da una vuelta, «a 400 m»
  pueden ser 3 km por la calle. Es lo más valioso de este documento.
- `ya_viene_core/lib/core/models/bus_motion.dart` (`BusMotion`): interpolación
  lineal de lat/lon durante 1 s. Corta esquinas y asume reportes cada ~1 s.
  La usan el pasajero (`map_bus_animator.dart`, `map_widget.dart`) **y el
  panel** (`app_control/.../control_map.dart`).
- `app_pasajero/.../utils/geo.dart` `projectOntoPolyline`: busca el tramo
  más cercano en **toda** la polilínea, sin pista de avance. En una ruta de
  ida y vuelta por la misma calle, cualquiera de los dos sentidos vale.
- Web, auditoría 2026-09-29, hallazgo 9: en el mapa en vivo el bus salta
  750 m hacia atrás en bucle porque la vuelta del recorrido (`t: 1 → 0`) se
  trata como fin de escena.
- `rutas.json` trae 9 rutas; la web dibuja 6. Las seis de la web son de ida y
  vuelta: el punto de vuelta cae entre el 47 % y el 54 % del largo (rama
  `nube/terminales`). Ida y regreso comparten calles en varios tramos.
- La flota simulada va pegada a la ruta: hoy ni el ruido ni el salto de
  sentido se ven. Aparecen con el GPS real.

## 2. Objetivos y no-objetivos

**Objetivos (v1)**
1. Pegar cada reporte a la ruta usando el avance anterior, para no equivocar el sentido.
2. Avance que solo va hacia adelante, con tolerancia al ruido y vuelta limpia en rutas circulares.
3. Posición en cualquier instante entre reportes, sobre la ruta, para animar a 60 fps.
4. Distancia por la ruta hasta un punto (parada o usuario), no ETA.
5. Estados explícitos: `enVivo`, `senalVieja`, `sinSenal`, `fueraDeRuta`.
6. Mismo comportamiento en Dart y en TS: los dos pasan los mismos vectores, con la tolerancia en metros que fija cada vector.
7. Cero dependencias. Sin red. Sin mapa: devuelve números, el mapa lo pone quien lo usa.

**No-objetivos (v1)**
- ETA o predicción de tiempo de llegada (regla del producto: distancia, no ETA).
- Map matching contra la red vial o rutas desconocidas.
- Widgets de mapa. Los adaptadores (flutter_map, MapLibre, Leaflet) son ejemplos, no parte del núcleo.
- Varias rutas candidatas por vehículo (bus que cambia de ruta): v2.

## 3. Modelo

```ts
type Punto = { lat: number; lon: number };

type Ruta = {
  puntos: Punto[];         // ≥ 2, en orden de recorrido
  circular?: boolean;      // true: al terminar vuelve a empezar (por defecto: se deduce si inicio y fin distan < 50 m)
};

type Reporte = {
  lat: number; lon: number;
  t: number;               // milisegundos epoch del GPS, no de llegada
  rumbo?: number;          // grados, opcional
  velocidad?: number;      // m/s, opcional
  precision?: number;      // m, opcional
};

type Estado = 'enVivo' | 'senalVieja' | 'sinSenal' | 'fueraDeRuta';

type Lectura = {
  avance: number;          // metros desde el inicio de la ruta, [0, largo)
  vuelta: number;          // vueltas completas (circular), para que avance+vuelta*largo sea monótono
  punto: Punto;            // posición sobre la ruta
  rumbo: number;           // tangente de la ruta en ese punto
  estado: Estado;
  desvio: number;          // metros del último reporte a la ruta
};
```

## 4. API

TypeScript (Dart igual, con nombres en camelCase de Dart):

```ts
const ruta = prepararRuta(puntos, { circular: true });   // precálculo: largos acumulados, índice por celdas
const bus  = new Seguidor(ruta, opciones?);

bus.reportar(reporte): Lectura;          // entra un GPS, sale la lectura pegada
bus.en(ahoraMs): Lectura;                // posición estimada para pintar este cuadro
bus.distanciaHasta(punto, ahoraMs?): number | null;
                                         // metros por la ruta; null si el punto no queda cerca de la ruta
ruta.proyectar(punto): { avance, desvio }; // sin estado, para «¿pasa esta ruta cerca de mí?»
```

`Seguidor` es serializable (`aJson` / `desdeJson`) para que el servidor y el
teléfono puedan compartir estado.

## 5. Algoritmo

### 5.1 Proyección con ventana
1. Primer reporte, o tras `fueraDeRuta`: búsqueda global con un índice por
   celdas de ~200 m; gana el tramo de menor `desvio`. Si dos candidatos
   empatan dentro de 15 m (ida y vuelta por la misma calle), desempata el
   `rumbo` del reporte contra la tangente; sin rumbo, se deja `pendiente` y
   decide el segundo reporte.
2. Reportes siguientes: solo se buscan tramos en la ventana
   `[avance − 50 m, avance + vMax·Δt + 100 m]` (con vuelta en circulares).
   `vMax` = 25 m/s (90 km/h) por defecto.
3. Si el mejor tramo de la ventana queda a más de `desvioMax` (60 m) por
   `reportesFuera` (3) reportes seguidos → `fueraDeRuta` y la próxima
   búsqueda vuelve a ser global.

### 5.2 Avance monótono
- Retroceso menor que `toleranciaRetroceso` (30 m): se ignora (es ruido) y el avance se queda.
- Retroceso mayor y sostenido en 2 reportes: se acepta (el bus de verdad
  retrocedió o el anterior era malo), con transición suave, nunca salto.
- Ruta circular: pasar del final al inicio suma `vuelta`, no es retroceso.
  (Esto cierra el hallazgo 9 de la web.)

### 5.3 Entre reportes
- Velocidad sobre la ruta = Δavance / Δt de los dos últimos reportes, suavizada (media exponencial, α = 0.4).
- `en(ahora)`: avanza con esa velocidad hasta `extrapolacionMax` (8 s); después frena con curva suave hasta detenerse. Nunca pasa más de `vMax·Δt` del último reporte.
- Cuando llega un reporte que queda detrás de lo extrapolado, no se retrocede: el pintado espera ahí a que lo real lo alcance.
- La posición sale de interpolar **sobre la polilínea**, así que dobla las esquinas.

### 5.4 Estados
| Estado | Cuándo | Por defecto |
|---|---|---|
| `enVivo` | último reporte hace < `viejoMs` | 45 s |
| `senalVieja` | entre `viejoMs` y `perdidoMs` | 45 s – 5 min |
| `sinSenal` | más de `perdidoMs` | > 5 min |
| `fueraDeRuta` | ver 5.1.3 | 3 reportes a > 60 m |

Cada número sale de una opción y su valor por defecto se justifica en la
documentación, como ya se hace con las constantes de YaViene.

### 5.5 Distancia por la ruta
`distanciaHasta(p)`: se proyecta `p` sobre la ruta; si queda a más de
`radioParada` (300 m) devuelve `null`. Si no, la distancia es el tramo de
ruta entre el avance del bus y el del punto, con vuelta en circulares
(un punto ya pasado en una circular está a «una vuelta menos lo recorrido»;
en una ruta abierta, `null`).

### 5.6 Geometría
Coordenadas locales equirectangulares por ruta (como `geo.dart`), con el
centro de la ruta como referencia: error < 0,1 % a escala de ciudad. Haversine
solo para la referencia de las pruebas.

## 6. Pruebas compartidas

Una carpeta `vectores/` con JSON que corren **las dos** implementaciones:

```json
{
  "nombre": "ida y vuelta por la misma calle, rumbo decide",
  "ruta": { "puntos": [...], "circular": true },
  "opciones": {},
  "pasos": [
    { "reportar": { "lat": 10.98, "lon": -74.80, "t": 0, "rumbo": 182 },
      "espera": { "avance": [1520, 5], "estado": "enVivo" } },
    { "en": 4000, "espera": { "avance": [1560, 5] } }
  ]
}
```

`[valor, tolerancia]` en metros. Casos mínimos:
- recta, curva en L, esquina cerrada;
- ida y vuelta por la misma calle, con y sin rumbo;
- vuelta de circular (final → inicio);
- ruido de ±25 m en parado (el avance no debe moverse más de 5 m);
- reporte duplicado, desordenado (t menor que el anterior) y con t futuro;
- hueco de 2 min (`senalVieja`) y de 10 min (`sinSenal`);
- desvío de 300 m por obra y reenganche;
- ruta degenerada (puntos repetidos, un solo punto);
- **trazas reales de YaViene** anonimizadas (sin placa ni empresa, hora corrida) [DUEÑO: permiso de las empresas].

Además, por implementación:
- propiedades aleatorias (fast-check / glados): con cualquier secuencia de
  reportes sobre la ruta, `avance + vuelta·largo` nunca baja más de la tolerancia;
- cobertura ≥ 95 % de líneas y ramas con el trinquete de YaViene.

## 7. Rendimiento

Lo que se puede probar en CI, no en un teléfono concreto:
- `reportar` con ventana no recorre la ruta entera: una prueba cuenta los
  tramos visitados (≤ los de la ventana), no microsegundos.
- Banco de medidas con línea base guardada; un cambio que empeore más del
  10 % en la misma máquina de CI falla.
- TS: < 4 KB gzip (`size-limit`), ESM, sin dependencias, `sideEffects: false`.

## 8. Entregables

1. Repo público `elDiego5599/rutaviva` [DUEÑO: crearlo] con `dart/`, `ts/` y `vectores/`, licencia MIT.
2. Paquetes `rutaviva` en pub.dev y npm, versión semántica, CHANGELOG.
3. **Página de pruebas**: mapa CARTO Voyager, una traza real reproducida
   con tres capas (reportes crudos, animación lineal, rutaviva) y controles
   de ruido y frecuencia. Es la pieza que se comparte.
4. Documentación:
   - README con el GIF de la comparación;
   - una guía por cada problema de §1;
   - ejemplos con flutter_map, MapLibre y Leaflet;
   - un ejemplo que lee GTFS-Realtime (cualquier ciudad lo prueba en 5 min).
5. Artículo técnico (es + en): «Por qué tu bus salta hacia atrás».

## 9. Integración en YaViene

Va después de publicar la v1 y cambia lo que se ve, así que [DUEÑO] lo aprueba con capturas:

- Core: `BusMotion` pasa a mover sobre la ruta; eso cambia **el pasajero y
  el panel** a la vez, así que las capturas son de los dos.
- Pasajero: `projectOntoPolyline` y `route_reach_provider.dart` usan
  `ruta.proyectar`; la hoja y los avisos ya miden por la ruta desde el
  grupo «Ahora» de los tickets.
- Web: el bus del mapa en vivo avanza con `Seguidor`. El hallazgo 9 ya se
  habrá cerrado antes, sin librería. El presupuesto de JS se mide antes de
  sumar (60,4/66 el 2026-10-08, medido por el dueño).
- Backend (opcional, v2): calcula el avance en el servidor y lo manda en el
  paquete. Los teléfonos dejan de proyectar.

## 10. Cuándo está hecho

- YaViene lo usa en el pasajero, el panel y la web, con una prueba por cada
  síntoma de §1 que falla sin la librería.
- Las trazas reales del GPS (cuando existan) pasan como vectores.

La adopción ajena no depende de nosotros y no es criterio de cierre.

## 11. Preguntas abiertas para el dueño

1. ¿Repo bajo `elDiego5599` o bajo una organización `yaviene`?
2. ¿Permiso para publicar trazas reales anonimizadas? Sin él, los vectores se quedan con trazas sintéticas.
3. Licencia: MIT (máxima adopción) o Apache-2.0 (protege patentes).
4. ¿Nombre `rutaviva` o uno en inglés para el alcance global (`routeline`, `onroute`)?
