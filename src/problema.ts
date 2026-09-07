/**
 * El interruptor de «Qué resuelve».
 *
 * La sección enseña la misma espera dos veces: «A ciegas», que es el
 * problema, y «Con Ya Viene», que es lo que la app hace con él. Las dos
 * caras están escritas en el HTML y dibujadas en `componentes/problema.css`;
 * lo único que pasa aquí es mover el atributo `data-cara` de la sección,
 * que es de donde cuelga todo el cambio.
 *
 * Lo otro que hace, y por lo que no basta con dos `<button>` sueltos: el
 * lector de pantalla no puede oír las dos versiones del titular seguidas,
 * así que la cara que no toca se marca con `aria-hidden`.
 *
 * Y una cortesía: la primera vez que la sección asoma se cambia sola de
 * lado, una vez, para que se vea que el interruptor está ahí. Quien lo
 * toque antes cancela el aviso —a partir de ese momento manda quien lee—,
 * y quien haya pedido que nada se mueva no lo ve nunca.
 */

import { sinMovimiento } from './scrolly';

/** Lo que espera la sección, ya delante, antes de enseñar la otra cara. */
const ESPERA_MS = 2400;

/**
 * Cuánto tiene que verse de la sección para darla por mirada, y por
 * debajo de cuánto se da por abandonada. Son dos números y no uno para
 * que el cambio no se dispare y se deshaga en el borde exacto.
 */
const ASOMO_ENTRA = 0.7;
const ASOMO_SALE = 0.15;

/**
 * Una sección más alta que la ventana no llega nunca a enseñar el 70% de
 * sí misma —en un móvil ésta mide casi el doble—, así que vale también
 * con que ocupe la mayor parte de lo que se está viendo.
 */
const PANTALLA = 0.6;

export class Problema {
  private readonly seccion: HTMLElement;
  private readonly botones: HTMLButtonElement[];
  private ojo: IntersectionObserver | null = null;
  private reloj: number | null = null;

  constructor(seccion: HTMLElement) {
    this.seccion = seccion;
    this.botones = Array.from(
      seccion.querySelectorAll<HTMLButtonElement>('.interruptor-opcion')
    );

    for (const boton of this.botones) {
      boton.addEventListener('click', () => {
        // Un toque en el interruptor apaga el cambio automático: ya no
        // hace falta enseñar nada, se ha entendido.
        this.parar();
        this.poner(boton.dataset.cara ?? 'ciego');
      });
    }

    if (!sinMovimiento()) this.esperarAQueAsome();
  }

  destroy(): void {
    this.parar();
  }

  /**
   * El observador no se apaga después del primer aviso: la cuenta atrás
   * arranca cada vez que la sección se pone delante y se deshace cuando
   * se va. Así, quien vuelva a subir se encuentra otra vez el problema,
   * que es por donde hay que empezar a leerla —y, sobre todo, nadie se
   * pierde el cambio por haber pasado de largo mientras corría.
   */
  private esperarAQueAsome(): void {
    this.ojo = new IntersectionObserver(
      (entradas) => {
        for (const entrada of entradas) {
          if (this.seMira(entrada)) this.contar();
          else if (entrada.intersectionRatio <= ASOMO_SALE) this.rebobinar();
        }
      },
      { threshold: [0, ASOMO_SALE, ASOMO_ENTRA, 1] }
    );
    this.ojo.observe(this.seccion);
  }

  private seMira(entrada: IntersectionObserverEntry): boolean {
    if (!entrada.isIntersecting) return false;
    return (
      entrada.intersectionRatio >= ASOMO_ENTRA ||
      entrada.intersectionRect.height >= window.innerHeight * PANTALLA
    );
  }

  private contar(): void {
    if (this.reloj !== null) return;
    this.reloj = window.setTimeout(() => {
      this.reloj = null;
      this.poner('claro');
    }, ESPERA_MS);
  }

  private rebobinar(): void {
    if (this.reloj !== null) {
      window.clearTimeout(this.reloj);
      this.reloj = null;
    }
    this.poner('ciego');
  }

  private parar(): void {
    if (this.reloj !== null) {
      window.clearTimeout(this.reloj);
      this.reloj = null;
    }
    this.ojo?.disconnect();
    this.ojo = null;
  }

  private poner(cara: string): void {
    if (this.seccion.dataset.cara === cara) return;
    this.seccion.dataset.cara = cara;

    for (const boton of this.botones) {
      boton.setAttribute('aria-pressed', String(boton.dataset.cara === cara));
    }

    for (const rostro of this.seccion.querySelectorAll<Element>('.cara')) {
      if (rostro.classList.contains(`cara--${cara}`)) {
        rostro.removeAttribute('aria-hidden');
      } else {
        rostro.setAttribute('aria-hidden', 'true');
      }
    }
  }
}
