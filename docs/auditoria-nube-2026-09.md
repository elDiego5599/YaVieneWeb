# Auditoría de YaVieneWeb — 2026-09-29

Auditoría de punta a punta de `main` en `a1ac661`, **solo de lectura**:
no se cambió código. Se leyó todo `src/` (22 módulos), los cinco HTML,
`vite.config.ts`, `vercel.json`, los workflows, `scripts/` y las pruebas.
Las sospechas se comprobaron con sondas de Vitest y de Playwright escritas
fuera del repo (Chromium instalado, proyectos `movil` = Pixel 7 y
`escritorio` = 1440×900, contra la build de producción en el puerto 4174).

Cada hallazgo lleva `archivo:línea`, gravedad, qué pasa, cómo comprobarlo
y el arreglo propuesto. Gravedad: **P0** rompe el producto o la seguridad;
**P1** rompe una función principal para una parte grande del público;
**P2** fallo real con impacto acotado; **P3** menor, deuda o fragilidad.

## Resumen

| Gravedad | Cuántos |
|---|---|
| P0 | 0 |
| P1 | 1 |
| P2 | 7 |
| P3 | 10 |
| **Total** | **18** |

| # | Grav. | Área | Hallazgo |
|---|---|---|---|
| 1 | P1 | Lógica | El primer toque en el menú, en Android, lo abre y lo cierra en el mismo gesto |
| 2 | P2 | Estados | El formulario enseña a la vez «Te abrimos WhatsApp» y «No pudimos enviar» |
| 3 | P2 | Lógica | En el móvil, bajar la página con el dedo sobre el mapa mueve el punto de espera |
| 4 | P2 | Datos | Las dos terminales de cada ruta caen en el mismo punto; la terminal B no se dibuja |
| 5 | P2 | Rendimiento | `encajarEscena` fuerza 10 maquetas de la página al arrancar (130–155 ms) |
| 6 | P2 | Accesibilidad | Los teléfonos de «Cómo funciona» se leen enteros con lector de pantalla |
| 7 | P2 | Accesibilidad | El mapa se maneja con flechas, pero su rol es `img` |
| 8 | P2 | Pruebas | `NavIsland` no tiene ni una prueba de comportamiento |
| 9 | P3 | Lógica | Mapa en vivo: con el punto junto al arranque, el bus salta 750 m atrás en bucle |
| 10 | P3 | Estados | `is-pulsado` se queda pegado si el paso se apaga justo tras un toque |
| 11 | P3 | Código muerto | `ContactForm` viaja en el JavaScript de la portada, que no tiene formulario |
| 12 | P3 | Código muerto | `PhoneSimulator` y el teléfono del hero arrastran el simulador interactivo que ya no existe |
| 13 | P3 | Código muerto | Cuatro `destroy()` que no llama nadie |
| 14 | P3 | Pruebas | La prueba de la pista del chip puede pasar sin comprobar nada |
| 15 | P3 | Pruebas | «Topado en 5» se prueba con 4 filas: el tope nunca se ejerce |
| 16 | P3 | Seguridad | `preview.allowedHosts` abre el preview a `*.trycloudflare.com` |
| 17 | P3 | Rendimiento | Seis oyentes de `resize` miden la maqueta en el acto, sin esperar al cuadro |
| 18 | P3 | Accesibilidad | El botón del paso activo no lo anuncia (`is-activa` sin `aria-current`) |

---

## P1

### 1. El primer toque en el menú, en Android, lo abre y lo cierra en el mismo gesto

- **Dónde:** `src/nav-island.ts:45` (el `click` alterna) y `src/nav-island.ts:63-64` (el `focusin` abre).
- **Qué pasa:** en Chrome de Android, tocar un botón le da el foco antes de que llegue el `click`.
  1. El `focusin` de la isla abre el menú.
  2. Acto seguido, el `click` lo encuentra abierto (`#abierta === true`) y lo cierra.

  El que toca no ve nada. Con el foco ya en el botón, el segundo toque no dispara `focusin` y ahí sí abre. El menú principal falla en el primer intento en la plataforma a la que va la página. En iOS Safari no pasa, porque no enfoca los botones al tocarlos.
