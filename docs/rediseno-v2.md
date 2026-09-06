# Rediseño v2 — «La página es una ruta»

Plan para darle a la web una identidad propia, no una plantilla mejor pintada.
Sustituye a `docs/rediseno.md`, que sigue en el repositorio como registro de lo
que se hizo y de por qué no bastó. Todo el trabajo va en `prueba`.

Rumbo decidido: **editorial claro y brutal** (la crema se queda, la blandura no)
y **movimiento alto sin WebGL** (CSS moderno y JavaScript ligero).

---

## 0. Autopsia de la v1: por qué se ve básica

Conviene decirlo sin adornos, porque el plan entero sale de aquí.

**a) Todo es la misma pieza.** Tarjeta blanca, borde de 1 px, esquinas de 20 px,
sombra suave. Las preguntas, los estados, los pasos, la cobertura y la portada
de empresas son literalmente el mismo objeto repetido con distinto texto. Ese
objeto es el más común de internet: es el aspecto por defecto de cualquier
plantilla, y ninguna cantidad de contenido bueno lo salva.

**b) Hay una sola animación.** Todo lo que aparece hace lo mismo: opacidad de 0
a 1 y 24 px de subida, 700 ms, la misma curva. Eso no es un sistema de
movimiento, es un efecto aplicado a todo por igual. Cuando cada pieza entra
igual que la anterior, el ojo deja de mirar a los tres segundos.

**c) Todo está centrado.** Titular centrado, texto centrado, botones centrados,
rejilla simétrica. La simetría es la decisión que no exige ninguna decisión, y
se nota.

**d) No hay ni un momento memorable.** No existe una sola cosa en la página que
alguien pueda describir después: ni una transición, ni una pieza que reaccione,
ni una idea visual que sea nuestra y de nadie más.

**e) La tipografía es grande, no es fuerte.** Bricolage a 92 px sigue siendo
Bricolage en su ajuste de fábrica: peso 900, centrado, con aire de sobra
alrededor. Una tipografía manda cuando se aprieta, se corta, se sale del
formato o se rompe en dos pesos distintos. Aquí sólo se agranda.

**f) El producto está encerrado.** Lo único que se ve realmente bien de todo
esto —el mapa, las pantallas del teléfono, el panel de control— está dentro de
cajitas con marco, del tamaño de una postal, rodeado de aire. El material bueno
está tratado como una ilustración de acompañamiento.

**g) El color es un acento, no una identidad.** Verde sobre crema, y ya. Ni un
bloque de color plano, ni una página en negativo, ni un contraste duro en toda
la bajada.

---

## 1. La idea: la página es una ruta

Una identidad se sostiene sobre una idea, no sobre una paleta.

La idea es esta: **la web se comporta como una ruta de bus.** No como metáfora
decorativa —nada de dibujitos de carretera—, sino como estructura literal:

- La página tiene **paradas numeradas**, no secciones. Se rotulan como se
  rotulan las rutas de verdad: `01 · EL MAPA`, `02 · CÓMO FUNCIONA`,
  `03 · COBERTURA`. En tipografía monoespaciada, pequeñas, en el margen.
- Una **línea de ruta** de 2 px recorre el margen izquierdo de toda la página de
  arriba abajo. En cada parada hace un nodo. Un punto verde —el bus— baja por
  esa línea al ritmo exacto del scroll: es la barra de progreso y es el motivo
  de marca al mismo tiempo. Se dibuja con SVG y se mueve con `scroll()`, sin
  JavaScript en el hilo principal.
- Al llegar a cada parada, el nodo **se enciende** y el rótulo de la parada se
  escribe. Bajar por la página es hacer el recorrido.
- El menú superior deja de ser una isla flotante genérica y pasa a ser el
  **letrero de ruta**: la lista de paradas con la actual marcada, como el
  cartel del interior de un bus.

