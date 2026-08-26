/**
 * Las fichas de ruta y las cifras del tablero.
 *
 * Las seis rutas de Sobusa ya viajaban en el paquete —las carga
 * `src/data/rutas-landing.ts` para dibujar el mapa—, pero se enseñaban en
 * un riel estrecho de dos líneas. Aquí se arma la ficha completa: el
 * código con el que la app y el backend llaman a la ruta, el nombre, las
 * dos terminales y el kilometraje.
 *
 * La ficha es un botón, no un enlace: vive al lado del mapa y lo que hace
 * es cambiar la ruta que el mapa dibuja, ahí mismo. Quien la pinta es
 * `MapaVivo`, que es el que sabe cuál está puesta; este módulo sólo sabe
 * cómo se ve una.
 *
 * Las cifras de cabecera se calculan de los mismos datos que dibujan el
 * mapa, así que no pueden decir una cosa distinta a la que el mapa
 * enseña: si mañana entra una ruta más, el titular cambia solo.
 */

import { YV_RUTAS } from './data/rutas-landing';
import type { RutaLanding } from './types';

/** Coma decimal, que es como se escriben los números por aquí. */
const cifra = (n: number): string => String(n).replace('.', ',');

const trozo = (clase: string, texto: string): HTMLElement => {
  const nodo = document.createElement('span');
  nodo.className = clase;
  nodo.textContent = texto;
  return nodo;
};

/** Un dato de la cabecera: el número grande y lo que significa. */
const dato = (valor: string, rotulo: string): HTMLElement => {
  const pieza = document.createElement('div');
  pieza.className = 'rutas-dato';

  const numero = document.createElement('strong');
  numero.className = 'rutas-dato-numero';
  numero.textContent = valor;

  pieza.append(numero, trozo('rutas-dato-rotulo', rotulo));
  return pieza;
};

/**
 * La ficha de una ruta, lista para el riel del mapa.
 *
 * Sale apagada a propósito: el estado `aria-pressed` lo pone quien la
 * coloca, que es el único que sabe cuál está puesta.
 */
export const fichaDeRuta = (ruta: RutaLanding): HTMLButtonElement => {
  const ficha = document.createElement('button');
  ficha.type = 'button';
  ficha.className = 'ruta-ficha';
  ficha.dataset.ruta = ruta.id;

  const tramo = document.createElement('span');
  tramo.className = 'ruta-ficha-tramo';
  const flecha = trozo('ruta-ficha-flecha', '→');
  // La flecha es dibujo, no lectura: quien escucha la página oye las dos
  // terminales seguidas y no una flecha en medio.
  flecha.setAttribute('aria-hidden', 'true');
  tramo.append(trozo('ruta-ficha-terminal', ruta.terminalA), flecha,
    trozo('ruta-ficha-terminal', ruta.terminalB));

  const largo = document.createElement('span');
  largo.className = 'ruta-ficha-km';
  largo.append(trozo('ruta-ficha-km-cifra', cifra(ruta.km)),
    trozo('ruta-ficha-km-unidad', 'km'));

  ficha.append(trozo('ruta-ficha-id', ruta.id), largo,
    trozo('ruta-ficha-nombre', ruta.nombre), tramo);
  return ficha;
};

/**
 * Las tres cifras de cabecera, calculadas de los datos del mapa.
 *
 * Se pintan antes que `ScrollEffects` para que el observador las recoja:
 * llevan `.reveal` desde el HTML y pintadas después entrarían ya visibles.
 */
export const pintarCifras = (caja: HTMLElement): void => {
  const rutas = YV_RUTAS.rutas;
  const km = rutas.reduce((suma, r) => suma + r.km, 0);

  /*
    Las terminales sin repetir: Granabastos y Uninorte son cabecera de dos
    rutas cada una, y contarlas dos veces sería inflar el dato.

    Se cuentan los nombres tal como vienen en rutas.json, que es la lista
    del operador. Por eso «Nevada» y «Nevada (Soledad)» cuentan como dos:
    si quien opera las rutas las escribe distinto, no somos nosotros los
    que vamos a decidir que son la misma. De ahí el rótulo: terminales
    distintas, no lugares.
  */
  const terminales = new Set(rutas.flatMap(r => [r.terminalA, r.terminalB]));

  caja.replaceChildren(
    dato(String(rutas.length), 'rutas en operación'),
    dato(String(terminales.size), 'terminales distintas'),
    dato(cifra(Number(km.toFixed(1))), 'kilómetros trazados')
  );
};