- **Cómo comprobarlo:** en Playwright, con el proyecto `movil` (Pixel 7), `page.locator('.nav-island-toggle').tap()` y leer la clase `is-open` de `.nav-island`.

  | Toque | `is-open` | `document.activeElement` |
  |---|---|---|
  | Primero | `false` | `nav-island-toggle` |
  | Segundo | `true` | — |
- **Arreglo propuesto:** que `focusin` abra solo con foco de teclado. Por ejemplo, ignorarlo si `e.target` no cumple `:focus-visible`, o si hubo un `pointerdown` en la isla justo antes. Añadir una prueba e2e de toque en `movil` (ver hallazgo 8).

## P2

### 2. El formulario enseña a la vez «Te abrimos WhatsApp» y «No pudimos enviar»

- **Dónde:** `src/contact-form.ts:54`, `:76-77` y `:147`; `empresas.html:604-611`.
- **Qué pasa:** el panel de éxito se destapa y no se vuelve a tapar nunca, y el formulario sigue a la vista con los campos vacíos. Si se envía otra vez y falla (ventana bloqueada, servidor caído), `#mostrarError` destapa el error, pero el éxito anterior se queda. Resultado: un panel dice «Te abrimos WhatsApp» y otro, justo encima, «No pudimos enviar la solicitud».

  Además, el comentario de `empresas.html:604` («sale donde estaba el formulario») y el de `contact-form.ts:151` («el formulario que acaba de desaparecer») describen un ocultado que el código no hace.
- **Cómo comprobarlo:** en Vitest con happy-dom:
  1. Montar el formulario.
  2. Simular con `window.open` una ventana y enviar: sale el éxito.
  3. Simular con `window.open` un `null` y enviar otra vez.

  Queda `#form-success.hidden === false` y `#form-error.hidden === false`, con el texto de error. Ninguna prueba cubre la secuencia éxito → fallo.
- **Arreglo propuesto:** al empezar `#enviar`, esconder `#exito` junto con el error. Decidir si el formulario se oculta al acertar, que es lo que dicen los comentarios, y alinear código y comentarios. Añadir una prueba de éxito seguido de fallo.

### 3. En el móvil, bajar la página con el dedo sobre el mapa mueve el punto de espera

- **Dónde:** `src/mapa-vivo.ts:194` (oyente `pointerdown`) y `:345-352`; `src/css/componentes/mapa.css:287` (`touch-action: manipulation`, que deja desplazar).
- **Qué pasa:** el punto se coloca en el `pointerdown`, y en táctil ese evento llega al apoyar el dedo, antes de saber si el gesto es un toque o un desplazamiento. Quien baja la página y apoya el dedo sobre el mapa (que ocupa casi todo el ancho del móvil) le mueve el punto sin querer. De paso, el aviso se reinicia. También lo mueve el botón derecho o el central del ratón.
- **Cómo comprobarlo:** en Playwright `movil`, un arrastre táctil vertical por CDP (`Input.dispatchTouchEvent`: `touchStart` sobre el mapa y seis `touchMove` de 40 px hacia arriba). La página se desplaza, y el `transform` de `.mv-pin` pasa de `translate(324.2 1228.3)` a `translate(-264.5 1941.2)`.
- **Arreglo propuesto:** poner el punto en `click`, que el navegador no emite si el gesto fue un desplazamiento. Si no, usar `pointerup` con un umbral de movimiento desde el `pointerdown`. Filtrar además `e.button !== 0`.

### 4. Las dos terminales de cada ruta caen en el mismo punto; la terminal B no se dibuja

- **Dónde:** `scripts/gen_mapa_landing.py:332` (`"extremos": [list(simple[0]), list(simple[-1])]`) y `src/data/rutas-landing.ts:40`, `:49`, `:58`, `:67`, `:76` y `:85`.
- **Qué pasa:** los recorridos de `rutas.json` son circulares: ida y vuelta, y acaban donde empiezan. El generador toma como «extremos» el primer y el último punto de la polilínea, así que las dos terminales salen en el mismo sitio:
  - R-105 y R-106: los dos pares son idénticos.
  - R-101 a R-104: los dos puntos están a 5 unidades (unos 32 m) uno del otro.

  En el mapa en vivo y en los teléfonos se ven dos círculos encimados en la salida, y la otra terminal (Uninorte, La Playa, El Silencio…) no se marca en ninguna ruta. `src/types.ts` promete otra cosa: «Los dos extremos del recorrido, para dibujar las terminales».
