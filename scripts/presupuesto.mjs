/**
 * Presupuesto de peso de la landing.
 *
 * Una página se engorda de a poco: una fuente más aquí, una librería
 * allá, y para cuando se nota ya nadie sabe qué la engordó. Esto corta
 * el problema de raíz: si la build se pasa de los topes, la integración
 * continua falla y el commit que la engordó queda señalado.
 *
 * Los topes no son cifras redondas inventadas: son lo que pesa la build
 * de hoy más un margen. No están para que quepa lo que venga, están para
 * que engordar sea una decisión consciente y no un descuido.
 *
 *   node scripts/presupuesto.mjs
 */

import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// La carpeta se busca desde el script y no desde donde se lance: con 'dist'
// relativo, correrlo desde la raíz del espacio de trabajo medía el dist de
// otro proyecto —los APK de la demo— y salía un 35765% de exceso.
const DIST = join(dirname(dirname(fileURLToPath(import.meta.url))), 'dist');
const KB = 1024;

/** Topes en KB. Medido el 24/08/2026 y redondeado hacia arriba.
 *
 *  El de CSS subió a 88 el 25/08/2026 para la sección de las seis rutas y
 *  volvió a 85 el mismo día, cuando esa sección se fundió con la del mapa:
 *  al compartir cabecera y marco se fueron el bloque `.mv-ruta*` entero, la
 *  chapa de «pruébalo aquí» y el marco de consola, y sobró más de lo que
 *  había costado. Queda anotado porque la conclusión de entonces sigue
 *  valiendo: se buscó de dónde sacarlo sin subir el tope
 *  —`phone-simulator.css` no tiene una sola clase muerta, las siete que lo
 *  parecían se ponen desde JS, y entre los cuatro paquetes de dist no hay
 *  reglas repetidas— y no había nada que recuperar. Lo que devolvió el
 *  margen no fue limpiar, fue quitar una sección.
 *
 *  Y volvió a subir a 86 el 25/08/2026, con la revisión de las animaciones.
 *  Lo que costó ese kilobyte y pico: meter cada `:hover` de la página en
 *  `@media (hover: hover)` —en un móvil el `:hover` se queda pegado tras el
 *  toque— sacando el `:focus-visible` fuera del guarda, lo que obliga a
 *  escribir dos veces el mismo cuerpo de regla; y el `:active` que ocupa su
 *  sitio en táctil, que antes no existía. Se miró cómo no pagarlo: juntar
 *  todos los hover en un solo bloque al final del orden de carga los haría
 *  ganar a la ficha elegida del mapa, que tiene que ganarles a ellos, y
 *  meter el estado en una variable con `calc()` dentro de los colores es
 *  ilegible. Con 84.5 de build el tope de 85 no dejaba margen para nada:
 *  el presupuesto sólo sirve si avisa antes de reventar, no al reventar.
 *
 *  Y subió a 88 / 760 / 605 el 27/08/2026 con la banda de logos tras el
 *  hero (Sobusa, Coolitoral, Coochofal, Sodis, Transmecar, Tras Alfa,
 *  Transmetro). Sin esa banda la portada no tiene prueba social: el claim
 *  «ya en pruebas con Sobusa y sus 6 rutas» quedaba en texto y nadie lo
 *  creía. La alternativa —poner los logos en el hero— lo recargaba y
 *  rompía la escena de los tres teléfonos, que es lo que vende.
 *
 *  Esa banda pasó por tres versiones el mismo día —carrusel infinito,
 *  logos en negro puro, grilla en gris al 60 %— y cada una fue subiendo el
 *  tope hasta 810 / 88 / 655, con los siete PNG pesando entre 8 y 22 KB.
 *  Ahora vuelven a bajar: los logos son los originales a color y aun así
 *  los siete juntos ocupan 32 KB, la tercera parte. Lo que los adelgazó no
 *  fue encogerlos —se ven más grandes que nunca— sino sacarlos del SVG con
 *  su máscara de alfa, recortarlos por el trazo y guardarlos con paleta de
 *  96 colores: son logos, no fotos, y una paleta les sienta cuatro veces
 *  mejor que WebP con pérdida (33 KB contra 70 KB medidos con los mismos
 *  píxeles). Los topes quedan otra vez en lo que pesa la build de hoy más
 *  un margen, que es para lo que están.
 *
 *  Y los cuatro se vuelven a medir el 09/09/2026, con el rediseño v3 ya
 *  puesto. Tres de los cuatro topes estaban rotos en `main` —769/760 de
 *  dist, 90.9/87 de CSS y 611.3/610 de primera visita— porque se dejaron
 *  clavados mientras la página cambiaba entera debajo. Comparado con
 *  aquello, el rediseño adelgaza casi todo: dist pasa de 768.9 a 699.6,
 *  la primera visita de 611.3 a 543.3 y el JavaScript de 63.6 a 59.3,
 *  que es lo que se ganó al morir el motor de scrollytelling y las
 *  secciones que ya no están.
 *
 *  El CSS es el que sube: de 90.9 a 98.1. Lo paga el rediseño, que trae
 *  tres secciones nuevas —«el problema» con sus dos caras, el visor de
 *  los tres pasos y el mapa panorámico— y `critico.css`, que es la hoja
 *  de 2 KB que impide el parpadeo del enlace de salto. Se buscó de dónde
 *  sacarlo antes de subir el tope: se fueron el CSS de las secciones
 *  muertas, catorce variables sin usar, dos `@keyframes` huérfanos y las
 *  clases que nadie ponía, y eso devolvió 9 KB (107.1 -> 98.1). Lo que
 *  queda no se puede tocar: `phone-simulator.css` son 66 KB y es el
 *  espejo de las pantallas de la app en Dart —cada número suyo justifica
 *  uno de allá—, así que recortarlo es desincronizar el mockup.
 *
 *  Los cuatro topes quedan otra vez en la build de hoy más un 3 %. Los
 *  tres que bajan bajan de verdad: dejarlos anchos habría dejado pasar
 *  sin avisar toda la grasa que se acaba de quitar.
 *
 *  El 12/09/2026 el de CSS sube de 101 a 114. La build pasa de 99.3 a
 *  111.0 y lo que pesa es `/empresas.html`: su hoja va de unos 6 a 17.4 KB
 *  porque el recorte de cuatro placas se cambió por el panel de control
 *  entero dentro de un monitor, que es lo que una empresa espera ver
 *  antes de pagar. Es el mismo caso que `phone-simulator.css`: cada regla
 *  copia un número de `dashboard_screen.dart` y lleva al lado de dónde
 *  sale, así que recortarlo es desincronizar el mockup. Lo que se pudo
 *  quitar se quitó —las reglas de la consola vieja y su ajuste para
 *  pantallas de 420—. Esa hoja sólo la carga esa página, así que la
 *  primera visita no lo nota: sigue en 486.3 de 560. 114 es la build de
 *  hoy más el 3 % de siempre.
 *
 *  El mismo 12/09/2026 el de todo dist sube de 720 a 797. Lo que pesa son
 *  los 98.6 KB de `mapa-panel.webp`, el plano del monitor de
 *  /empresas.html: antes ese hueco reusaba el de la ciudad de la portada,
 *  que no costaba nada, pero estirado a medio monitor salía borroso y
 *  demasiado lejos para leer una calle. El nuevo está pintado a 2x para
 *  ese hueco exacto y a zoom de despachador. Se miró cómo no pagarlo:
 *  bajar a 1,5x lo deja otra vez blando en una pantalla retina, que es
 *  donde lo va a mirar el que decide, y bajar la calidad del WebP ensucia
 *  los rótulos de las calles, que es justo lo que se quería arreglar. La
 *  primera visita no lo nota —sólo lo pide esa página— y sigue en 486.3.
 *  797 es la build de hoy, 773.3, más el 3 %.
 *
 *  Y el mismo 12/09/2026 el de JavaScript sube de 62 a 66. La build pasa
 *  de 59.6 a 64.0 y lo que pesa es `panel-flota.ts`: el panel del monitor
 *  de /empresas.html dejó de ser una imagen quieta y ahora se cambia de
 *  ruta, se filtra, se elige un bus y se oculta, porque quien decide por
 *  una empresa se cree lo que prueba y no una captura. Es un solo oyente
 *  de clics y una función que repinta desde el estado; no hay librería
 *  que quitar. Sólo lo carga esa página, así que la primera visita sigue
 *  en 486.3. 66 es la build de hoy más el 3 %. */
