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
 *
 * El texto del paso, al lado, es un carrusel (dueño, 2026-10-12): cada
 * `.cf-explica` lleva su `data-lugar` (antes, actual, después).
 *
 * La escena va en el mismo carrusel, con su cuadro entero (dueño,
 * 2026-10-13): es una sola (la del lector y la que anima `main.ts`), así
 * que la que se ve salir es una copia muda
 * (`.cf-escena--fantasma`) que se quita al llegar.
 *
 * Los pasos dan la vuelta: del primero hacia atrás se va al último, y al
 * revés. El paso que llega rebota (`data-rebote`, dueño, 2026-10-13).
 */

import { sinMovimiento } from './scrolly';

export type OpcionesPasos = {
  intervalo?: number;
  alCambiar?: (paso: string) => void;
};

/** Los 560 ms del desliz con rebote y un margen; luego la copia sobra. */
const VIAJE = 600;

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
  readonly #cuadricula: Element | null;
  readonly #texto: HTMLElement | null;
  readonly #explicas: HTMLElement[];
  readonly #marco: HTMLElement | null;
  #fantasma: HTMLElement | null = null;
  readonly #saliendo = new Map<HTMLElement, number>();
  #preparada = '';
  #llegada = 0;
  #rebote = 0;
  #temporizador = 0;
  #observador?: IntersectionObserver;
  #activo = true;
  #enVista = true;

  constructor(raiz: HTMLElement, opciones: OpcionesPasos = {}) {
    this.#pestanas = Array.from(raiz.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    this.#escena = raiz.querySelector<HTMLElement>('[role="tabpanel"]')!;
    this.#descripciones = Array.from(
      this.#escena.querySelectorAll<HTMLElement>('.solo-lectores[data-paso]')
    );
    this.#lista = raiz.querySelector<HTMLElement>('[role="tablist"]');
    this.#alCambiar = opciones.alCambiar;
    this.#cuadricula = this.#escena.closest('.cf-grid');
    this.#texto = this.#cuadricula?.querySelector<HTMLElement>('.cf-texto') ?? null;
    this.#explicas = Array.from(this.#texto?.querySelectorAll<HTMLElement>('.cf-explica[data-paso]') ?? []);
    this.#marco = this.#escena.parentElement?.classList.contains('cf-marco') ? this.#escena.parentElement : null;
    const controles = Array.from(this.#escena.closest('.cf-carrusel')?.querySelectorAll<HTMLButtonElement>('.cf-control') ?? []);
    controles.forEach((control, i) => {
      control.hidden = false;
      control.addEventListener('click', () => {
        this.#detener();
        // El foco se queda en la flecha: se puede seguir pulsando.
        this.#moverConFlecha(i === 0 ? 'ArrowLeft' : 'ArrowRight', this.#actual(), false);
      });
    });

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
        if (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') {
          this.#moverConFlecha(ev.key, i);
          return;
        }
        const j = ir(i, this.#pestanas.length);
        this.#elegir(j);
        this.#pestanas[j].focus();
      });
    });

    if (opciones.intervalo && opciones.intervalo > 0 && !sinMovimiento()) {
      // La barrita (`data-auto`) corre con el reloj, no con la carga: solo
      // cuando el carrusel se ve, y vuelve a empezar al reanudar, a la par
      // del intervalo nuevo (dueño, 2026-10-13).
      const arrancar = (): void => {
        if (this.#temporizador || !this.#activo || document.hidden || !this.#enVista) return;
        this.#lista?.setAttribute('data-auto', '');
        this.#temporizador = window.setInterval(() => {
          this.#elegir((this.#actual() + 1) % this.#pestanas.length, 'adelante');
        }, opciones.intervalo);
      };
      const pausar = (): void => {
        window.clearInterval(this.#temporizador);
        this.#temporizador = 0;
        this.#lista?.removeAttribute('data-auto');
      };
      if ('IntersectionObserver' in window) {
        this.#observador = new IntersectionObserver(([entrada]) => {
          this.#enVista = entrada.isIntersecting;
          if (this.#enVista) arrancar();
          else pausar();
        });
        this.#observador.observe(raiz);
      } else arrancar();
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) pausar();
        else arrancar();
      });
    }
  }

  #moverConFlecha(tecla: 'ArrowLeft' | 'ArrowRight', indice = this.#actual(), enfocar = true): void {
    const j = TECLAS[tecla](indice, this.#pestanas.length);
    const lado = tecla === 'ArrowRight' ? 'adelante' : 'atras';
    const vuelta = lado === 'adelante' ? j < indice : j > indice;
    this.#elegir(j, vuelta ? (lado === 'adelante' ? 'atras' : 'adelante') : lado, vuelta);
    if (enfocar) this.#pestanas[j].focus();
  }

  #actual(): number {
    return this.#pestanas.findIndex(p => p.getAttribute('aria-selected') === 'true');
  }

  #detener(): void {
    if (!this.#activo) return;
    this.#activo = false;
    window.clearInterval(this.#temporizador);
    this.#temporizador = 0;
    this.#observador?.disconnect();
    this.#lista?.removeAttribute('data-auto');
  }

  /* El texto del paso entra por el lado hacia el que se va: la pestaña de
     la derecha llega desde la derecha, la de la izquierda desde la
     izquierda, y la vuelta automática del tercero al primero sigue
     adelante, porque es el mismo recorrido que viene repitiendo. El paso
     que aún va saliendo vuelve por donde iba, sin rebote: si no, su texto
     saltaría al otro lado mientras su cuadro sigue yéndose. */
  #elegir(indice: number, direccion = indice >= this.#actual() ? 'adelante' : 'atras', rebote = false): void {
    const elegida = this.#pestanas[indice];
    const paso = elegida.dataset.paso ?? '';
    const vuela = this.#enVuelo(paso);
    if (vuela) {
      direccion = vuela.dataset.lugar === 'despues' ? 'adelante' : 'atras';
      rebote = false;
    }
    for (const pestana of this.#pestanas) {
      const si = pestana === elegida;
      pestana.setAttribute('aria-selected', String(si));
      pestana.tabIndex = si ? 0 : -1;
    }
    const entrada = direccion === 'adelante' ? 'despues' : 'antes';
    window.clearTimeout(this.#rebote);
    if (rebote && !sinMovimiento()) {
      this.#cuadricula?.setAttribute('data-rebote', '');
      this.#rebote = window.setTimeout(() => this.#cuadricula?.removeAttribute('data-rebote'), VIAJE);
    } else this.#cuadricula?.removeAttribute('data-rebote');
    this.#moverEscena(paso, entrada);
    this.#cuadricula?.setAttribute('data-paso', paso);
    this.#cuadricula?.setAttribute('data-direccion', direccion);
    this.#escena.setAttribute('aria-labelledby', elegida.id);
    for (const p of this.#descripciones) p.hidden = p.dataset.paso !== paso;
    this.#mover(paso, entrada);
    this.#alCambiar?.(paso);
  }

  /* El que entra se pone primero, sin animar, en el lado por donde llega;
     luego el que estaba se va al otro
     lado y el resto espera también fuera, por el lado de salida. */
  #mover(paso: string, entrada: 'antes' | 'despues'): void {
    const nueva = this.#explicas.find(e => e.dataset.paso === paso);
    if (!nueva || nueva.dataset.lugar === 'actual') return this.#soltarTextos();
    const salida = entrada === 'despues' ? 'antes' : 'despues';
    if (nueva.dataset.lugar !== entrada) {
      delete nueva.dataset.sale;
      nueva.dataset.lugar = entrada;
      void nueva.offsetWidth;
    }
    for (const e of this.#explicas) {
      if (e === nueva) continue;
      // El que aún viaja sigue su viaje, como su copia del cuadro; solo
      // salta, por detrás del recorte, el que ya llegó a su sitio.
      if (e.dataset.lugar === 'actual') {
        this.#fijar(e);
        this.#salir(e);
      } else if (e.hasAttribute('data-sale')) continue;
      e.dataset.lugar = salida;
    }
    this.#fijar(nueva);
    nueva.dataset.lugar = 'actual';
    this.#soltarTextos();
  }

  /* Lo que quedó fijo donde se veía sale de ahí hacia su sitio. */
  #soltarTextos(): void {
    for (const e of this.#explicas) e.style.removeProperty('translate');
  }

  /* El texto que se va lleva `data-sale` (su transición) hasta llegar. */
  #salir(e: HTMLElement): void {
    e.dataset.sale = '';
    window.clearTimeout(this.#saliendo.get(e));
    this.#saliendo.set(e, window.setTimeout(() => delete e.dataset.sale, VIAJE));
  }

  /* Un texto que cambia de rumbo a medio viaje se fija donde está y sale
     de ahí con un desliz entero, como el cuadro (que siempre parte de
     donde se ve): el navegador, al invertir una transición, la acorta y la
     curva ya no coincide con la del cuadro. */
  #fijar(e: HTMLElement): void {
    const corre = e
      .getAnimations?.()
      .some(a => (a as CSSTransition).transitionProperty === 'translate' && a.playState === 'running');
    if (!corre) return;
    const donde = getComputedStyle(e).translate;
    e.style.transition = 'none';
    e.style.translate = donde;
    void e.offsetWidth;
    e.style.removeProperty('transition');
  }

  /* Una copia de la escena que se ve y no se oye: sin ids, sin pestaña que
     la nombre, sin las descripciones ni el toque, y sin las animaciones de
     `main.ts` a medias, que volverían a empezar. Va detrás de la viva, así
     `querySelector('.cf-escena')` sigue dando esa. La que asomaba sin irse
     sobra; la que ya se va termina su viaje y se quita sola. */
  #copiar(paso: string, lugar: string): HTMLElement {
    if (this.#fantasma && !this.#fantasma.hasAttribute('data-sale')) this.#fantasma.remove();
    const copia = this.#escena.cloneNode(true) as HTMLElement;
    copia.removeAttribute('id');
    copia.removeAttribute('role');
    copia.removeAttribute('aria-labelledby');
    copia.removeAttribute('data-entra');
    copia.setAttribute('aria-hidden', 'true');
    copia.inert = true;
    copia.classList.add('cf-escena--fantasma');
    for (const e of copia.querySelectorAll('.solo-lectores, .cf-tap')) e.remove();
    for (const e of copia.querySelectorAll('[id]')) e.removeAttribute('id');
    for (const e of copia.querySelectorAll('.cf-aviso-rodando, .cf-guardando')) {
      e.classList.remove('cf-aviso-rodando', 'cf-guardando');
    }
    copia.dataset.paso = paso;
    copia.dataset.lugar = lugar;
    this.#escena.after(copia);
    this.#fantasma = copia;
    return copia;
  }

  /* La copia de ese paso que aún va saliendo, si la hay. */
  #enVuelo(paso: string): HTMLElement | undefined {
    return Array.from(this.#marco?.querySelectorAll<HTMLElement>('.cf-escena--fantasma[data-sale]') ?? []).find(
      f => f.dataset.paso === paso,
    );
  }

  /* La copia se va animada y, al llegar, se quita. */
  #irse(copia: HTMLElement): void {
    copia.dataset.sale = '';
    window.setTimeout(() => {
      copia.remove();
      if (this.#fantasma === copia) this.#fantasma = null;
    }, VIAJE);
  }

  /* Deja la escena lista para entrar: la de ahora, copiada, donde se ve
     (en el centro, bajo el dedo o a medio viaje si se cambió de paso
     antes de llegar); la viva, ya con su paso, en el lado por donde
     llega. Sin animar: se fuerza el cálculo para que el desliz parta de
     ahí. */
  #preparar(paso: string, entrada: 'antes' | 'despues'): void {
    const donde = getComputedStyle(this.#escena).translate;
    const copia = this.#copiar(this.#escena.dataset.paso ?? '', 'actual');
    if (donde && donde !== 'none') copia.style.translate = donde;
    void copia.offsetWidth;
    this.#escena.dataset.entra = '';
    this.#escena.dataset.paso = paso;
    this.#escena.dataset.lugar = entrada;
    // Si ese paso aún iba saliendo, la viva parte de donde va su copia, y
    // la copia sobra.
    const vuela = this.#enVuelo(paso);
    const desde = vuela && getComputedStyle(vuela).translate;
    if (desde && desde !== 'none') this.#escena.style.translate = desde;
    vuela?.remove();
    void this.#escena.offsetWidth;
    this.#preparada = paso;
  }

  #moverEscena(paso: string, entrada: 'antes' | 'despues'): void {
    if (!this.#marco || sinMovimiento()) {
      this.#escena.dataset.paso = paso;
      return;
    }
    if (this.#preparada !== paso) {
      if (this.#escena.dataset.paso === paso) return;
      this.#preparar(paso, entrada);
    }
    this.#preparada = '';
    const vieja = this.#fantasma!;
    vieja.style.removeProperty('translate');
    vieja.dataset.lugar = entrada === 'despues' ? 'antes' : 'despues';
    this.#irse(vieja);
    this.#escena.style.removeProperty('translate');
    this.#escena.dataset.lugar = 'actual';
    window.clearTimeout(this.#llegada);
    this.#llegada = window.setTimeout(() => delete this.#escena.dataset.entra, VIAJE);
  }


}