- **Cómo comprobarlo:** en Playwright, sobre la portada, `.mv-terminales circle` devuelve `["411,2604","411,2604"]`. `tests/mapa.test.ts` solo comprueba que los extremos caen dentro del viewBox, no que sean distintos.
- **Arreglo propuesto:** que el generador saque la terminal B de `rutas.json`, de las paradas o terminales si las trae. Si no las trae, que use el punto más alejado de la salida siguiendo el recorrido. Añadir a `tests/mapa.test.ts` que los dos extremos de cada ruta disten más de un mínimo (por ejemplo, 50 unidades).

### 5. `encajarEscena` fuerza 10 maquetas de la página al arrancar (130–155 ms)

- **Dónde:** `src/encaje.ts:73-76` (`probar` escribe `--encaje` y lee `getBoundingClientRect`), `:129-146` (bisección de `CORTES = 8`, `:39`) y `:175` (medida síncrona al montar).
- **Qué pasa:** cada `probar` cambia el `zoom` de la escena y lee su caja, así que el navegador rehace la maqueta en el acto. Al arrancar son 10 maquetas seguidas dentro de `arrancar()`. Es la mayor parte de la única tarea larga del arranque.
- **Cómo comprobarlo:** en Playwright, envolviendo `Element.prototype.getBoundingClientRect` antes de cargar, con esta configuración de escritorio: 1440×900, sin frenar la CPU.

  | Proyecto | Maquetas | Tiempo | Tarea larga total (`PerformanceObserver`, tipo `longtask`) |
  |---|---|---|---|
  | `movil` | 10 | 130 ms | 215 ms |
  | `escritorio` | 10 | 155 ms | 242 ms |

  El perfil de CPU atribuye 135 ms de `getBoundingClientRect` a `probar` ← `medir`. En un Android de gama media, con la CPU entre 4 y 6 veces más lenta, eso son varios cientos de milisegundos de hilo bloqueado en la primera carga.
- **Arreglo propuesto:**
  - Partir de una estimación: la regla de tres que ya se descartó, pero como punto de partida y no como respuesta.
  - Refinar con 2 o 3 pruebas, o bajar a unos 5 cortes: una tolerancia de 0,01 basta, porque el resultado se redondea hacia abajo.
  - Hacer la primera medida en `requestAnimationFrame`, después del primer pintado.
  - Valorar `contain: layout` en la escena para que cada maqueta sea local.

### 6. Los teléfonos de «Cómo funciona» se leen enteros con lector de pantalla

- **Dónde:** `index.html:985`, `:1101` y `:1315` (las tres `.paso-toma`, sin `aria-hidden`); compárese con `index.html:279` (`.hero-scene aria-hidden="true"`).
- **Qué pasa:** el hero esconde sus teléfonos a los lectores de pantalla, pero los tres de los pasos no. El lector recorre:
  - el reloj falso «7:23»;
  - «Ruta activa C16 Calle 72 Uninorte» y «Localizando tu ubicación…»;
  - las listas del selector, con empresas y rutas;
  - «Avisarme cuando esté cerca»…

  Encima, el guion cambia esos textos solo, varias veces por segundo en el paso 3. Y los íconos SVG sin nombre salen como `img` vacíos. Lo que cuentan los teléfonos ya está en texto en los botones de los pasos (`index.html:1467-1491`).
- **Cómo comprobarlo:** `page.locator('[data-pasos-columnas]').ariaSnapshot()` en `movil` devuelve `text: 7:23`, `text: Ruta activa C16 Calle 72 Uninorte`, `text: Localizando tu ubicación…` y siete `img` sin nombre.
- **Arreglo propuesto:** `aria-hidden="true"` en cada `.paso-marco`, o en `.pasos-pase`, como en el hero. No hay nada enfocable dentro, así que no hace falta `inert`.

### 7. El mapa se maneja con flechas, pero su rol es `img`

