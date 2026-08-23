import { entre, scrollDePista, seguirPista, sinMovimiento } from './scrolly';

/**
 * La solución, momento por momento, sobre una cinta que corre hacia la
 * izquierda.
 *
 * Al principio sólo está el titular, grande y centrado. Al bajar, el
 * titular se abre —crece y se va— y detrás empieza a pasar la cinta: cada
 * momento entra por la derecha, se planta en el centro y sale por la
 * izquierda para que llegue el siguiente. Todo viaja en la misma
 * dirección, que es lo que hace que se lea como una cosa después de otra
 * y no como cinco tarjetas iguales apiladas.
 *
 * Lo importante es el descanso: en la mitad de su turno el momento se
 * queda completamente quieto, y ése es el rato en el que el teléfono hace
 * su demo. La animación no se corta a media frase para dar paso a la
 * siguiente; termina, y después la cinta vuelve a moverse.
 */

/**
 * Bordes del cruce, en unidades de turno. El que entra empieza antes de
 * que acabe el turno anterior y el que sale termina ya dentro del
 * siguiente: si no se pisaran, quedaría un tramo de pantalla vacía entre
 * momento y momento.
 */
const ENTRA_DESDE = 0.18;
const ENTRA_HASTA = 0.16;
const SALE_DESDE = 0.16;
const SALE_HASTA = 0.18;

/** Cuánto viaja cada momento de lado, en píxeles. */
const VIAJE = 210;

/** Dónde acaba la portada y empieza la cinta, en avance de pista. */
const PORTADA_FIN = 0.17;

/**
 * La portada termina de irse antes de que le toque el turno al primer
 * momento, y el primero empieza a entrar antes de que ella acabe: entre
 * los dos hay que dejar solape, o queda un tramo de scroll con la sección
 * vacía. Los dos números son fracciones del turno de la portada.
 */
const PORTADA_FUNDE = 0.8;
const PRIMERO_DESDE = 0.3;

export class Pasos {
  private readonly portada: HTMLElement;
  private readonly pasos: HTMLElement[];
  private readonly riel: HTMLElement | null;
  private readonly pestanas: HTMLElement[];
  private readonly pista: HTMLElement;
  private soltar: (() => void) | null = null;
  private reposo = -1;

  /** Le dice a main.ts qué teléfono está quieto y le toca moverse. */
  alReposo: ((indice: number) => void) | null = null;

  constructor(pista: HTMLElement) {
    const portada = pista.querySelector<HTMLElement>('[data-pasos-portada]');
    this.pasos = Array.from(pista.querySelectorAll<HTMLElement>('[data-paso]'));
    if (!portada || this.pasos.length === 0) throw new Error('Pasos: faltan piezas');
    this.pista = pista;
    this.portada = portada;
    this.riel = pista.querySelector<HTMLElement>('.pasos-riel');
    this.pestanas = Array.from(pista.querySelectorAll<HTMLElement>('[data-pasos-tab]'));

    pista.style.setProperty('--tramos', String(this.pasos.length + 1));

    // Sin animaciones no hay cinta que valga: los momentos se apilan en el
    // flujo normal —lo arma el CSS— y aquí sólo hay que quitarles el
    // maquillaje para que no queden invisibles.
    if (sinMovimiento()) {
      this.portada.removeAttribute('style');
      for (const paso of this.pasos) paso.removeAttribute('style');
      return;
    }

    this.pestanas.forEach((pestana, i) => {
      pestana.addEventListener('click', () => this.irA(i));
    });

    this.soltar = seguirPista(pista, (p) => this.pintar(p));
  }

  /** Lleva el scroll al centro del descanso de un momento. */
  private irA(indice: number): void {
    const ancho = (1 - PORTADA_FIN) / this.pasos.length;
    scrollDePista(this.pista, PORTADA_FIN + ancho * (indice + 0.5));
  }

  private pintar(p: number): void {
    // La portada no se desvanece de lado: se acerca hasta pasarse de
    // largo, como si la página entrara dentro de ella.
    const irse = entre(p, 0.03, PORTADA_FIN * PORTADA_FUNDE);
    this.portada.style.opacity = String(1 - irse);
    this.portada.style.transform = `scale(${1 + irse * 0.34}) translateY(${irse * -24}px)`;
    this.portada.style.filter = irse > 0 ? `blur(${irse * 14}px)` : 'none';
    this.portada.style.visibility = irse >= 1 ? 'hidden' : 'visible';

    this.riel?.classList.toggle('is-visible', irse > 0.6);

    const n = this.pasos.length;
    const ancho = (1 - PORTADA_FIN) / n;
    let reposo = -1;

    this.pasos.forEach((paso, i) => {
      const inicio = PORTADA_FIN + ancho * i;
      const fin = inicio + ancho;

      // El primero se adelanta menos que los demás: pisa la cola de la
      // portada lo justo para que no haya pantalla en blanco entre las dos.
      const desde = inicio - ancho * (i === 0 ? PRIMERO_DESDE : ENTRA_DESDE);
      const entra = entre(p, desde, inicio + ancho * ENTRA_HASTA);
      // El último no se va: si se fuera, la sección terminaría en blanco.
      const sale =
        i === n - 1 ? 0 : entre(p, fin - ancho * SALE_DESDE, fin + ancho * SALE_HASTA);

      // Un solo eje y un solo sentido: entra por la derecha, se planta,
      // sale por la izquierda.
      const x = VIAJE * (1 - entra) - VIAJE * sale;
      const opacidad = entra * (1 - sale);
      const desenfoque = 12 * (1 - entra) + 12 * sale;
      const quieto = entra > 0.995 && sale < 0.005;

      paso.style.opacity = String(opacidad);
      paso.style.transform = quieto ? 'none' : `translate3d(${x.toFixed(2)}px, 0, 0)`;
      paso.style.filter = desenfoque > 0.4 ? `blur(${desenfoque.toFixed(2)}px)` : 'none';
      paso.style.visibility = opacidad <= 0.001 ? 'hidden' : 'visible';
      paso.classList.toggle('is-activo', opacidad > 0.5);

      // El teléfono viaja un poco más que su texto: al cruzarse, la mano
      // que lleva el aparato va por delante de la frase que lo explica.
      const toma = paso.querySelector<HTMLElement>('.paso-toma');
      if (toma) {
        const extra = x * 0.34;
        toma.style.transform = quieto ? 'none' : `translate3d(${extra.toFixed(2)}px, 0, 0)`;
      }

      const avance = entre(p, inicio, fin);
      const pestana = this.pestanas[i];
      if (pestana) {
        pestana.classList.toggle('is-activa', avance > 0 && avance < 1);
        const barra = pestana.querySelector<HTMLElement>('.pasos-tab-avance');
        if (barra) barra.style.setProperty('--avance', `${(avance * 100).toFixed(1)}%`);
      }

      if (quieto) reposo = i;
    });

    if (reposo !== this.reposo) {
      this.reposo = reposo;
      this.alReposo?.(reposo);
    }
  }

  destroy(): void {
    this.soltar?.();
    this.soltar = null;
  }
}
