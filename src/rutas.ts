/**
 * El tablero de rutas.
 *
 * Las seis rutas de Sobusa ya viajaban en el paquete —las carga
 * `src/data/rutas-landing.ts` para dibujar el mapa—, pero sólo se veían
 * dentro del mando del mapa, en un riel estrecho y en penumbra. Aquí se
 * enseñan como lo que son: seis fichas con su código, sus dos terminales
 * y su kilometraje, que es la información más sustanciosa que tiene la
 * página y la única que nadie más puede copiar.
 *
 * Nada de esto se escribe en el HTML. Las cifras de la cabecera se
 * calculan de los mismos datos que dibujan el mapa, así que no pueden
 * decir una cosa distinta a la que el mapa enseña: si mañana entra una
 * ruta más, el titular cambia solo.
 *
 * Cada ficha es un enlace de verdad a `#mapa` —el salto suave se lo da
 * `salto.ts` sin que aquí haya que hacer nada— y además deja el mapa
 * puesto en esa ruta, apretando el mismo botón que apretaría el visitante.
 * Es a propósito: no hay una segunda vía de entrada a `MapaVivo` que
 * mantener en pie, sólo la que ya existe.
 */

import { YV_RUTAS } from './data/rutas-landing';

/** Coma decimal, que es como se escriben los números por aquí. */
const cifra = (n: number): string => String(n).replace('.', ',');

/** Un dato de la cabecera: el número grande y lo que significa. */
const dato = (valor: string, rotulo: string): HTMLElement => {
  const pieza = document.createElement('div');
  pieza.className = 'rutas-dato';

  const numero = document.createElement('strong');
  numero.className = 'rutas-dato-numero';
  numero.textContent = valor;

  const nombre = document.createElement('span');
  nombre.className = 'rutas-dato-rotulo';
  nombre.textContent = rotulo;

  pieza.append(numero, nombre);
  return pieza;
};

const trozo = (clase: string, texto: string): HTMLElement => {
  const nodo = document.createElement('span');
  nodo.className = clase;
  nodo.textContent = texto;
  return nodo;
};

/**
 * Pinta las cifras y las fichas.
 *
 * Se llama antes que `ScrollEffects` a propósito: el observador recoge
 * los `.reveal` que encuentra al construirse, y estas fichas nacen aquí.
 * Si se pintaran después entrarían en pantalla ya visibles y la sección
 * aparecería de golpe, que es justo lo contrario de lo que se busca.
 */
export const pintarRutas = (raiz: HTMLElement): void => {
  const rejilla = raiz.querySelector<HTMLElement>('[data-rutas-rejilla]');
  const cifras = raiz.querySelector<HTMLElement>('[data-rutas-cifras]');
  if (!rejilla) return;

  const rutas = YV_RUTAS.rutas;

  if (cifras) {
    const km = rutas.reduce((suma, r) => suma + r.km, 0);
    /*
      Las terminales sin repetir: Granabastos y Uninorte son cabecera de
      dos rutas cada una, y contarlas dos veces sería inflar el dato.

      Se cuentan los nombres tal como vienen en rutas.json, que es la
      lista del operador. Por eso «Nevada» y «Nevada (Soledad)» cuentan
      como dos: si quien opera las rutas las escribe distinto, no somos
      nosotros los que vamos a decidir que son la misma. De ahí el
      rótulo: terminales distintas, no lugares.
    */
    const terminales = new Set(rutas.flatMap(r => [r.terminalA, r.terminalB]));

    cifras.replaceChildren(
      dato(String(rutas.length), 'rutas en operación'),
      dato(String(terminales.size), 'terminales distintas'),
      dato(cifra(Number(km.toFixed(1))), 'kilómetros trazados')
    );
  }

  const marco = document.createDocumentFragment();

  rutas.forEach((ruta, i) => {
    const ficha = document.createElement('a');
    ficha.className = 'ruta-ficha reveal';
    ficha.href = '#mapa';
    ficha.dataset.rutaSalto = ruta.id;
    /*
      Entran por turnos: se lee como un tablero llenándose, no como seis
      cosas que aparecen a la vez. El turno se cuenta por columna y no por
      posición en la lista —de ahí el resto de tres, que son las columnas
      en pantalla ancha—: con el retraso corrido, la segunda fila, que
      entra en su propio momento de scroll, llegaría con un tercio de
      segundo de más encima y se vería perezosa.
    */
    ficha.dataset.revealDelay = String((i % 3) * 70);

    const tramo = document.createElement('span');
    tramo.className = 'ruta-ficha-tramo';
    tramo.append(
      trozo('ruta-ficha-terminal', ruta.terminalA),
      trozo('ruta-ficha-flecha', '→'),
      trozo('ruta-ficha-terminal', ruta.terminalB)
    );
    // La flecha es dibujo, no lectura: quien escucha la página oye las
    // dos terminales seguidas y no una flecha en medio.
    tramo.querySelector('.ruta-ficha-flecha')?.setAttribute('aria-hidden', 'true');

    const largo = document.createElement('span');
    largo.className = 'ruta-ficha-km';
    largo.append(trozo('ruta-ficha-km-cifra', cifra(ruta.km)), trozo('ruta-ficha-km-unidad', 'km'));

    ficha.append(
      trozo('ruta-ficha-id', ruta.id),
      largo,
      trozo('ruta-ficha-nombre', ruta.nombre),
      tramo
    );
    marco.appendChild(ficha);
  });

  rejilla.replaceChildren(marco);
};

/**
 * Tocar una ficha deja el mapa puesto en esa ruta.
 *
 * Delegado en el documento y sin `preventDefault`: el enlace hace su
 * viaje a `#mapa` como cualquier otro, y esto sólo aprieta el botón de la
 * ruta dentro del mando. Si el mapa no llegó a montar —o el botón no
 * está—, no pasa nada: el salto sigue funcionando.
 */
export const saltosDeRuta = (): void => {
  document.addEventListener('click', evento => {
    const objetivo = evento.target;
    if (!(objetivo instanceof Element)) return;

    const ficha = objetivo.closest<HTMLElement>('[data-ruta-salto]');
    const id = ficha?.dataset.rutaSalto;
    if (!id) return;

    document
      .querySelector<HTMLButtonElement>(`[data-mapa-rutas] [data-ruta="${id}"]`)
      ?.click();
  });
};
