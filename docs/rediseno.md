# Rediseño de la web de Ya Viene

Propuesta de reordenar la información y de rehacer el diseño de `index.html` y
`empresas.html`. No hay código nuevo todavía: esto es el plan que hay que
aprobar antes de tocar nada. Todo el trabajo va en la rama `prueba`.

---

## 1. Qué se midió antes de opinar

Con la página servida en local a 1440 × 900:

| Dato | Valor |
|---|---|
| Alto total del documento | 8682 px (≈ 9,6 pantallas) |
| Secciones de `index.html` | 4 (`#hero`, `#problema`, `#solucion`, `#mapa`) + cierre + pie |
| Dónde empieza `#solucion` | y = 3686 px |
| Alto de `#solucion` | 2736 px (≈ 3 pantallas de scroll para 3 pasos) |
| Dónde empieza el mapa jugable | ≈ y = 6400 px |
| Secciones de `empresas.html` | 1 (`#solicitar`) |

Y un detalle que sólo se ve tocándolo: **todo lo que está debajo del hero
arranca en `opacity: 0`** y sólo aparece cuando el `IntersectionObserver` de
`scroll-effects.ts` lo despierta (`.escena-entra`, `.reveal`). Si esa capa no
corre —navegador lento, pestaña en segundo plano, un bot sacando la vista
previa para WhatsApp— la página es una crema en blanco desde el píxel 900 hasta
el final.

## 2. Diagnóstico: no es que sea genérica, es que está mal repartida

La sensación de "genérico" no viene de la paleta ni de la tipografía. La crema,
el verde, el navy, Bricolage Grotesque para titulares y Plus Jakarta Sans para
texto son una identidad propia y bastante reconocible: eso se queda. Lo que
hace que parezca una plantilla es **la forma**: cinco paneles del alto de la
ventana, apilados, todos centrados, todos con un titular enorme y una idea
sola. Esa silueta es exactamente la de cualquier landing hecha en media tarde,
y ninguna cantidad de color la salva.

Los problemas concretos, por orden de gravedad:

**a) Lo único que demuestra que el producto existe está al final.** El mapa
jugable —elegir ruta, poner el punto, ver el bus acercarse y el aviso saltar—
es el mejor argumento de la página entera, y hay que bajar 6400 px para
encontrarlo. Casi nadie llega. Lo que sí ve todo el mundo son teléfonos
dibujados, que son una promesa, no una prueba.

**b) El hero no pide nada.** El botón principal, "Ver cómo funciona", hace
scroll. El secundario manda a otro público. La línea "Ya Viene, disponible en
iOS / Android" son dos etiquetas de texto que no llevan a ninguna tienda,
porque la app todavía no está publicada. Resultado: el visitante llega, lee un
titular bueno, y no hay nada que pueda hacer.

**c) La sección del problema cobra una pantalla por decir algo que el visitante
ya sabe.** Quien entra a esta página es alguien que espera buses en
Barranquilla. Ya sabe que el bus tarda entre 3 y 30 minutos y que hace calor.
Gastar ~1000 px y un cronómetro animado en confirmárselo es el tramo de menor
rendimiento de toda la página.

**d) Tres pasos ocupan tres pantallas de scroll secuestrado.** La cinta de
`#solucion` está bien hecha —el teléfono se queda quieto, el texto releva, hay
descanso entre momentos— pero el precio es que el visitante tiene que
"trabajar" 2736 px para recibir tres frases. En un móvil eso es mucho pulgar
para poca información.

**e) Hay dos públicos y sólo uno tiene página.** El pasajero se lleva
`index.html` entero. La empresa de transporte —que es quien decide, quien
instala el GPS y quien acaba pagando— se lleva un enlace en el menú y una
página de 336 líneas con un mockup, cuatro frases y un formulario. Está al
revés de donde está el negocio.

**f) No hay una sola prueba verificable.** "6 rutas reales" aparece una vez, en
versalitas pequeñas, en el pie. El nombre de Sobusa aparece en el mockup y en
una fila de logos. No hay ni un número que el visitante pueda contrastar, y el
backend ya expone públicamente lo que haría falta para tenerlo.

**g) La página no se parece a la app tanto como podría.** Los mockups sí: son
un espejo en CSS de los widgets de Flutter, hasta con los comentarios citando
las propiedades de Dart. Pero fuera de los teléfonos, la página vuelve a ser
botones y tarjetas de landing. La ficha de ruta, la píldora del bus, el chip de
empresa, el número grande de distancia: eso es un sistema visual propio que ya
está construido y que está encerrado dentro de las pantallitas.

---

## 3. La nueva distribución de la información

### 3.1 Portada (`index.html`)

**1 · Hero — se queda, con tres cambios.**

Los tres teléfonos con los buses no se tocan como concepto: siguen siendo el
trío (izquierdo con la hoja fija, central vivo, derecho con la pantalla de
entrada) con los cuatro buses flotando y las dos etiquetas. Lo que cambia:

- El botón principal pasa a ser **"Ver los buses en vivo"**, y en vez de hacer
  scroll a 6400 px, baja a la sección 2, que ahora está justo debajo.