- **Dónde:** `index.html:1841` (`<svg … role="img" tabindex="0" aria-label="… Con las flechas mueves tu punto …">`) y `src/mapa-vivo.ts:195` y `:367-377`.
- **Qué pasa:** `img` es un rol estático. Con NVDA o JAWS en modo lectura, el lector se queda las flechas para recorrer el texto y no pasa a modo foco sobre una imagen, así que la tecla no llega al `keydown` del SVG. Justo el público para el que se escribió el manejo con teclado («o con un lector de pantalla, que no apunta a coordenadas», `mapa-vivo.ts:357`) es el que no puede usarlo. Con teclado y sin lector sí funciona.
- **Cómo comprobarlo:** con NVDA en Chrome, tabular hasta el mapa y pulsar la flecha derecha: NVDA lee el siguiente elemento y el anuncio de `[data-mapa-voz]` no sale. En el código: el rol del elemento que atiende las flechas no es interactivo.
- **Arreglo propuesto:** un rol que pida modo foco. La opción natural es `role="slider"`, con `aria-valuemin`, `aria-valuemax` y `aria-valuenow` (el avance del punto, 0–100) y un `aria-valuetext` como «Bus B-042 a 1,2 km». `role="application"` también serviría, con su `aria-roledescription`.

### 8. `NavIsland` no tiene ni una prueba de comportamiento

- **Dónde:** `src/nav-island.ts` (todo el módulo); `vite.config.ts:213` («**Hueco declarado**»); `tests/legales-sitio.test.ts:64`.
- **Qué pasa:**
  - Ni Vitest ni Playwright abren, cierran o tocan la isla.
  - La única referencia es `expect(ts).toMatch(/new NavIsland\(/)`, que busca el texto en el fuente.
  - El trinquete de cobertura solo mide los módulos que importa alguna prueba, así que este no cuenta.

  Así llegó a `main` el hallazgo 1, en el menú de todas las páginas. Pasa lo mismo con `Problema`, `MapaVivo` y `PasoFoco`: fuera de las e2e de maquetación, su lógica no la ejerce ninguna prueba.
- **Cómo comprobarlo:** buscar `nav-island-toggle`, `is-open` y `NavIsland` en `tests/` y `e2e/`: solo aparece en `legales-sitio.test.ts:42` y `:64`, y como texto.
- **Arreglo propuesto:** una e2e de la isla en los dos proyectos: abrir y cerrar con toque, puntero, Escape y clic fuera, y la marca `aria-current` al desplazar. Una prueba de Vitest para el pestillo de Escape y el cierre con margen.

## P3

### 9. Mapa en vivo: con el punto junto al arranque, el bus salta 750 m atrás en bucle

- **Dónde:** `src/mapa-vivo.ts:493-511` (`if (bus.t > 1) { … vuelta = true }` y `if (vuelta || …) this.#reponerBuses()`).
- **Qué pasa:**
  - Los recorridos son circulares (hallazgo 4), así que pasar de `t = 1` a `t = 0` no es un salto en el mapa.
  - Aun así, el código trata cualquier vuelta como el fin de la escena y recoloca los dos buses detrás del punto.
  - Si el punto está en los primeros ~1,8 km del recorrido, el bus nace antes del final y llega a él antes de alcanzar el punto: se recoloca otra vez, en bucle.

  Nunca pasa por el punto, y cada 11 s salta de golpe hacia atrás. El aviso sí salta, porque se mide en línea recta.
- **Cómo comprobarlo:** en Playwright `escritorio`, hacer clic sobre el punto del recorrido de la C16 en `t = 0.01` y muestrear el `transform` del primer `.mv-bus` cada 500 ms. Pasa de `translate(417.2 2598.6)` a `translate(533.3 2587.5)`: 116 unidades, unos 750 m, en medio segundo. El patrón se repite con periodo de unos 11 s.
- **Arreglo propuesto:** dejar que `t` dé la vuelta sola (`bus.t %= 1`) y recolocar solo con `lejos && pasados`.

### 10. `is-pulsado` se queda pegado si el paso se apaga justo tras un toque

- **Dónde:** `src/paso-demo.ts:235-236` (la clase se quita con un reloj de `#a`), `:192-196` (`#parar` borra todos los relojes) y `:288` (`#reposo` no la quita).
- **Qué pasa:** si `activar(false)` llega en los 240 ms que siguen a un toque del guion (al cambiar de paso con la rueda), el reloj que iba a quitar `is-pulsado` se borra. La ficha, el selector o el botón se queda pintado como pulsado mientras el paso esté quieto, y al volver arranca la vuelta con esa pieza hundida.
- **Cómo comprobarlo:** en Vitest con relojes falsos, como en `tests/paso-demo.test.ts`:
  1. `montarDemo(2)` y `activar(true)`.
  2. Avanzar 1610 ms: el toque sobre `sel-empresa` es a los 1600.
  3. `activar(false)`.

  `[data-el="sel-empresa"]` sigue con `is-pulsado`.
