/**
 * Las fichas de ruta y las cifras del tablero.
 *
 * Las seis rutas de Sobusa ya viajaban en el paquete —las carga
 * `src/data/rutas-landing.ts` para dibujar el mapa—, pero se enseñaban en
 * un riel estrecho. Aquí se arma la ficha: la insignia con el código de
 * la ruta y su nombre, sin terminales (dueño, 2026-10-12).
 *
 * Y sólo eso. La ficha llegó a llevar también el código interno (R-101) y
 * el kilometraje, que son datos reales pero de otra conversación: al lado
 * del mapa la ficha es un mando —se pulsa para cambiar lo que el mapa
 * dibuja— y un mando se lee de un vistazo. El código y los kilómetros
 * siguen en `rutas.json`, y el total de kilómetros sigue saliendo en las
 * cifras de cabecera de aquí abajo.
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
 * Un código de ruta: hasta dos letras, de uno a tres dígitos y una letra
 * opcional. Espejo de `_codigoDeRuta` en route_selector_sheet.dart:1383.
 */
const CODIGO = /^[A-Z]{0,2}\d{1,3}[A-Z]?$/;

/**
 * «B18 Tcherassi» → {code: 'B18', rest: 'Tcherassi'}. Espejo de `_routeCode`
 * (route_selector_sheet.dart:1385): `null` si la primera palabra no es un
 * código o si detrás no queda nombre, y entonces la ficha lleva el nombre
 * entero sin insignia.
 */
export const codigoDeRuta = (nombre: string): { code: string; rest: string } | null => {
  const [code, ...resto] = nombre.trim().split(/\s+/);
  if (!code || resto.length === 0 || !CODIGO.test(code)) return null;
  return { code, rest: resto.join(' ') };
};

/**
 * La ficha de una ruta, lista para el riel del mapa: la insignia con el
 * código y al lado el nombre, como la fila de ruta del selector de la app
 * (`_compactTile`: `badgeInitials: codigo?.code`, `title: codigo?.rest`).
 * Sin terminales ni kilometraje (dueño, 2026-10-12).
 *
 * Sale apagada a propósito: el estado `aria-pressed` lo pone quien la
 * coloca, que es el único que sabe cuál está puesta.
 */
export const fichaDeRuta = (ruta: RutaLanding): HTMLButtonElement => {
  const ficha = document.createElement('button');
  ficha.type = 'button';
  ficha.className = 'ruta-ficha';
  ficha.dataset.ruta = ruta.id;
  // Dos spans seguidos se leerían «B18Tcherassi»: el nombre accesible es
  // el nombre entero de la ruta.
  ficha.setAttribute('aria-label', ruta.nombre);

  const codigo = codigoDeRuta(ruta.nombre);
  if (codigo) ficha.append(trozo('ruta-ficha-insignia', codigo.code));
  ficha.append(trozo('ruta-ficha-nombre', codigo ? codigo.rest : ruta.nombre));
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
    que vamos a decidir que son la misma. El diez son nombres de
    terminal, no lugares comprobados sobre el terreno.
  */
  const terminales = new Set(rutas.flatMap(r => [r.terminalA, r.terminalB]));

  /*
    Rótulos de una palabra. Decían «rutas en operación», «terminales
    distintas» y «kilómetros trazados»: el primero repetía el antetítulo
    de la sección, y los otros dos añadían un adjetivo que el número ya
    deja claro. La precisión no se pierde, se muda aquí —el diez son
    nombres distintos de terminal, contados como los escribe el
    operador—, que es donde hace falta.
  */
  caja.replaceChildren(
    dato(String(rutas.length), 'rutas'),
    dato(String(terminales.size), 'terminales'),
    dato(cifra(Number(km.toFixed(1))), 'kilómetros')
  );
};
