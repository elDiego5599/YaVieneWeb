# rutaviva — tickets

Salen de [spec.md](spec.md). Cada ticket se cierra entero, con prueba roja → verde
(vara de calidad de `CLAUDE.md`). Etiquetas como en el plan: `[YA]`, `[DUEÑO]`,
`[BLOQUEADA: X]`. Tamaño: S ≤ ½ día, M ≈ 1–2 días, L ≈ 3–5 días.

| # | Ticket | Depende de | Tamaño | Etiqueta |
|---|---|---|---|---|
| R0 | Decisiones del dueño: repo, licencia, nombre, permiso de trazas (spec §11) | — | S | [DUEÑO] |
| R1 | Esqueleto del repo | R0 | S | [BLOQUEADA: R0] |
| R2 | Formato de vectores y su corredor en Dart y TS | R1 | M | |
| R3 | `prepararRuta` + `proyectar` (global, con índice por celdas) | R2 | M | |
| R4 | `Seguidor.reportar`: ventana y desempate por rumbo | R3 | L | |
| R5 | Avance monótono y vuelta de circular | R4 | M | |
| R6 | `Seguidor.en`: extrapolar y frenar | R5 | M | |
| R7 | Estados y `fueraDeRuta` con reenganche | R4 | M | |
| R8 | `distanciaHasta` | R5 | S | |
| R9 | Pruebas de propiedades y trinquete de cobertura | R5–R8 | M | |
| R10 | Trazas reales anonimizadas como vectores | R0, R2 | M | [DUEÑO] |
| R11 | Banco de rendimiento en CI | R6 | M | |
| R12 | Página de pruebas | R6, R10 | L | |
| R13 | Documentación y ejemplos (flutter_map, MapLibre, Leaflet, GTFS-RT) | R8 | M | |
| R14 | Publicar 0.1.0 en pub.dev y npm | R9, R11, R13 | S | [DUEÑO] |
| R15 | Artículo técnico (es + en) | R12 | M | |
| R16 | Integrarlo en la app pasajero | R14 | M | [DUEÑO: capturas] |
| R17 | Integrarlo en el mapa en vivo de la web | R14 | M | [DUEÑO: capturas] |

---

### R0 · Decisiones del dueño
Responder spec §11:
- dueño del repo;
- licencia;
- nombre;
- permiso para usar trazas reales.

**Hecho cuando:** las cuatro respuestas están escritas en spec §11.

### R1 · Esqueleto
- Crear `dart/` (paquete con `lints` estricto), `ts/` (ESM, `tsc --strict`, Vitest), `vectores/`, LICENSE, README mínimo.
- CI con dos jobs: `dart analyze --fatal-infos && dart test`, y `npm run typecheck && npm test`.

**Hecho cuando:** CI verde con una prueba trivial en cada lado, y una prueba que falla de propósito pone la CI en rojo.

### R2 · Vectores compartidos
- Esquema JSON de spec §6 con validador (JSON Schema). Un vector mal formado falla en los dos corredores.
- Un corredor por lenguaje que lee `vectores/*.json`, ejecuta `pasos` y compara con `[valor, tolerancia]`.

**Hecho cuando:** un vector de ejemplo pasa en los dos lados, y el mismo vector con la espera cambiada falla en los dos.

### R3 · `prepararRuta` y `proyectar`
- Largos acumulados.
- Coordenadas locales con origen en el centro de la ruta.
- Índice por celdas de 200 m.
- `circular` deducido (< 50 m entre inicio y fin) o explícito.
- Rutas degeneradas: lanzar error con mensaje claro, o devolver `null`, según la spec.

**Vectores:** recta, L, esquina cerrada, puntos repetidos, un solo punto.

**Hecho cuando:** el avance y el desvío coinciden con la referencia haversine con error < 0,1 %, en Dart y en TS.

### R4 · `reportar` con ventana
- Ventana `[avance − 50, avance + vMax·Δt + 100]`, con vuelta.
- Empate a < 15 m: decide el rumbo. Sin rumbo, `pendiente` hasta el segundo reporte.
- Reportes duplicados, desordenados o con `t` futuro se descartan sin mover nada.

**Prueba roja clave:** el vector «ida y vuelta por la misma calle». Con proyección al tramo más cercano (lo que hace hoy `geo.dart`) sale el sentido equivocado; con R4, el correcto.

### R5 · Avance monótono
- `toleranciaRetroceso` 30 m.
- Retroceso sostenido (2 reportes) aceptado con transición suave.
- Paso final → inicio en circular suma `vuelta`.

