import { YV_RUTAS } from './data/rutas-landing';
import type { PhoneMap } from './phone-map';

/**
 * Las seis rutas de Sobusa, tocables, junto al último teléfono.
 *
 * Es la única parte de la sección que responde al dedo y no al scroll:
 * tocar una fila redibuja el recorrido del mockup de al lado, y pasar por
 * encima lo asoma sin fijarlo. Los nombres, las terminales y los
 * kilómetros salen de `rutas-landing.ts`, que es un volcado de rutas.json
 * —no hay ninguna ruta escrita a mano aquí.
 */

/** La C16, la misma que enseñan el hero y los cuatro momentos anteriores. */
const RUTA_INICIAL = 'R-106';

export class RutasLista {
  private readonly mapa: PhoneMap;
  private readonly filas: HTMLButtonElement[] = [];
  private fijada = RUTA_INICIAL;

  constructor(lista: HTMLElement, mapa: PhoneMap) {
    this.mapa = mapa;

    for (const ruta of YV_RUTAS.rutas) {
      const fila = document.createElement('button');
      fila.type = 'button';
      fila.className = 'paso-ruta';
      fila.dataset.ruta = ruta.id;

      const nombre = document.createElement('span');
      nombre.className = 'paso-ruta-nombre';
      nombre.textContent = ruta.nombre;

      const datos = document.createElement('span');
      datos.className = 'paso-ruta-datos';
      datos.textContent = `${ruta.terminalA} → ${ruta.terminalB} · ${ruta.km} km`;

      fila.append(nombre, datos);
      fila.addEventListener('click', () => this.elegir(ruta.id));
      fila.addEventListener('pointerenter', () => this.mapa.setRoute(ruta.id));
      fila.addEventListener('pointerleave', () => this.mapa.setRoute(this.fijada));
      fila.addEventListener('focus', () => this.mapa.setRoute(ruta.id));
      fila.addEventListener('blur', () => this.mapa.setRoute(this.fijada));

      this.filas.push(fila);

      const li = document.createElement('li');
      li.append(fila);
      lista.append(li);
    }

    this.mapa.showRoute(true);
    this.mapa.showPin(false);
    this.mapa.showBuses(false);
    this.elegir(this.fijada);
  }

  private elegir(id: string): void {
    this.fijada = id;
    this.mapa.setRoute(id);
    for (const fila of this.filas) {
      const activa = fila.dataset.ruta === id;
      fila.classList.toggle('is-activa', activa);
      fila.setAttribute('aria-pressed', String(activa));
    }
  }

  destroy(): void {
    this.mapa.destroy();
  }
}
