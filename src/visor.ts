import { YV_RUTAS } from './data/rutas-landing';
import type { PhoneMap } from './phone-map';
import { scrollDePista, seguirPista, sinMovimiento, tramo } from './scrolly';

/**
 * El visor: cinco piezas de la app, una a la vez, a golpe de scroll.
 *
 * Las vistas están apiladas en la misma celda y la escena va pegada a la
 * ventana, así que bajar por la sección no mueve nada de sitio: sólo
 * cambia lo que se está enseñando. El riel de abajo hace de índice y de
 * barra de avance —se llena con lo que falta del tramo— y también sirve de
 * mando: al tocar una pieza la página se desplaza hasta su tramo, que es
 * la única forma de que el scroll y los botones no se peleen.
 *
 * La última pieza, las rutas, sí es interactiva: las seis filas salen de
 * rutas-landing.ts y tocar una redibuja el mapa de al lado.
 */

export class Visor {
  private readonly pista: HTMLElement;
  private readonly vistas: HTMLElement[];
  private readonly tabs: HTMLButtonElement[];
  private readonly mapa: PhoneMap | null;
  private readonly filas: HTMLButtonElement[] = [];
  private soltar: (() => void) | null = null;
  private activa = -1;
  private rutaFijada = 'R-106';

  constructor(pista: HTMLElement, mapa: PhoneMap | null) {
    this.pista = pista;
    this.mapa = mapa;
    this.vistas = Array.from(pista.querySelectorAll<HTMLElement>('[data-visor]'));
    this.tabs = Array.from(pista.querySelectorAll<HTMLButtonElement>('[data-visor-tab]'));

    this.montarRutas(pista.querySelector<HTMLElement>('[data-visor-rutas]'));

    if (mapa) {
      mapa.showRoute(true);
      mapa.showPin(false);
      mapa.showBuses(false);
      this.elegirRuta(this.rutaFijada);
    }

    pista.style.setProperty('--tramos', String(this.vistas.length));

    for (const [i, tab] of this.tabs.entries()) {
      tab.addEventListener('click', () => this.irA(i));
      tab.addEventListener('keydown', (ev) => this.teclas(ev, i));
    }

    // Sin animaciones no hay pista que recorrer: las cinco piezas se
    // apilan una debajo de otra —lo hace el CSS— y quedan todas a la vista.
    if (sinMovimiento()) {
      for (const vista of this.vistas) vista.classList.add('is-activa');
      for (const tab of this.tabs) tab.tabIndex = 0;
      return;
    }

    this.soltar = seguirPista(pista, (p) => this.pintar(p));
  }

  private pintar(p: number): void {
    const { indice, dentro } = tramo(p, this.vistas.length);

    for (const [i, tab] of this.tabs.entries()) {
      tab.style.setProperty('--avance', `${i < indice ? 100 : i === indice ? dentro * 100 : 0}%`);
    }

    if (indice === this.activa) return;
    this.activa = indice;

    this.vistas.forEach((vista, i) => vista.classList.toggle('is-activa', i === indice));
    this.tabs.forEach((tab, i) => {
      const activa = i === indice;
      tab.classList.toggle('is-activa', activa);
      tab.setAttribute('aria-selected', String(activa));
      tab.tabIndex = activa ? 0 : -1;
    });
  }

  /** Deja la pista en la mitad del tramo `i`, que es donde la pieza se ve entera. */
  private irA(i: number): void {
    if (sinMovimiento()) {
      this.vistas[i]?.scrollIntoView({ block: 'center' });
      return;
    }
    const destino = scrollDePista(this.pista, (i + 0.5) / this.vistas.length);
    window.scrollTo({ top: destino, behavior: 'smooth' });
  }

  private teclas(ev: KeyboardEvent, i: number): void {
    const ultimo = this.tabs.length - 1;
    const salto =
      ev.key === 'ArrowRight' || ev.key === 'ArrowDown' ? Math.min(ultimo, i + 1)
      : ev.key === 'ArrowLeft' || ev.key === 'ArrowUp' ? Math.max(0, i - 1)
      : ev.key === 'Home' ? 0
      : ev.key === 'End' ? ultimo
      : -1;
    if (salto < 0) return;
    ev.preventDefault();
    this.tabs[salto]?.focus();
    this.irA(salto);
  }

  /** Las seis de Sobusa, con sus terminales y sus kilómetros de rutas.json. */
  private montarRutas(lista: HTMLElement | null): void {
    if (!lista) return;

    for (const ruta of YV_RUTAS.rutas) {
      const fila = document.createElement('button');
      fila.type = 'button';
      fila.className = 'visor-ruta';
      fila.dataset.ruta = ruta.id;
      fila.setAttribute('aria-pressed', String(ruta.id === this.rutaFijada));

      const nombre = document.createElement('span');
      nombre.className = 'visor-ruta-nombre';
      nombre.textContent = ruta.nombre;

      const datos = document.createElement('span');
      datos.className = 'visor-ruta-datos';
      datos.textContent = `${ruta.terminalA} → ${ruta.terminalB} · ${ruta.km} km`;

      fila.append(nombre, datos);
      fila.addEventListener('click', () => this.elegirRuta(ruta.id));
      fila.addEventListener('pointerenter', () => this.mapa?.setRoute(ruta.id));
      fila.addEventListener('pointerleave', () => this.mapa?.setRoute(this.rutaFijada));

      this.filas.push(fila);

      const li = document.createElement('li');
      li.append(fila);
      lista.append(li);
    }
  }

  private elegirRuta(id: string): void {
    this.rutaFijada = id;
    this.mapa?.setRoute(id);
    for (const fila of this.filas) {
      const activa = fila.dataset.ruta === id;
      fila.classList.toggle('is-activa', activa);
      fila.setAttribute('aria-pressed', String(activa));
    }
  }

  destroy(): void {
    this.soltar?.();
    this.soltar = null;
  }
}