**Prueba roja clave:** vector del hallazgo 9 de la web. El punto queda junto al arranque y el avance cruza `t = 1 → 0`; no puede haber caída.

### R6 · `en(ahora)`
- Velocidad suavizada (α = 0.4).
- Extrapolar hasta 8 s y frenar con curva suave.
- Nunca pasar de `vMax·Δt`.
- Reporte que llega detrás de lo extrapolado: se espera, no se retrocede.

**Vectores:** esquina doblada (la posición nunca sale de la polilínea), hueco de 20 s y reporte tardío.

### R7 · Estados
`enVivo` / `senalVieja` / `sinSenal` según `viejoMs` / `perdidoMs`. `fueraDeRuta` tras 3 reportes a más de 60 m, y búsqueda global para reenganchar.

**Vectores:** hueco de 2 min, hueco de 10 min, desvío de 300 m por obra y vuelta.

### R8 · `distanciaHasta`
Distancia por la ruta, con vuelta en circulares. `null` si el punto queda a más de 300 m de la ruta, o si ya se pasó en una ruta abierta.

**Prueba roja clave:** punto a 400 m en línea recta pero a 3 km por la ruta. Debe dar ~3 km.

### R9 · Propiedades y cobertura
- fast-check (TS) y glados (Dart): con cualquier secuencia de reportes sobre la ruta y ruido de ±25 m, `avance + vuelta·largo` nunca baja más de 30 m, y `en` nunca sale de la ruta.
- Trinquete de cobertura ≥ 95 % de líneas y ramas, que solo sube.

**Hecho cuando:** una mutación que quita la tolerancia de retroceso pone en rojo la prueba de propiedades.

### R10 · Trazas reales [DUEÑO]
Script en el backend que exporta un día de una ruta:
- sin placa ni empresa;
- hora desplazada a un origen 0;
- coordenadas sin tocar (son la vía pública).

Revisión del dueño antes de subir.

**Hecho cuando:** hay al menos 3 trazas como vectores, con lo esperado anotado a mano en 5 puntos difíciles cada una.

### R11 · Banco de rendimiento
- Medidas de spec §7 con `tinybench` (TS) y `benchmark_harness` (Dart).
- Línea base guardada; la CI falla si algo empeora más del 10 %.
- TS < 4 KB gzip, medido con `size-limit`.

**Hecho cuando:** un `for` deliberadamente cuadrático pone la CI en rojo.

### R12 · Página de pruebas
- Vite + MapLibre o Leaflet con CARTO Voyager.
- Una traza real reproducida con tres capas: crudo, lineal y rutaviva.
- Deslizadores de ruido, frecuencia y velocidad de reproducción.
- Se publica en GitHub Pages.

**Hecho cuando:**
- hay pruebas e2e (Playwright) de que las capas se dibujan y los deslizadores cambian lo pintado, sin `pageerror`;
- la página corre en un móvil de gama baja a 60 fps.

### R13 · Documentación
- README con un GIF de la comparación.
- Guías: «tu bus salta hacia atrás», «tu bus corta esquinas», «distancia por la ruta».
- Ejemplos ejecutables en `ejemplos/`: flutter_map, MapLibre, Leaflet y GTFS-Realtime.
- Cada ejemplo compila en CI.
- Comentario en cada valor por defecto justificando el número.

### R14 · Publicar 0.1.0 [DUEÑO]
- `dart pub publish --dry-run` y `npm publish --dry-run` limpios.
- CHANGELOG.
- Tag `v0.1.0`.

La publicación de verdad la hace el dueño, con su cuenta.

### R15 · Artículo
«Por qué tu bus salta hacia atrás (y cómo lo arreglamos en Barranquilla)», en español e inglés, con la página de pruebas incrustada. El dueño lo revisa antes de publicar.

### R16 · App pasajero [DUEÑO: capturas]
- `map_bus_animator.dart` y `projectOntoPolyline` pasan a `rutaviva`.
- `route_reach_provider.dart` usa `ruta.proyectar`.
- Pruebas actuales en verde, más una prueba nueva por síntoma de spec §1.
- Build Android **e** iOS con `--dart-define=BACKEND_URL=...`.
- Capturas antes y después para que el dueño apruebe.

### R17 · Web, mapa en vivo [DUEÑO: capturas]
- `src/mapa-vivo.ts` mueve el bus con `Seguidor`, lo que cierra el hallazgo 9.
- Presupuesto de JS medido antes: está al 100 %, así que si no cabe se decide qué sale.
- typecheck, Vitest, Playwright entero y presupuesto en verde.
- Capturas antes y después.