Eso da tres cosas que hoy no existen: una razón para que las secciones no se
parezcan entre sí, un elemento gráfico propio que se repite y se reconoce, y una
respuesta a «¿qué recuerdas de esa página?».

---

## 2. Identidad

### 2.1 El principio: nada blando

Se prohíben, en toda la página, tres cosas que hoy están por todas partes:

1. **La tarjeta.** Fuera los rectángulos de esquinas redondas con borde y
   sombra. Lo que separa bloques es una **línea de 1 px** o un **campo de color
   plano** que llega hasta el borde de la ventana.
2. **La sombra.** No hay una sola sombra en la página, con una excepción: las
   pantallas del producto (los teléfonos, el mapa, el panel), que sí flotan
   porque son objetos y deben leerse como tales.
3. **El radio.** El radio de esquina baja a 0 en todo lo que es página. Se
   conserva únicamente donde es producto: los teléfonos, el mapa, las píldoras
   de la app. Ese contraste —página cuadrada, producto redondeado— hace que el
   producto se despegue solo, sin marco.

### 2.2 Color

La crema se queda, pero deja de ser el fondo de todo y pasa a ser **uno de
cinco campos**. La página alterna campos enteros, de borde a borde:

| Campo | Valor | Dónde |
|---|---|---|
| Crema | `#FAF6F0` | fondo por defecto, portada, texto largo |
| Tinta | `#0B1628` | paradas en negativo: el problema, el cierre |
| Verde | `#00A859` | un campo entero, una vez, en «cobertura» |
| Coral | el que ya usa el problema | acentos y una franja |
| Blanco | `#FFFFFF` | sólo bajo producto: mapa y pantallas |

La regla nueva: **cada parada tiene su campo, y dos paradas seguidas nunca
comparten el mismo.** Bajar por la página es pasar de crema a tinta a verde a
crema. Hoy son cinco cremas seguidas, y eso es exactamente lo que se siente al
bajar: que no pasa nada.

El verde deja de ser sólo el color del botón: una parada entera va en verde con
el texto en tinta encima. Eso es lo que hace que un color sea de una marca.

### 2.3 Tipografía

Tres niveles, y uno es nuevo.

**Display — Bricolage Grotesque, estrecha.** El fichero que servimos hoy está
recortado a `font-stretch: 100%`: sólo tenemos el ancho normal. Bricolage es
variable y trae el eje `wdth` de 75 a 100 y el eje `opsz`. Hay que **volver a
subsetear** la fuente incluyendo esos ejes (`fonttools`, `pyftsubset
--variations`), y a partir de ahí los titulares se ponen a `wdth: 78`, peso
800, interlineado 0,84 y `letter-spacing: -0.05em`. Una condensada apretada a
gran tamaño es otra cosa completamente distinta de la misma tipografía
agrandada: es la diferencia entre un cartel y un titular de periódico.

Tamaños: los titulares de parada van a `clamp(3rem, 11vw, 11rem)` — más grandes
que en la v1, no más pequeños. Lo que cambia es que ahora **se salen**: se
cortan contra el borde derecho de la ventana, se apoyan en el borde izquierdo
sin margen, y en dos sitios se parten en dos líneas de pesos distintos.

**Texto — Plus Jakarta Sans.** Como está. Ancho máximo 62 caracteres,
`text-wrap: pretty`.

**Datos — una monoespaciada, nueva.** Es la pieza que falta para que la página
parezca un producto y no un folleto: **Geist Mono** (licencia OFL, se
autohospeda igual que las otras dos, ~18 KB subseteada a latín). Se usa en todo
lo que es dato o etiqueta: los códigos `R-101`, los kilómetros, los rótulos de
parada, las notas al margen, el reloj del panel, los estados. Números tabulares
siempre.

### 2.4 Rejilla

Doce columnas, canal de 24 px, y **la rejilla se ve**: en dos paradas se pintan
las líneas de columna en un gris casi invisible, como una plantilla de imprenta
que se quedó a la vista. Es un recurso editorial viejo y funciona porque explica
por qué las cosas están donde están.