- **Arreglo propuesto:** en `#reposo`, quitar `is-pulsado` de todo lo que haya en `#raiz`.

### 11. `ContactForm` viaja en el JavaScript de la portada, que no tiene formulario

- **Dónde:** `src/main.ts:22` y `:103-104`.
- **Qué pasa:** `index.html` no tiene `#contact-form`: el formulario vive solo en `empresas.html`. Aun así, `main.ts` importa `ContactForm`. El empaquetador lo mete en el trozo compartido `scroll-effects-*.js`, que la portada descarga en su primera visita, y `querySelector` devuelve `null` siempre.
- **Cómo comprobarlo:**
  - `grep -c contact-form index.html` da `0`.
  - Tras `npm run build`, la cadena «Enviando» está en `dist/assets/scroll-effects-*.js`, que cargan `index.html` y `empresas.html`.
- **Arreglo propuesto:** quitar el import y las dos líneas de `main.ts`. `empresas.ts` ya lo monta por su cuenta.

### 12. `PhoneSimulator` y el teléfono del hero arrastran el simulador interactivo que ya no existe

- **Dónde:** `src/phone-simulator.ts`, en tres puntos:
  - Constantes y comentario: `:43` (`CHIPS` con una sola clave), `:114` (`#VISTAS_SELECTOR`), `:116` (comentario que describe otro campo: «Fracción de la ventana…» sobre `#avisoActivo`).
  - Ramas que no se toman: `:190` (`#pintarRutas`), `#pintarEmpresas`, `:349` (`#setPildora(null)`, que nadie llama), `#setSelector(false, …)` y `:441` (`#colorUrgencia`, con el bus fijo a 940 m: solo se usa la rama ámbar).
  - HTML sin usar: `index.html:683-828` (vistas `empty`, `selector`, `companies` y `routes` del teléfono del hero).
- **Qué pasa:** el módulo dice «sin guion, sin bucle y sin interacción» y solo llama a `#mostrarVista('eta')`. Aun así:
  - construye las dos listas del selector en vistas que nunca se enseñan;
  - conserva las ramas de ruta vacía, selector abierto y distancia verde o coral;
  - la portada lleva unas 145 líneas de HTML de vistas ocultas.
- **Cómo comprobarlo:** buscar las llamadas: `#mostrarVista` solo recibe `'eta'`, y `#setSelector` solo recibe `(true, ruta)`. En el navegador, dentro de `#phone`, solo `data-view="eta"` llega a tener `active`.
- **Arreglo propuesto:** reducir `PhoneSimulator` a la escena fija y quitar del HTML del hero las cuatro vistas que no se ven. Antes, comprobar que ninguna prueba de coherencia de textos dependa de ellas.

### 13. Cuatro `destroy()` que no llama nadie

- **Dónde:** `src/reposo.ts:36`, `src/scroll-effects.ts:119`, `src/mapa-vivo.ts:213` y `src/problema.ts:202`.
- **Qué pasa:** ni `src/` ni las pruebas llaman a estos métodos. Las piezas se montan una vez por página y no se desmontan. Se diferencian de `PasoDemo.destroy`, que sí usan las pruebas.
- **Cómo comprobarlo:** buscar `.destroy()` en `src/`, `tests/` y `e2e/`: solo aparecen `demo.destroy()` y `this.#mapa.destroy()`.
- **Arreglo propuesto:** borrarlos, o cubrirlos con una prueba si se quieren conservar como API.

### 14. La prueba de la pista del chip puede pasar sin comprobar nada

- **Dónde:** `tests/paso-demo.test.ts:219`.
- **Qué pasa:** la aserción va dentro de `if (f.chip && f.localizando)`. Si el guion cambia y ningún cuadro tiene a la vez el chip encendido y «Localizando…», el bucle no afirma nada y la prueba pasa en verde. Justo ese es el caso que debería vigilar.
- **Cómo comprobarlo:** cambiar el texto de `src/paso-demo.ts:304` por otro: esta prueba sigue en verde; la que avisa es otra, `recoge el punto y vuelve a empezar el bucle`, que compara el texto.
- **Arreglo propuesto:** añadir `expect(fotos.some((f) => f.chip && f.localizando)).toBe(true)` antes del bucle.