- El secundario pasa a ser **"Soy empresa de transporte"**.
- Debajo del trío, pegada al borde inferior del hero, una **franja de estado en
  vivo**: "Sobusa · 6 rutas · N buses moviéndose ahora", con N pedido al
  backend. Es una línea de texto y es la frase más convincente de la página.
- Las etiquetas de iOS y Android se quedan pero dicen la verdad de hoy
  ("pronto en", o se convierten en un campo de correo para avisar). Prometer
  una descarga que no existe se paga caro.

**2 · El mapa en vivo — sube del final al segundo lugar.**

A pantalla completa, sin caja, el mapa ocupa el ancho entero con las fichas de
ruta flotando encima. El texto se reduce a una línea: "Elige una ruta y toca el
mapa donde esperas." Es la única sección que se toca, y ahora la ve todo el
mundo. Aquí se mantiene la honestidad que ya tiene el módulo: rutas y
distancias reales, buses simulados, y dicho encima del mapa.

**3 · Cómo funciona — mismos tres pasos, un tercio del scroll.**

Se conserva el teléfono quieto y el relevo de texto, pero el recorrido baja de
~2736 px a ~1000–1200 px: el titular de portada de la cinta desaparece (ya lo
dijo el hero) y los tres momentos pasan de "una pantalla de descanso cada uno"
a un carrusel vertical corto con las tres tarjetas visibles a la vez en
escritorio y desplazables en móvil. La demo del teléfono sigue corriendo.

**4 · Cobertura hoy — sección nueva.**

La que falta y la que más credibilidad da. Un bloque denso, tipo tablero: el
mapa de Barranquilla al lado de una lista real de las seis rutas de Sobusa con
sus terminales, y las empresas que están en conversación. Números tabulares,
sin animación. Es el contrapeso de densidad que la página necesita para dejar
de parecer una plantilla: después de tres secciones aireadas, una compacta y
llena de datos.

**5 · El problema — de pantalla completa a franja.**

Una banda de un tercio de pantalla: la frase "El bus puede tardar 3 minutos o
30, y no hay forma de saberlo hasta que aparece", el cronómetro reducido a un
elemento pequeño al lado, y nada más. Los dos párrafos del sol y del aguacero
se recortan a uno. Y baja hasta aquí, porque es refuerzo, no apertura.

**6 · Preguntas — sección nueva.**

Cinco o seis, en acordeón, escritas para las dudas que la gente tiene de
verdad:

- ¿Cuánto cuesta? (gratis para el pasajero)
- ¿Gasta muchos datos?
- ¿Tengo que dejar la app abierta? (no: el aviso llega en segundo plano)
- ¿El GPS lo pone el conductor con su teléfono? (no: **va montado en el bus**;
  esta pregunta existe para dejar el punto zanjado en público)
- ¿En qué ciudades está?
- ¿Qué pasa con mi ubicación? (enlace a privacidad)

**7 · Para empresas — un bloque de verdad, no un enlace.**

Tres frases, el recorte del panel de control que ya existe, y el botón a
`empresas.html`. Que el que decide no tenga que descubrir que hay otra página.

**8 · Cierre + pie.** Como está, con el cierre acortado.

### 3.2 Página de empresas (`empresas.html`)

Pasa de una sección a seis. Es la página del cliente que paga y hoy es la más
pobre de las dos.

1. **Hero propio**: "Tus buses en el mapa, y la flota entera en una pantalla",
   con el panel de control grande a la derecha (el mockup de la consola ya está
   hecho y es bueno).
2. **Qué instalamos**: el GPS va montado en el vehículo, lo instalamos nosotros
   junto con la flota, no hay app de conductor ni depende de que alguien
   recuerde abrir nada. Esto ya está escrito en la página y es lo mejor que
   tiene; merece un bloque, no una viñeta.
3. **Qué ves tú**: los tres estados (En línea / Sin señal / Oculto), el detalle
   de que un bus se puede ocultar del pasajero sin dejar de verlo tú, y el
   panel en Windows y macOS.
4. **Qué gana la empresa**: menos llamadas preguntando por dónde va el bus,
   control de turnos, y los pasajeros viendo la flota en vez de adivinando.
5. **Cómo empezamos**: tres pasos con tiempos (visita → instalación → alta en
   el panel), para que no parezca un salto al vacío.
6. **Seguridad**: cada paquete de ubicación se verifica en servidor
   (coherencia de tiempo, velocidad y trayecto). Hoy es una frase perdida.
7. **Quiénes ya están** + **formulario**. El formulario se queda como está.

---

## 4. El diseño

### 4.1 Lo que no se toca

- El logo de Ya Viene, en cualquier tamaño y en cualquier sitio.
- La tipografía: Bricolage Grotesque en titulares, Plus Jakarta Sans en texto.
- La paleta: crema, verde, navy, y los cuatro fondos de panel (sun, arena,
  mint, sangre).
- Los tres teléfonos del hero con los buses, y su solape
  (`--lado` y `--solape` en `hero.css`, congelados).
