/**
 * Las pestañas de «Cómo funciona»: los tres pasos de la app (dueño,
 * 2026-10-12, como las de On-call de incident.io) gobiernan lo que enseña
 * el teléfono de encima.
 *
 * Es el patrón de pestañas de WAI-ARIA con activación automática: un
 * toque, o las flechas, Inicio y Fin desde el teclado, cambian el paso, y
 * el foco va con él (tabindex itinerante). La escena cuelga de
 * `data-paso`: el cambio de pantalla es CSS
 * (`componentes/como-funciona.css`), y con movimiento reducido se queda en
 * un fundido. Aquí solo se lleva el estado: `aria-selected`, qué pestaña
 * nombra la escena y cuál de las tres descripciones oye el lector, que es
 * lo único que dice en palabras lo que el teléfono enseña.
 */

import { sinMovimiento } from './scrolly';

export type OpcionesPasos = {
  intervalo?: number;
  alCambiar?: (paso: string) => void;
};

const TECLAS: Record<string, (i: number, n: number) => number> = {
  ArrowRight: (i, n) => (i + 1) % n,
  ArrowLeft: (i, n) => (i - 1 + n) % n,
  Home: () => 0,
  End: (_, n) => n - 1,
};

export class Pasos {
  readonly #pestanas: HTMLButtonElement[];
  readonly #escena: HTMLElement;
  readonly #descripciones: HTMLElement[];
  readonly #lista: HTMLElement | null;
  readonly #alCambiar: ((paso: string) => void) | undefined;
  #temporizador = 0;
  #observador?: IntersectionObserver;
  #activo = true;

  constructor(raiz: HTMLElement, opciones: OpcionesPasos = {}) {
    this.#pestanas = Array.from(raiz.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    this.#escena = raiz.querySelector<HTMLElement>('[role="tabpanel"]')!;
    this.#descripciones = Array.from(
      this.#escena.querySelectorAll<HTMLElement>('.solo-lectores[data-paso]')
    );
    this.#lista = raiz.querySelector<HTMLElement>('[role="tablist"]');
    this.#alCambiar = opciones.alCambiar;

    this.#pestanas.forEach((pestana, i) => {
      pestana.addEventListener('click', () => {
        this.#detener();
        this.#elegir(i);
      });
      pestana.addEventListener('keydown', (ev) => {
        this.#detener();
        const ir = TECLAS[ev.key];
        if (!ir) return;
        ev.preventDefault();
        const j = ir(i, this.#pestanas.length);
        this.#elegir(j);
        this.#pestanas[j].focus();
      });
    });

    if (opciones.intervalo && opciones.intervalo > 0 && !sinMovimiento()) {
      this.#lista?.setAttribute('data-auto', '');
      const arrancar = (): void => {
        if (this.#temporizador || !this.#activo) return;
        this.#temporizador = window.setInterval(() => {
          const actual = this.#pestanas.findIndex(p => p.getAttribute('aria-selected') === 'true');
          this.#elegir((actual + 1) % this.#pestanas.length);
        }, opciones.intervalo);
      };
      if ('IntersectionObserver' in window) {
        this.#observador = new IntersectionObserver(([entrada]) => {
          if (entrada.isIntersecting) arrancar();
          else {
            window.clearInterval(this.#temporizador);
            this.#temporizador = 0;
          }
        });
        this.#observador.observe(raiz);
      } else arrancar();
    }
  }

  #detener(): void {
    if (!this.#activo) return;
    this.#activo = false;
    window.clearInterval(this.#temporizador);
    this.#temporizador = 0;
    this.#observador?.disconnect();
    this.#lista?.removeAttribute('data-auto');
  }

  #elegir(indice: number): void {
    const elegida = this.#pestanas[indice];
    const paso = elegida.dataset.paso ?? '';
    for (const pestana of this.#pestanas) {
      const si = pestana === elegida;
      pestana.setAttribute('aria-selected', String(si));
      pestana.tabIndex = si ? 0 : -1;
    }
    this.#escena.dataset.paso = paso;
    this.#escena.closest('.cf-grid')?.setAttribute('data-paso', paso);
    this.#escena.setAttribute('aria-labelledby', elegida.id);
    for (const p of this.#descripciones) p.hidden = p.dataset.paso !== paso;
    this.#alCambiar?.(paso);
  }
}