const TOPES = {
  'todo dist': 797,
  'JavaScript': 66,
  'CSS': 114,
  'primera visita': 560,
};

/** Lo que el navegador se baja de verdad al abrir la portada por primera
 *  vez. El resto de dist (las otras tres páginas, la imagen para redes) no
 *  entra en esta cuenta porque en esa visita no se pide. */
const NO_ENTRA_EN_LA_PRIMERA_VISITA = [
  /^(privacidad|terminos|404|empresas)\.html$/,
  /^og\.png$/,
  /^logo\.svg$/,
  /^(hoja|404|accesibilidad)-[^/]*\.js$/,
  // El CSS de /empresas.html va en su propio fichero desde que salió del
  // índice común: la portada no lo pide. El de `accesibilidad` sí entra,
  // que ahí es donde el empaquetador dejó la hoja compartida.
  /^empresas-[^/]*\.(js|css)$/,
  // El plano del monitor de /empresas.html: sólo lo pinta esa página.
  /^mapa-panel-[^/]*\.webp$/,
];

function recorrer(dir, base = '') {
  const salida = [];
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre);
    const rel = base ? `${base}/${nombre}` : nombre;
    const st = statSync(ruta);
    if (st.isDirectory()) salida.push(...recorrer(ruta, rel));
    else salida.push({ rel, bytes: st.size });
  }
  return salida;
}