- Mapa CARTO Voyager, distancia en metros/kilómetros —nunca minutos—, y sin
  modo oscuro.

### 4.2 Lo que cambia

**Romper el ritmo de "un panel por pantalla".** El cambio más importante y el
más barato. Hoy hay cinco bloques del mismo tamaño y la misma forma. La
propuesta alterna cuatro tratamientos:

- *A sangre*: el mapa en vivo y el mapa de cobertura, sin márgenes, de borde a
  borde.
- *Encajado*: cómo funciona y para empresas, dentro del ancho de contenido.
- *Partido*: el hero y el hero de empresas, texto a un lado y escena al otro.
- *Denso*: cobertura y preguntas, en rejilla, con más información por píxel que
  el resto de la página junta.

Un visitante que baja debería notar que el suelo cambia bajo los pies. Hoy no
cambia nunca.

**Que la página use los componentes de la app.** La ficha de ruta con su código
de color, la píldora roja del bus, el chip de empresa, el número grande de
distancia con "m de ti" debajo: hoy sólo existen dentro de los mockups. Sacarlos
y usarlos como los componentes de la web —los ítems de la lista de cobertura
son fichas de ruta de verdad, el contador en vivo es la píldora del bus— hace
que la página deje de parecerse a una landing y pase a parecerse al producto.
Eso es lo contrario de genérico, y el material ya está escrito en
`phone-simulator.css`.

**Bajar los titulares y subir la densidad.** Los `h1`/`h2` actuales son
enormes. Recortarlos alrededor de un 20 % y meter un tercer nivel de tamaño
—texto de dato, con cifras tabulares— da sitio para poner información donde
ahora hay aire. La página no tiene que ser más corta por todos lados: tiene que
ser más corta donde no dice nada y más llena donde sí.

**Movimiento que informa, no que decora.** Se mantienen la respiración de los
teléfonos, la levitación de los buses y el relevo de los pasos. Se quita el
secuestro largo del scroll. Y se añade una regla nueva: **todo lo que aparece
por `IntersectionObserver` debe verse igual sin JavaScript.** Se invierte la
lógica actual: el contenido nace visible en CSS y sólo se esconde si el script
marca el documento como capaz de animarlo. Con eso se acaba el riesgo de la
página en blanco.

**Una sola señal de "en vivo".** Un acento —el pulso verde— reservado
exclusivamente para lo que de verdad viene del backend en ese momento: el
contador del hero y los buses del mapa. Si todo parpadea, nada está vivo.

### 4.3 Referencias, y qué tomar de cada una

- **reactbits.dev/pro/blocks** — sirve para el *inventario*: qué formas de
  bloque existen (hero partido, rejilla bento, marquesina de logos, acordeón de
  preguntas) y cuál encaja en cada punto de la nueva estructura. Se toma la
  estructura; no se toma el aspecto, que es oscuro y de agencia y chocaría con
  la crema.
- **ui.watermelon.sh** — su idea central es la buena: publicar *secciones de
  página completas y composiciones realistas* en vez de widgets sueltos. Es
  exactamente el criterio con el que hay que montar la sección de cobertura y
  el bloque del panel en la página de empresas. Sus "dashboards" son la
  referencia directa para el recorte del panel de control.
- **Citymapper y Transit** — cómo se resuelve tener dos públicos (el que viaja
  y la empresa que opera) sin partir la marca en dos, y cómo enseñan "ahora
  mismo" como argumento en vez de contarlo.
- **Linear, Vercel, Raycast** — de dónde sale la variación de densidad y la
  costumbre de que la interfaz del propio producto sea el lenguaje visual de la
  web. Es el patrón que justifica sacar las fichas de la app fuera de los
  teléfonos.
- **Páginas de producto de Apple** — para la rejilla tipo bento de la sección
  de cobertura, donde conviven un mapa grande y varias celdas pequeñas de dato.

---

## 5. Orden de trabajo propuesto

Todo en `prueba`, un commit por paso, con los tests de Vitest y Playwright
verdes en cada uno.

1. **Reordenar sin rediseñar.** Mover el mapa en vivo al segundo puesto, bajar
   el problema y acortarlo, recortar la cinta de los pasos. Sólo mover y
   podar: la página se acorta de 8682 px a ~5500 px y ya se lee mejor. Es el
   paso que más se nota y el que menos riesgo tiene.
2. **Quitar la fragilidad.** Invertir la lógica de las apariciones para que
   nada dependa de JavaScript para ser visible.
3. **Hero: los botones y la franja en vivo.** Requiere una llamada al backend
   desde la web (hoy no hay ninguna; el mapa de la landing es todo local).
4. **Cobertura hoy**, con las fichas de ruta de la app sacadas fuera del
   teléfono.
5. **Preguntas**, y el bloque de empresas en la portada.
6. **Rehacer `empresas.html`** con las seis secciones.
7. **Pasada de diseño**: los cuatro tratamientos de panel, la escala
   tipográfica y el acento de "en vivo".

Los pasos 1 y 2 se pueden hacer hoy y ya dejan la página mejor que ahora. Del 3
en adelante conviene aprobar antes esta propuesta.