Nada se centra por defecto. Los titulares arrancan en la columna 1 o en la 3;
el texto ocupa de la 3 a la 7; los datos van a la derecha. La asimetría es
la posición de reposo.

**Notas al margen.** En el margen izquierdo, en mono a 11 px, anotaciones
cortas: `R-101 · 56,9 km`, `dato de la empresa`, `simulado`. Ponen densidad y
honestidad en el mismo gesto.

### 2.5 Textura

- La trama de puntos que ya existe se queda, pero **se hace explícita**: más
  contraste, y en la parada en tinta pasa a ser blanca.
- **Marcas de registro** en las cuatro esquinas de las paradas en color pleno,
  las cruces de imprenta. Un guiño gráfico, dos líneas de CSS.
- **La línea de ruta** del punto 1, que es el motivo principal.
- El grano de papel se descarta: cuesta ancho de banda y no aporta a esta
  distancia.

---

## 3. Sistema de movimiento

La regla que gobierna todo: **cada tipo de contenido entra de una forma
distinta, y esa forma dice qué es.** Hoy todo hace lo mismo. Cinco entradas
nombradas, y ninguna pieza usa una que no le toque:

| Nombre | Qué hace | Para qué |
|---|---|---|
| `corte` | El texto se destapa línea a línea con una máscara que sube, 60 ms de retraso entre líneas | Titulares |
| `ficha` | Entra desde abajo con un muelle corto y un grado de rotación que se corrige | Pantallas del producto |
| `cuenta` | La cifra sube desde 0 con dígitos tabulares, 900 ms | Números |
| `traza` | Un trazo SVG se dibuja de principio a fin | Rutas del mapa y línea de ruta |
| `relevo` | Los elementos de una lista entran en cascada de 40 ms | Tablas y listas |

**Curvas.** Dos, y sólo dos: `--salida` (`cubic-bezier(0.16, 1, 0.3, 1)`, sale
rápido y frena largo) para lo que entra, y `--muelle`
(`linear(...)` generada, con un rebote de un 4 %) para lo que responde al
puntero. Nada usa `ease` ni `ease-in-out`.

**Cómo se ejecuta, sin librerías de scroll.** Se usan **animaciones guiadas por
scroll nativas** —`animation-timeline: view()` y `scroll()`— que corren en el
hilo del compositor: no hay `IntersectionObserver` disparando clases, no hay
listeners de scroll, y en un móvil de gama baja va a 60 fps porque el hilo
principal no participa. Para los navegadores que aún no las traen, el
`IntersectionObserver` que ya existe queda como respaldo (el contenido nace
visible, así que el peor caso es que aparezca sin animar: eso ya está resuelto
desde el paso 2 de la v1 y no se toca).

**Por eso mismo no entra Lenis ni ningún scroll suave por JavaScript**: pelea
con las líneas de tiempo nativas, secuestra el scroll del sistema y es lo
primero que hace que una página se sienta pegajosa en un teléfono. El
`scroll-suave.ts` actual se revisa en la fase 1.

**Movimientos concretos que se añaden:**

- **Titulares línea a línea.** Se parten en líneas con el API de `Range` (no
  hace falta librería) y cada línea se destapa con `clip-path`.
- **Parallax de tres capas** en el hero: los buses flotan a una velocidad, los
  teléfonos a otra, la trama de fondo a otra. Con `animation-timeline: view()`,
  cero JavaScript.
- **Transiciones entre páginas.** `@view-transition { navigation: auto; }` más
  `view-transition-name` en el logo, el letrero de ruta y el titular: al ir de
  la portada a empresas, el logo no parpadea, viaja. Es de las cosas que más
  «caro» hacen sentir un sitio y son quince líneas de CSS.
- **Botones magnéticos** en escritorio: el botón se desplaza 3 px hacia el
  puntero. Sólo con `@media (hover: hover) and (pointer: fine)`.
