/**
 * Lo que enseña el selector de ruta de la app: las empresas, las filas de
 * las dos listas y los textos de los huecos vacíos.
 *
 * Vive aparte porque lo dibujan dos mockups distintos —el teléfono quieto
 * del hero y el segundo momento de «cómo funciona», que sí camina los
 * pasos— y las dos listas tienen que salir idénticas en los dos: mismas
 * empresas, mismos colores, mismas filas. Cuando esto estaba dentro de
 * `phone-simulator.ts` el otro mockup no podía tenerlo sin copiarlo, y una
 * copia de la paleta es justo lo que hace que un día los colores dejen de
 * coincidir con los de la app.
 *
 * Todo sale de `route_selector_sheet.dart`: los literales, la paleta y la
 * forma de sacar iniciales y color de una empresa.
 */

import type { RutaLanding } from './types';

/**
 * Los dos huecos del selector sin nada elegido. Los textos son los que
 * pone route_selector_sheet.dart cuando `selectedCompany` o
 * `selectedRoute` vienen nulos.
 */
export const VACIO_SELECT = {
  empresa: { titulo: 'Empresa', sub: 'Con cuál viajas' },
  ruta: { titulo: 'Ruta', sub: 'Cuál esperas' }
} as const;

/**
 * La empresa de la prueba. No sale de rutas.json —ahí sólo están las
 * rutas— sino de que las seis son de Sobusa, que es lo que dicen la app y
 * la propia landing. El subtítulo es el literal del selector.
 */
export const EMPRESA = { nombre: 'Sobusa', sub: 'Empresa de transporte masivo' } as const;

/**
 * _companyPalette: la paleta fija del selector, en el mismo orden que en
 * route_selector_sheet.dart. El color de una empresa no se escoge a mano
 * ni al azar; se saca de su id, y por eso hay que copiar la lista entera
 * y en orden —cambiar una posición cambiaría el color de todas.
 *
 * Es un escalón de azul noche a verde. La app dejó de tomar prestados los
 * tokens semánticos porque vestían a una empresa con el naranja de
 * «cuidado» o el coral de «sin conexión»; aquí seguía la paleta vieja y
 * Sobusa salía ámbar, un color que en la app ya no lleva ninguna.
 */
const PALETA_EMPRESA = [
  '#14274E', // noche
  '#22406F', // marino
  '#1C5670', // petróleo
  '#0F6A65', // verde azulado
  '#1C6B4C', // bosque
  '#3B6B2E' // oliva
] as const;

/**
 * _companyColor(): suma los códigos del id y toma el resto entre seis. Es
 * determinista a propósito: la misma empresa sale del mismo color en la
 * app, en los goldens y aquí. Sobusa (EMP-01) da petróleo; Coolitoral
 * (EMP-02), verde azulado.
 */
function colorEmpresa(id: string): string {
  let suma = 0;
  for (const c of id) suma += c.charCodeAt(0);
  return PALETA_EMPRESA[suma % PALETA_EMPRESA.length];
}

/**
 * Las empresas que enseña la lista. Sobusa es la del piloto y es siempre la
 * que se elige; las otras tres son las que mueven Barranquilla, y están
 * porque una lista de una sola fila no es una lista —el paso de elegir
 * empresa no se entendería—. Van en orden alfabético, sin trato de favor.
 *
 * Cada una viene con su id porque de ahí sale el color, igual que en la
 * app. Antes las insignias llevaban colores escogidos a mano —el rojo de
 * Sobusa, el azul de Sodis— y no coincidían con ninguna pantalla real: en
 * la app las iniciales van siempre en blanco sobre el color que le toca a
 * la empresa, y ni una sola es azul si su id no cae en esa casilla.
 */
const EMPRESAS = [
  { id: 'EMP-02', nombre: 'Coolitoral' },
  { id: 'EMP-01', nombre: 'Sobusa' },
  { id: 'EMP-03', nombre: 'Sodis' },
  { id: 'EMP-04', nombre: 'Transmetro' }
] as const;

const CONECTORES = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'y']);

/**
 * _companyInitials(): la primera palabra y la siguiente que no sea un
 * conector; si sólo hay una, sus dos primeras letras.
 */
function inicialesEmpresa(nombre: string): string {
  const palabras = nombre.trim().split(/\s+/).filter(p => p.length > 0);
  if (palabras.length === 0) return '?';
  const claves = palabras.filter(p => !CONECTORES.has(p.toLowerCase()));
  if (claves.length === 0) return palabras[0][0].toUpperCase();
  if (claves.length === 1) return claves[0].slice(0, 2).toUpperCase();
  return (claves[0][0] + claves[1][0]).toUpperCase();
}

/**
 * _codigoDeRuta de route_selector_sheet.dart: la primera palabra es un
 * código si son hasta dos letras, de una a tres cifras y quizá una letra
 * más —«B18», «C16»—.
 */
const CODIGO_RUTA = /^[A-Z]{0,2}\d{1,3}[A-Z]?$/;

/**
 * _routeCode(): «B18 Tcherassi» → «B18» y «Tcherassi». El código es lo que
 * va pintado en el parabrisas, así que el selector lo pone en la insignia
 * y deja el destino de título. Sin código, o sin nombre detrás, no parte.
 */
