# Rediseño v3 — la página como un producto formal

Rama `prueba2`, partiendo de `main`. Sustituye a `rediseno-v2.md`, que queda
descartado junto con todo lo que se hizo en la rama `prueba`.

## 1. Por qué fallaron los tres intentos anteriores

Los tres cambiaron la piel y dejaron el esqueleto: el mismo orden de
secciones, la misma manera de presentar cada cosa, otro color encima. Papel
crema con titulares de cartel; luego tinta oscura con rejilla y
resplandores; luego un plano de líneas de colores. Cada uno era más raro que
el anterior, y ninguno arreglaba lo que de verdad está mal.

Lo que está mal es el orden y el formato de la información:

- **El producto aparece de cuarto.** El mapa en vivo es lo mejor que
  tenemos —se toca, se mueve, es real— y hay que bajar tres pantallas para
  llegar a él. Las tres referencias que pediste enseñan el producto en la
  primera pantalla o inmediatamente debajo.
- **Hay una sección entera para contar el problema.** Media pantalla
  explicando que esperar el bus a ciegas es incómodo, a gente que está
  esperando el bus a ciegas. Eso es una frase, no una parada.
- **Las dos audiencias están mezcladas.** El pasajero y la empresa de
  transporte quieren cosas distintas, y hoy lo de la empresa vive dentro de
  otra sección, como una nota al margen.
- **Los datos que sí tenemos no se enseñan.** Seis rutas con sus cabeceras
  y su kilometraje, en `rutas.json`, y en la página no aparecen. Eso es
  justo el tipo de dato concreto que hace creíble a un producto.
- **Hay adornos que no dicen nada.** El riel de paradas numeradas del
  costado, la trama de puntos, las secciones a sangre de borde a borde. Son
  gestos de revista, y esto es una herramienta.

## 2. Qué se toma de cada referencia

- **Vercel** — el ritmo: bloques cortos, mucho aire, una idea por banda, y
  el producto siempre dentro de un marco con borde de un píxel. Nada de
  ilustración: lo que se ve es la interfaz de verdad.
- **Linear** — la precisión tipográfica. Rótulos pequeñísimos en
  monoespaciada, titulares con el interletrado cerrado, y una rejilla que
  no se rompe nunca. Las secciones son cortas y terminan antes de aburrir.
- **incident.io** — la manera de mostrar la interfaz: recortes reales del
  producto dentro de tarjetas de esquina suave sobre fondo casi blanco, con
  una sola sombra grande debajo del recorte principal y ninguna en el resto.
- **Aave** — que el fondo claro no tiene por qué ser blanco muerto: bandas
  alternas con un tinte muy leve, y el color de marca guardado para los
  botones y los estados, no repartido por el fondo.

De todas: **fondo claro, color contenido, borde de pelo, esquina suave,
sombra casi ninguna.** Formal. Ninguna es oscura y ninguna tiene adornos.

## 3. El sistema visual

Todo en día. No hay modo oscuro ni campos de tinta.

**Superficies**

| Papel | `#FFFFFF` | el fondo por defecto |
| Banda alterna | `#F6F8FA` | una de cada dos secciones |
| Tarjeta | `#FFFFFF` | sobre la banda alterna |
| Línea de pelo | `#E5E9EE` | bordes y separadores, siempre 1px |

**Tinta**

| Principal | `#0B1220` | titulares y cifras |
| Secundaria | `rgba(11,18,32,0.62)` | texto corrido |
| Tenue | `rgba(11,18,32,0.42)` | rótulos y notas |

**Color**

El verde `#00A859` es lo único que se llena de color, y se gasta en tres
sitios: el botón principal, el punto de «en vivo» y la ruta activa del
mapa. El coral `#E86A5E` sólo marca el estado de aviso. El azul marino
`#14274E` no se usa de adorno.

**Forma**

Radio de 12 en tarjetas, 16 en marcos de producto, 999 en pastillas.
Sombra: `0 1px 2px rgba(11,18,32,0.04)` en tarjetas y una sola sombra
grande debajo del marco del mapa. Nada más.

**Letra**

- Titulares: Bricolage Grotesque a ancho normal —no condensada—, peso 600,
  interletrado −0.03em, caja baja.
- Texto: Plus Jakarta Sans, 16–17px, interlínea 1.6, máximo 62 caracteres
  por renglón.
- Rótulos: monoespaciada del sistema, 11px, versales, interletrado 0.12em,
  en tinta tenue.

**Rejilla**

Contenedor de 1160px centrado con calles de 24px. Se acaban las secciones
a sangre, el riel de paradas y la trama de puntos. Ritmo vertical de
sección: `clamp(72px, 9vh, 128px)` arriba y abajo.

**Movimiento**

Lo que hace una herramienta y nada más: 150 ms en los estados de puntero,
una entrada de 400 ms al aparecer la sección, y el mapa reaccionando al
toque. Se respeta `prefers-reduced-motion`.

## 4. El orden nuevo de la página

1. **Barra** — fija arriba, delgada, con la línea de pelo apareciendo al
   bajar. Logo, tres enlaces y el botón de empresa. Se retira la isla
   flotante.
2. **Portada** — la pregunta, una línea de apoyo, dos botones y el trío de
   teléfonos. Debajo, una tira delgada con la prueba: Sobusa · 6 rutas ·
   Barranquilla y Soledad · piloto en curso.
3. **El mapa en vivo** — el producto, de segundo. Marco de aplicación con
   la lista de rutas a un lado y la distancia al bus leyéndose en grande.
4. **Cómo funciona** — tres pasos en tres columnas, cada uno con un recorte
   real de la app debajo. Sin iconos dibujados.
5. **Qué resuelve** — la sección del problema comprimida en una banda de
   tres afirmaciones cortas con su cifra. Deja de ser una parada entera.
6. **Rutas y cobertura** — la tabla de las seis rutas con cabeceras y
   kilometraje. Es el punto denso de la página y son datos verdaderos.
7. **Para empresas de transporte** — banda propia, no una nota dentro de
   otra sección: qué recibe el operador —el GPS montado en el bus y el
   panel de control para Mac y Windows— y el enlace a `empresas.html`.
8. **Preguntas** — acordeón corto, cinco o seis.
9. **Cierre** — una línea y los dos botones otra vez.
10. **Pie** — enlaces, aviso de piloto y legales.

## 5. Lo que no se toca

- El logo de Ya Viene, en ninguna parte.
- La geometría del trío de teléfonos de la portada: `--tel`, `--lado` al
  0.93 y `--solape` al 0.16 se quedan exactamente como están.
- El mapa base sigue siendo CARTO Voyager y se sigue mostrando distancia en
  metros y kilómetros, nunca minutos.
- El GPS es equipo montado en el bus de la empresa. En ningún texto se
  promete que no haga falta equipo.

## 6. Orden de trabajo

Un commit por fase, con `typecheck`, Vitest y Playwright en verde, y una
captura para revisar antes de seguir con la siguiente.

| Fase | Qué entra |
| 1 | Base: tokens de día, tipografía, contenedor, ritmo de sección, botones, barra delgada. La página se ve sobria y todavía sin rediseñar. |
| 2 | Portada y tira de prueba. |
| 3 | El mapa como producto. |
| 4 | Cómo funciona. |
| 5 | Qué resuelve y la tabla de rutas. |
| 6 | Empresas, preguntas, cierre y pie. |
| 7 | `empresas.html` al mismo sistema. |
| 8 | Limpieza: CSS muerto fuera, presupuesto de peso y repaso de accesibilidad. |