- **Cobertura en horizontal.** La tabla de seis rutas pasa a ser una tira que se
  desplaza de lado mientras la parada está fija, con encaje en cada ficha.
- **La cinta en vivo** del hero pasa a ser un teletipo de verdad, en mono, que
  se desplaza y se detiene al pasar el puntero.
- **Los números cuentan** una sola vez, al entrar.

**Reducción de movimiento.** El bloque de `prefers-reduced-motion` que ya existe
crece para cubrir las cinco entradas: todo termina en su estado final al
instante y las líneas de tiempo se desactivan. Ese bloque usa 0,01 ms a
propósito y eso no cambia.

---

## 4. Los momentos que se van a recordar

Siete piezas concretas. Si al terminar no hay al menos cinco funcionando, el
rediseño no se ha hecho.

**1 · El titular cortado.** «¿CUÁNTO FALTA PARA TU BUS?» en condensada, a
11 vw, apoyado en el borde izquierdo sin margen y **cortado por el borde
derecho** en la palabra «BUS». Entra línea a línea. Debajo, en mono y pequeño,
la respuesta: `SOBUSA · 6 RUTAS · BARRANQUILLA Y SOLEDAD`.

**2 · Los tres teléfonos, sueltos.** Se quedan —son intocables— pero salen de su
composición centrada: van más abajo y más grandes, cortados por el borde
inferior de la ventana, con los cuatro buses flotando en parallax por delante y
por detrás de ellos. El solape congelado (`--lado`, `--solape`) no se toca.

**3 · La línea de ruta.** El motivo del punto 1, recorriendo la página entera.

**4 · El mapa a sangre, sin marco.** El mapa ocupa el ancho completo y el alto
de la ventana. Encima, flotando, las fichas de ruta con su código de color y el
número grande de distancia. Sin caja, sin título encima, sin explicación: se
toca y responde. El texto se reduce a una línea en el margen.

**5 · La cobertura en verde.** Una parada entera en verde pleno, con las seis
rutas como una tira horizontal de fichas grandes en mono, los kilómetros en
cifras tabulares enormes y el total al final. Es la parada más densa y la única
en color pleno: el contrapeso que hoy no existe.

**6 · El problema en negativo.** Una franja en tinta, texto en crema, con el
reloj como única pieza viva. Ocupa un tercio de ventana y se pasa rápido: su
trabajo es el contraste, no la explicación.

**7 · El paso a empresas.** Al pulsar «Soy empresa», la transición de vista
lleva el letrero de ruta y el logo a la otra página sin corte. La página de
empresas abre en tinta —es otro público, es otro mundo— y el panel de control
entra con `ficha`.

---

## 5. Arquitectura

### 5.1 Portada

| # | Parada | Campo | Tratamiento |
|---|---|---|---|
| 00 | Hero | crema | Titular cortado + teléfonos a sangre por abajo |
| 01 | El mapa | blanco | A sangre, alto de ventana, sin marco |
| 02 | Cómo funciona | crema | Tres pasos, rejilla visible, teléfono fijo a un lado |
| 03 | Cobertura | verde pleno | Tira horizontal de seis rutas, mono, cifras enormes |
| 04 | El problema | tinta | Franja de un tercio, en negativo |
| 05 | Preguntas | crema | Acordeón editorial numerado, sólo líneas |
| 06 | Empresas | coral o tinta | Bloque a sangre con el panel recortado |
| — | Cierre | tinta | Titular condensado enorme + pie |

Ocho paradas, ningún par consecutivo con el mismo campo ni el mismo
tratamiento.

### 5.2 Empresas

Las siete secciones que ya se escribieron se conservan **en contenido** —están
bien y dicen la verdad— y se rehacen en forma: abre en tinta, el panel de
control a tamaño grande (hoy es una postal), los tres estados como tres campos
de color en vez de tres tarjetas, los pasos numerados en mono ocupando el ancho,
y el formulario sobre campo de color pleno.

---

## 6. Lo que se borra