function codigoDeRuta(nombre: string): { codigo: string; resto: string } | null {
  const palabras = nombre.trim().split(/\s+/);
  if (palabras.length < 2 || !CODIGO_RUTA.test(palabras[0])) return null;
  const resto = palabras.slice(1).join(' ');
  return resto ? { codigo: palabras[0], resto } : null;
}

/**
 * `Icons.alt_route_rounded`, para la ruta que no traiga código. Es el
 * trazado de Material Icons: relleno, no de línea, como el de la app.
 */
const ALT_ROUTE = `
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M9.78 11.16l-1.42 1.42c-.68-.69-1.34-1.58-1.79-2.94l1.94-.49c.3.89.75 1.5 1.27 2.01zM11 6L7 2 3 6h3.02c.02.81.08 1.54.19 2.17l1.94-.49C8.08 7.2 8.03 6.63 8.02 6H11zm10 0l-4-4-4 4h2.99c-.1 3.68-1.28 4.75-2.54 5.88-.5.44-1.01.92-1.45 1.55-.34-.49-.73-.88-1.13-1.24L9.46 13.6c.93.85 1.54 1.54 1.54 3.4v5h2v-5c0-2.02.71-2.66 1.79-3.63 1.38-1.24 3.08-2.78 3.2-7.37H21z" />
  </svg>`;

/**
 * El final de cada fila: `chevron_right_rounded` y, si la fila es la ya
 * elegida, `check_circle_rounded`. Van los dos y el CSS enseña uno; los
 * trazados son los de Material Icons Round. Antes era un «›» de texto,
 * más fino y más bajo que el chevron de la app.
 */
const COLA = `
  <span class="app-tile-chevron" aria-hidden="true">
    <svg class="icono-chevron" viewBox="0 0 24 24" fill="currentColor">
      <path d="M9.29 6.71a1 1 0 0 0 0 1.41L13.17 12l-3.88 3.88a1 1 0 1 0 1.41 1.41l4.59-4.59a1 1 0 0 0 0-1.41L10.7 6.7a1 1 0 0 0-1.41.01z" />
    </svg>
    <svg class="icono-elegida" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2.71 14.29L5.7 12.7a1 1 0 0 1 1.41-1.41L10 14.17l6.88-6.88a1 1 0 0 1 1.41 1.41l-7.59 7.59a1 1 0 0 1-1.41 0z" />
    </svg>
  </span>`;

/**
 * El carril donde cuelgan las filas. Lo que se desplaza es él y no la
 * ventana, que es como se mueve una lista de verdad; va posicionado para
 * que el `offsetTop` de cada fila se mida contra el carril.
 */
const carril = (filas: HTMLElement[]): HTMLElement => {
  const nodo = document.createElement('div');
  nodo.className = 'sheet-lista-inner';
  // Turno de entrada de cada fila (`_escalonFila`): topado en la sexta.
  filas.forEach((fila, i) => fila.style.setProperty('--i', String(Math.min(i, 5))));
  nodo.append(...filas);
  return nodo;
};

/**
 * La lista de empresas: la insignia lleva las iniciales y el color que le
 * sacaría el selector a cada nombre.
 */
export function carrilEmpresas(): HTMLElement {
  return carril(
    EMPRESAS.map(empresa => {
      const fila = document.createElement('div');
      fila.className = 'app-tile';
      // El dedo del guion siempre busca la misma: la del piloto.
      if (empresa.nombre === EMPRESA.nombre) fila.dataset.el = 'tile-empresa';
      fila.innerHTML = `
        <span class="app-tile-icon app-tile-icon--empresa"></span>
        <span class="app-tile-body">
          <span class="app-tile-title"></span>
        </span>${COLA}`;
      const insignia = fila.querySelector<HTMLElement>('.app-tile-icon')!;
      insignia.textContent = inicialesEmpresa(empresa.nombre);
      insignia.style.background = colorEmpresa(empresa.id);
      // `iconColor: Colors.white` en la app, sin excepciones.
      insignia.style.color = '#FFFFFF';
      fila.querySelector('.app-tile-title')!.textContent = empresa.nombre;
      return fila;
    })
  );
}

/**
 * La lista de rutas se arma con los datos, no a mano en el HTML. Como en
 * el selector, el código va en la insignia y el título se queda con el
 * destino: seis filas con el mismo ícono verde solo se distinguían
 * leyendo, y «B18», «C11», «C16» es justo lo que se busca en el
 * parabrisas. Debajo, "terminalA ↔ terminalB", igual que _routeSubtitle().
 */
export function carrilRutas(rutas: readonly RutaLanding[]): HTMLElement {
  return carril(
    rutas.map(ruta => {
      const fila = document.createElement('div');
      fila.className = 'app-tile';
      fila.dataset.ruta = ruta.id;
      const partes = codigoDeRuta(ruta.nombre);
      fila.innerHTML = `
        <span class="app-tile-icon app-tile-icon--ruta">${partes ? '' : ALT_ROUTE}</span>
        <span class="app-tile-body">
          <span class="app-tile-title"></span>
          <span class="app-tile-sub"></span>
        </span>${COLA}`;
      if (partes) fila.querySelector('.app-tile-icon')!.textContent = partes.codigo;
      fila.querySelector('.app-tile-title')!.textContent = partes?.resto ?? ruta.nombre;
      fila.querySelector('.app-tile-sub')!.textContent =
        `${ruta.terminalA} ↔ ${ruta.terminalB}`;
      return fila;
    })
  );
}
