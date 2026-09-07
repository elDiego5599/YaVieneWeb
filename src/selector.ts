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
 */
const PALETA_EMPRESA = [
  'var(--electric-blue)',
  'var(--coral)',
  'var(--warn)',
  'var(--navy)',
  'var(--green)',
  'var(--app-primary-accessible)'
] as const;

/**
 * _companyColor(): suma los códigos del id y toma el resto entre seis. Es
 * determinista a propósito: la misma empresa sale del mismo color en la
 * app, en los goldens y aquí. Sobusa (EMP-01) da ámbar; Coolitoral
 * (EMP-02), navy.
 */
export function colorEmpresa(id: string): string {
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
export const EMPRESAS = [
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
export function inicialesEmpresa(nombre: string): string {
  const palabras = nombre.trim().split(/\s+/).filter(p => p.length > 0);
  if (palabras.length === 0) return '?';
  const claves = palabras.filter(p => !CONECTORES.has(p.toLowerCase()));
  if (claves.length === 0) return palabras[0][0].toUpperCase();
  if (claves.length === 1) return claves[0].slice(0, 2).toUpperCase();
  return (claves[0][0] + claves[1][0]).toUpperCase();
}

/**
 * El carril donde cuelgan las filas. Lo que se desplaza es él y no la
 * ventana, que es como se mueve una lista de verdad; va posicionado para
 * que el `offsetTop` de cada fila se mida contra el carril.
 */
const carril = (filas: HTMLElement[]): HTMLElement => {
  const nodo = document.createElement('div');
  nodo.className = 'sheet-lista-inner';
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
        </span>
        <span class="app-tile-chevron" aria-hidden="true">›</span>`;
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
 * La lista de rutas se arma con los datos, no a mano en el HTML: nombre y
 * "terminalA ↔ terminalB", igual que _routeSubtitle() del selector.
 */
export function carrilRutas(rutas: readonly RutaLanding[]): HTMLElement {
  return carril(
    rutas.map(ruta => {
      const fila = document.createElement('div');
      fila.className = 'app-tile';
      fila.dataset.ruta = ruta.id;
      fila.innerHTML = `
        <span class="app-tile-icon app-tile-icon--ruta">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M3 17h4a4 4 0 0 0 4-4V9a4 4 0 0 1 4-4h4" />
            <path d="M18 2l3 3l-3 3" />
            <circle cx="5" cy="17" r="2" />
          </svg>
        </span>
        <span class="app-tile-body">
          <span class="app-tile-title"></span>
          <span class="app-tile-sub"></span>
        </span>
        <span class="app-tile-chevron" aria-hidden="true">›</span>`;
      fila.querySelector('.app-tile-title')!.textContent = ruta.nombre;
      fila.querySelector('.app-tile-sub')!.textContent =
        `${ruta.terminalA} ↔ ${ruta.terminalB}`;
      return fila;
    })
  );
}