Un rediseño que sólo añade no es un rediseño.

- Las clases de tarjeta genérica: `.emp-tarjeta`, `.empresas-tarjeta`, la caja
  de `.cobertura-tabla-caja` y el marco de `.empresa-ficha`.
- Todas las sombras salvo las del producto.
- El `.reveal` único como mecanismo general (lo sustituyen las cinco entradas).
- `scroll-suave.ts`, si tras la fase 1 se confirma que estorba a las líneas de
  tiempo nativas.
- El aire sobrante: la página debe quedar más corta en píxeles y más llena de
  información.

---

## 7. Técnica y rendimiento

- **Sin librerías nuevas de animación.** Todo lo anterior sale con CSS moderno
  y unas 120 líneas de TypeScript propio (partir titulares en líneas, contar
  números, la tira horizontal). Se evalúa una sola dependencia opcional
  —`motion` (12 KB gz)— y sólo si el partido de líneas se complica.
- **Presupuesto:** JavaScript por debajo de 45 KB comprimido en la portada, CSS
  por debajo de 90 KB, LCP por debajo de 2 s en 4G con un móvil de gama media,
  CLS 0. El proyecto ya tiene `npm run presupuesto`; los números se actualizan
  ahí y la comprobación se hace en cada fase.
- **La política de contenido no cambia.** Nada de lo anterior necesita `<style>`
  ni `<script>` en línea, ni una petición a un tercero. Las fuentes siguen
  autohospedadas.
- **Sin JavaScript la página se sigue leyendo entera**, y la prueba que lo
  vigila se queda.

---

## 8. Lo que no se toca

- El logo de Ya Viene, en cualquier tamaño y en cualquier sitio.
- Los tres teléfonos del hero con los buses, y su solape congelado.
- Mapa CARTO Voyager. Distancia en metros y kilómetros, nunca minutos.
- Sin modo oscuro en el producto: las paradas en tinta son el **fondo de la
  web**, no un tema de la app.
- El GPS va montado en el vehículo; no hay app de conductor y no se insinúa.
- Móvil primero, sin iPad. Nada de esto se diseña en escritorio y se encoge.

---

## 9. Orden de trabajo

Ocho fases, un commit por fase, con `typecheck`, unitarias y Playwright en verde
en cada una. Las tres primeras son las que cambian la sensación de la página; si
sólo se hicieran esas tres, ya se notaría.

1. **Cimientos.** Re-subsetear Bricolage con los ejes `wdth`/`opsz`, añadir
   Geist Mono, escribir los nuevos tokens (campos de color, escala de
   titulares, las dos curvas, la rejilla de 12), y revisar `scroll-suave.ts`.
2. **El sistema de movimiento.** Las cinco entradas sobre líneas de tiempo
   nativas, el partido de titulares en líneas, la reducción de movimiento, y
   retirar el `.reveal` único.
3. **Hero.** Titular cortado, teléfonos a sangre, parallax de tres capas,
   teletipo en mono. Sin tocar el solape.
4. **La línea de ruta y el letrero.** El motivo de marca de punta a punta y el
   menú convertido en letrero de paradas.
5. **Mapa a sangre y cobertura en verde.** Las dos paradas de más peso.
6. **Problema en negativo, preguntas editoriales, bloque de empresas.**
7. **Empresas, rehecha en forma.** Mismo contenido, otra página.
8. **Pasada final.** Transiciones entre páginas, marcas de registro, notas al
   margen, presupuesto de rendimiento y limpieza de lo que quedó sin usar.

## 10. Cómo se sabrá si quedó bien

- Se puede describir de memoria: «la del bus que baja por el lado».
- Ninguna captura de dos paradas seguidas se parece.
- Hay una parada en color pleno y una en negativo.
- El producto (mapa y teléfonos) ocupa más de la mitad de al menos dos pantallas.
- La página es más corta que hoy y contiene más datos.
- En un móvil de gama media el scroll no se traba en ninguna parada.
