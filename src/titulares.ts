/**
 * Partir los titulares en líneas, para que se destapen una a una.
 *
 * La entrada `corte` de movimiento.css necesita que cada línea del
 * titular sea su propio elemento con `overflow: hidden`, y una línea no
 * es nada que el HTML sepa: depende de la anchura, del tamaño de la
 * letra y de dónde caiga cada palabra. Sólo se puede saber midiendo, y
 * sólo después de que la tipografía haya cargado —con la de sistema el
 * texto ocupa otra cosa y las líneas caen en otro sitio—.
 *
 * Así que esto mide y reescribe. El titular sigue siendo el mismo texto:
 * si este archivo no llega, o si el reparto falla, lo que queda es el
 * titular tal cual, legible y sin animar.
 */

/** Lo que se guarda de cada titular para poder rehacerlo al cambiar de anchura. */
const originales = new WeakMap<HTMLElement, Node[]>();
const anchos = new WeakMap<HTMLElement, number>();

/**
 * Trocear el contenido en unidades medibles.
 *
 * Cada palabra va en su `<span>` para poder preguntarle a qué altura ha
 * quedado. Los elementos —un `<span>` de color dentro del titular, por
 * ejemplo— entran enteros como una sola unidad: partirlos por dentro
 * obligaría a clonar su marcado en cada línea, y un titular no tiene
 * tantas palabras como para que importe.
 *
 * Los `<br>` se guardan tal cual: son un salto de línea pedido a mano y
 * hay que respetarlo aunque la línea no esté llena.
 */
const trocear = (nodos: Node[]): (HTMLElement | 'salto')[] => {
  const unidades: (HTMLElement | 'salto')[] = [];

  for (const nodo of nodos) {
    if (nodo.nodeType === Node.TEXT_NODE) {
      for (const palabra of (nodo.textContent ?? '').split(/(\s+)/)) {
        if (palabra.trim() === '') continue;
        const span = document.createElement('span');
        span.textContent = palabra;
        unidades.push(span);
      }
      continue;
    }

    if (!(nodo instanceof HTMLElement)) continue;
    if (nodo.tagName === 'BR') {
      unidades.push('salto');
      continue;
    }
    unidades.push(nodo.cloneNode(true) as HTMLElement);
  }

  return unidades;
};

/** Rehacer un titular como una pila de líneas. */
const partir = (titulo: HTMLElement): void => {
  let base = originales.get(titulo);
  if (!base) {
    base = Array.from(titulo.childNodes).map((n) => n.cloneNode(true));
    originales.set(titulo, base);
  }

  const unidades = trocear(base.map((n) => n.cloneNode(true)));
  if (unidades.length === 0) return;

  /*
    Medir. Se pintan todas las palabras separadas por un espacio de verdad
    —`document.createTextNode(' ')` y no `margin`— para que el reparto en
    líneas sea exactamente el que hará el navegador después.
  */
  titulo.textContent = '';
  for (const unidad of unidades) {
    if (unidad === 'salto') {
      titulo.appendChild(document.createElement('br'));
      continue;
    }
    titulo.appendChild(unidad);
    titulo.appendChild(document.createTextNode(' '));
  }

  const lineas: (HTMLElement | 'salto')[][] = [];
  let arribaActual: number | null = null;

  for (const unidad of unidades) {
    if (unidad === 'salto') {
      arribaActual = null;
      lineas.push([]);
      continue;
    }
    const arriba = Math.round(unidad.offsetTop);
    if (arribaActual === null || arriba !== arribaActual) {
      arribaActual = arriba;
      if (lineas.length === 0 || lineas[lineas.length - 1].length > 0) lineas.push([]);
    }
    lineas[lineas.length - 1].push(unidad);
  }

  const utiles = lineas.filter((linea) => linea.length > 0);
  if (utiles.length === 0) return;

  /*
    Y reescribir. `.ln` recorta y el elemento de dentro sube desde debajo
    del corte; el turno de cada línea va en `--i`, que es lo que lee el
    `animation-range` de la entrada.

    El titular entero se marca `aria-label` con su texto original y las
    líneas se esconden del árbol de accesibilidad: un lector de pantalla
    que se encuentre el titular partido en cinco cajas puede anunciarlo en
    cinco trozos, con una pausa en medio de una palabra si la línea cortó
    ahí. Con la etiqueta puesta lee la frase entera, que es lo que hay.
  */
  const texto = titulo.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  titulo.textContent = '';

  utiles.forEach((linea, indice) => {
    const caja = document.createElement('span');
    caja.className = 'ln';
    caja.style.setProperty('--i', String(indice));

    const dentro = document.createElement('i');
    linea.forEach((unidad, i) => {
      if (unidad === 'salto') return;
      dentro.appendChild(unidad);
      if (i < linea.length - 1) dentro.appendChild(document.createTextNode(' '));
    });

    caja.appendChild(dentro);
    titulo.appendChild(caja);
  });

  if (texto) {
    titulo.setAttribute('aria-label', texto);
    for (const caja of titulo.querySelectorAll('.ln')) {
      caja.setAttribute('aria-hidden', 'true');
    }
  }

  anchos.set(titulo, titulo.clientWidth);
};

/**
 * Encender el reparto en todos los titulares marcados.
 *
 * Se espera a que las tipografías estén listas antes de medir. Sin esa
 * espera el reparto sale con la letra de sistema y, cuando entra
 * Bricolage —más estrecha en la anchura que usamos—, las líneas ya no
 * caen donde se calcularon: sobra sitio al final de cada una o falta.
 *
 * Al cambiar de anchura se rehace, pero sólo si la anchura del titular
 * cambió de verdad: girar el teléfono o abrir el teclado disparan
 * `resize` sin que el titular mida otra cosa, y rehacerlo reiniciaría la
 * entrada de algo que el lector ya está leyendo.
 */
export function partirTitulares(raiz: ParentNode = document): void {
  const titulos = Array.from(raiz.querySelectorAll<HTMLElement>('.entra-corte'));
  if (titulos.length === 0) return;

  const repartir = (): void => {
    for (const titulo of titulos) partir(titulo);
  };

  if (document.fonts?.ready) void document.fonts.ready.then(repartir);
  else repartir();

  let pendiente = 0;
  window.addEventListener(
    'resize',
    () => {
      window.clearTimeout(pendiente);
      pendiente = window.setTimeout(() => {
        for (const titulo of titulos) {
          if (anchos.get(titulo) === titulo.clientWidth) continue;
          partir(titulo);
        }
      }, 200);
    },
    { passive: true }
  );
}