### 15. «Topado en 5» se prueba con 4 filas: el tope nunca se ejerce

- **Dónde:** `tests/selector-escalonado.test.ts:12-18`.
- **Qué pasa:** la prueba mide `carrilEmpresas()`, que tiene 4 filas (`--i` de 0 a 3), así que `every(t <= 5)` se cumple aunque se borre el `Math.min(i, 5)` de `src/selector.ts:155`.
- **Cómo comprobarlo:** quitar el `Math.min` de `selector.ts:155`: la prueba sigue en verde.
- **Arreglo propuesto:** medirlo con `carrilRutas()` y al menos 8 rutas de prueba, y exigir `['0','1','2','3','4','5','5','5']`.

### 16. `preview.allowedHosts` abre el preview a `*.trycloudflare.com`

- **Dónde:** `vite.config.ts:271`.
- **Qué pasa:** la protección de Vite contra DNS rebinding se abre a cualquier subdominio de `trycloudflare.com`, para «las demos por túneles de Cloudflare». Choca con la regla 3 de `CLAUDE.md`: ngrok como túnel primario y nada de `cloudflared`. Deja abierto un camino que el proyecto ya no usa, y no cubre el que sí usa.
- **Cómo comprobarlo:** en `vite.config.ts:266-272`, el único host permitido es `.trycloudflare.com`.
- **Arreglo propuesto:** quitar la entrada. Si hace falta un túnel, poner el host exacto en una variable de entorno local y no un comodín en el repo.

### 17. Seis oyentes de `resize` miden la maqueta en el acto, sin esperar al cuadro

- **Dónde:** `src/phone-map.ts:232` (uno por instancia: cinco en la portada) y `src/mapa-vivo.ts:196`.
- **Qué pasa:** cada `resize` dispara en seguida `#medir`, que lee `getBoundingClientRect` y reescribe marcadores, seis veces por evento. El propio repo dice que la barra de direcciones del móvil dispara `resize` en cada tirón de scroll (`src/encaje.ts:107`). `nav-island.ts`, `paso-foco.ts` y `encaje.ts` ya agrupan con `requestAnimationFrame`; estos dos no.
- **Cómo comprobarlo:** en la portada, con Performance, emular un cambio de alto de la ventana y ver seis lecturas de caja forzadas por evento.
- **Arreglo propuesto:** agrupar con `requestAnimationFrame`, como en `nav-island.ts`, o con un único oyente compartido.

### 18. El botón del paso activo no lo anuncia (`is-activa` sin `aria-current`)

- **Dónde:** `src/main.ts:204` e `index.html:1467-1491`.
- **Qué pasa:** el paso encendido se marca solo con una clase. Quien usa lector de pantalla no sabe cuál de los tres está mostrando la sección. La isla ya resuelve lo mismo con `aria-current` (`nav-island.ts`).
- **Cómo comprobarlo:** en el árbol de accesibilidad, los tres `.paso-boton` salen iguales sea cual sea el paso activo.
- **Arreglo propuesto:** `aria-current="step"` en el activo y quitarlo de los otros, en la misma línea que alterna la clase.

---

## Revisado sin hallazgos

- **Seguridad:**
  - La CSP de `vercel.json` es estricta: sin `unsafe-inline`, sin `data:` y con `frame-ancestors 'none'`. No hay ni un `style="…"` en los HTML.
  - Todos los `innerHTML` son constantes. Los textos de datos entran por `textContent` (lo prueban `tests/selector-listas.test.ts` y `tests/rutas-cifras.test.ts`).
  - WhatsApp se abre con `encodeURIComponent` y cortando `opener`.
  - `npm audit`: 0 vulnerabilidades.
  - Los workflows van clavados a SHA y con `contents: read`.
  - Ningún `.env` está versionado.
- **Fugas:** los bucles de `requestAnimationFrame` (`PasoDemo`, `MapaVivo`) se paran al salir de pantalla, y los relojes del guion se limpian en cada vuelta. No crece ninguna lista.
- **Foco visible:** todos los controles tienen `:focus-visible` (`src/css/accesibilidad.css` y los componentes). No hay `user-scalable=no`, y el hero oculto no tiene nada enfocable.
- **Identificadores:** ningún `id` repetido en la portada ni en empresas (comprobado en el DOM ya montado).
