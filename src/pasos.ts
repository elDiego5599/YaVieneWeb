import { entre, seguirPista, sinMovimiento } from './scrolly';

/**
 * Los tres toques, uno encima de otro.
 *
 * Al principio sólo está el titular, grande. Al bajar, el titular se abre
 * —crece y se va— y detrás aparece el primer paso; después el primero se
 * abre igual y sale el segundo, y así. No es una lista que se lee de un
 * vistazo: es una cosa después de la otra, que es exactamente como se usa
 * la app.
 *
 * Cada paso entra desde un poco más lejos y sale hacia el ojo. El texto es
 * el mismo de siempre, palabra por palabra; lo único nuevo es cuándo se ve.
 */

/**
 * Cada paso tiene su turno, pero la entrada y la salida se pisan a
 * propósito: si el que sale terminara justo cuando el que entra empieza,
 * habría un tramo de pantalla vacía entre paso y paso. Estos cuatro
 * números son los bordes del fundido, medidos desde el centro del turno y
 * en unidades de turno.
 */
const ENTRA_DESDE = 0.78;
const ENTRA_HASTA = 0.16;
const SALE_DESDE = 0.34;
const SALE_HASTA = 0.96;

/** Dónde acaba la portada y empiezan los pasos, en avance de pista. */
const PORTADA_FIN = 0.2;

export class Pasos {
  private readonly portada: HTMLElement;
  private readonly pasos: HTMLElement[];
  private readonly fantasma: HTMLElement | null;
  private soltar: (() => void) | null = null;
  private activo = -1;

  constructor(pista: HTMLElement) {
    const portada = pista.querySelector<HTMLElement>('[data-pasos-portada]');
    this.pasos = Array.from(pista.querySelectorAll<HTMLElement>('[data-paso]'));
    if (!portada || this.pasos.length === 0) throw new Error('Pasos: faltan piezas');
    this.portada = portada;
    this.fantasma = pista.querySelector<HTMLElement>('[data-pasos-fantasma]');

    pista.style.setProperty('--tramos', String(this.pasos.length + 1));

    // Sin animaciones no hay pila que valga: los pasos se apilan en el
    // flujo normal —lo arma el CSS— y aquí sólo hay que quitarles el
    // maquillaje para que no queden invisibles.
    if (sinMovimiento()) {
      this.portada.removeAttribute('style');
      for (const paso of this.pasos) paso.removeAttribute('style');
      return;
    }

    this.soltar = seguirPista(pista, (p) => this.pintar(p));
  }

  private pintar(p: number): void {
    // La portada no se desvanece: se acerca hasta pasarse de largo, como si
    // la página entrara dentro de ella.
    const irse = entre(p, 0.03, PORTADA_FIN);
    this.portada.style.opacity = String(1 - irse);
    this.portada.style.transform = `scale(${1 + irse * 0.3}) translateY(${irse * -22}px)`;
    this.portada.style.filter = irse > 0 ? `blur(${irse * 12}px)` : 'none';
    this.portada.style.visibility = irse >= 1 ? 'hidden' : 'visible';

    const n = this.pasos.length;
    const ancho = (1 - PORTADA_FIN) / n;
    // Manda el más presente, no el que pase de medio: en mitad de un cruce
    // los dos andan por 0,5 y el número de fondo no puede parpadear.
    let activo = -1;
    let mayor = 0.2;

    this.pasos.forEach((paso, i) => {
      const centro = PORTADA_FIN + ancho * (i + 0.5);
      // El primero no se adelanta a la portada: arranca justo donde ella
      // acaba. Los demás sí, para cruzarse con el que van a relevar.
      const abre = i === 0 ? 0.5 : ENTRA_DESDE;
      const entra = entre(p, centro - ancho * abre, centro - ancho * ENTRA_HASTA);
      // El último no se va: si se fuera, la sección terminaría en blanco.
      const sale =
        i === n - 1 ? 0 : entre(p, centro + ancho * SALE_DESDE, centro + ancho * SALE_HASTA);

      const escala = 0.84 + 0.16 * entra + 0.2 * sale;
      const y = 34 * (1 - entra) - 26 * sale;
      const opacidad = entra * (1 - sale);
      const desenfoque = 14 * (1 - entra) + 12 * sale;

      paso.style.opacity = String(opacidad);
      paso.style.transform = `translateY(${y}px) scale(${escala})`;
      paso.style.filter = desenfoque > 0.4 ? `blur(${desenfoque}px)` : 'none';
      paso.style.visibility = opacidad <= 0.001 ? 'hidden' : 'visible';
      paso.classList.toggle('is-activo', opacidad > 0.5);

      if (opacidad > mayor) {
        mayor = opacidad;
        activo = i;
      }
    });

    if (activo !== this.activo) {
      this.activo = activo;
      if (this.fantasma) {
        this.fantasma.textContent = activo < 0 ? '' : String(activo + 1);
        this.fantasma.classList.toggle('is-visible', activo >= 0);
      }
    }
  }

  destroy(): void {
    this.soltar?.();
    this.soltar = null;
  }
}