let ficheros;
try {
  ficheros = recorrer(DIST);
} catch {
  console.error('✗ No hay carpeta dist/. Ejecuta `npm run build` antes.');
  process.exit(1);
}

const suma = (lista) => lista.reduce((a, f) => a + f.bytes, 0) / KB;

// La portada arrastra su CSS y su JS; el resto de ficheros de assets sólo
// cuenta si no está en la lista de exclusiones de arriba.
const primeraVisita = ficheros.filter(
  (f) => !NO_ENTRA_EN_LA_PRIMERA_VISITA.some((re) => re.test(f.rel.replace(/^assets\//, '')))
);

const medidas = {
  'todo dist': suma(ficheros),
  'JavaScript': suma(ficheros.filter((f) => extname(f.rel) === '.js')),
  'CSS': suma(ficheros.filter((f) => extname(f.rel) === '.css')),
  'primera visita': suma(primeraVisita),
};

let fallo = false;
console.log('\n  Presupuesto de peso\n  ' + '─'.repeat(46));
for (const [nombre, tope] of Object.entries(TOPES)) {
  const real = medidas[nombre];
  const pasa = real <= tope;
  if (!pasa) fallo = true;
  const pct = Math.round((real / tope) * 100);
  console.log(
    `  ${pasa ? '✓' : '✗'} ${nombre.padEnd(16)} ${real.toFixed(1).padStart(7)} KB  de ${String(tope).padStart(4)} KB  (${pct}%)`
  );
}

if (fallo) {
  console.log('\n  Los cinco ficheros más pesados de dist:');
  for (const f of [...ficheros].sort((a, b) => b.bytes - a.bytes).slice(0, 5)) {
    console.log(`    ${(f.bytes / KB).toFixed(1).padStart(8)} KB  ${f.rel}`);
  }
  console.log(
    '\n  Si el peso de más está justificado, sube el tope en\n' +
      '  scripts/presupuesto.mjs y explica en el commit por qué.\n'
  );
  process.exit(1);
}

console.log('  ' + '─'.repeat(46) + '\n  Todo dentro del presupuesto.\n');
