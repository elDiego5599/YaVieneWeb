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
 * `.cf-explica` lleva su `data-lugar` (antes, actual, después) y se puede
 * arrastrar con el ratón o el dedo, pegado 1:1; al soltar se proyecta la
 * velocidad (la fórmula de las listas de iOS) y se pasa de paso si el
 * gesto llevaba a más de un tercio del ancho.
 *
 * La escena va en el mismo carrusel, con su cuadro entero (dueño,
 * 2026-10-13): es una sola (la del lector y la que anima `main.ts`), así
 * que la que se ve salir, o asomar al arrastrar, es una copia muda
 * (`.cf-escena--fantasma`) que se quita al llegar.
 *
 * Los pasos dan la vuelta: del primero hacia atrás se va al último, y al
 * revés. Ahí el arrastre cede menos que el dedo (la goma de iOS) y el paso
 * que llega rebota (`data-rebote`, dueño, 2026-10-13).
 */

import { sinMovimiento } from './scrolly';

export type OpcionesPasos = {
  intervalo?: number;
  alCambiar?: (paso: string) => void;
};

/** Los 560 ms del desliz con rebote y un margen; luego la copia sobra. */
const VIAJE = 600;

/** Lo que se mueve el dedo antes de que el gesto sea de lado (o no). */
const UMBRAL = 10;

/** Dónde acabaría un gesto que se suelta a `v` px/ms: la deceleración de
    las listas de iOS (0,998 por milisegundo). */
const proyectar = (v: number): number => (v * 0.998) / (1 - 0.998);

/** Lo que cede el paso cuando se tira más allá de un extremo: la goma de
    iOS (constante 0,55), que frena más cuanto más se tira. */
const goma = (dx: number, ancho: number): number => (dx * ancho * 0.55) / (ancho + 0.55 * Math.abs(dx));

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
    this.#arrastrable([this.#texto, this.#marco].filter((e): e is HTMLElement => e !== null));

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
        // Las flechas dan vuelta en círculo: su lado es el de la tecla, y
        // al dar la vuelta rebota como el arrastre.
        const lado = ev.key === 'ArrowRight' ? 'adelante' : ev.key === 'ArrowLeft' ? 'atras' : undefined;
        this.#elegir(j, lado, lado === 'adelante' ? j < i : lado === 'atras' && j > i);
        this.#pestanas[j].focus();
      });
    });

    if (opciones.intervalo && opciones.intervalo > 0 && !sinMovimiento()) {
      this.#lista?.setAttribute('data-auto', '');
      const arrancar = (): void => {
        if (this.#temporizador || !this.#activo) return;
        this.#temporizador = window.setInterval(() => {
          this.#elegir((this.#actual() + 1) % this.#pestanas.length, 'adelante');
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

  /* El que entra se pone primero, sin animar, en el lado por donde llega
     (si el arrastre no lo dejó ya ahí); luego el que estaba se va al otro
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

  /* Al agarrar, lo que aún viaja se planta: el gesto manda. */
  #plantar(): void {
    window.clearTimeout(this.#llegada);
    window.clearTimeout(this.#rebote);
    this.#cuadricula?.removeAttribute('data-rebote');
    for (const f of this.#marco?.querySelectorAll('.cf-escena--fantasma') ?? []) f.remove();
    this.#fantasma = null;
    delete this.#escena.dataset.entra;
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

  /* El arrastre: tras 10 px se decide si el gesto es de lado; si lo es, el
     texto sigue al dedo y el vecino de ese lado asoma. Al soltar, la
     velocidad de los últimos ~100 ms se proyecta y decide. */
  #arrastrable(asas: HTMLElement[]): void {
    const grid = (this.#cuadricula as HTMLElement | null) ?? asas[0];
    if (!grid) return;
    let asa: HTMLElement = asas[0];
    let inicio: { x: number; y: number } | null = null;
    let deLado = false;
    let muestras: { x: number; t: number }[] = [];
    let dedo = -1;
    const n = this.#pestanas.length;
    const vecino = (dx: number): number => (this.#actual() + (dx < 0 ? 1 : n - 1)) % n;
    // Del primero hacia atrás, o del último hacia adelante: da la vuelta.
    const daVuelta = (dx: number): boolean => (dx > 0 ? this.#actual() === 0 : this.#actual() === n - 1);
    const asomar = (dx: number): void => {
      const paso = this.#pestanas[vecino(dx)].dataset.paso;
      const lado = dx < 0 ? 'despues' : 'antes';
      for (const e of this.#explicas) {
        if (e.dataset.paso === paso && e.dataset.lugar !== lado) e.dataset.lugar = lado;
      }
      const f = this.#fantasma;
      if (this.#marco && !sinMovimiento() && (!f || f.dataset.paso !== paso || f.dataset.lugar !== lado)) {
        this.#copiar(paso ?? '', lado);
      }
    };
    const soltar = (): void => {
      grid.removeAttribute('data-arrastrando');
      grid.style.removeProperty('--cf-arrastre');
    };

    const empezar = (ev: PointerEvent): void => {
      // Un segundo dedo, o otro botón, no empieza otro gesto (el mismo
      // puntero sí: si apretó otra vez, el gesto de antes ya terminó).
      if (ev.button > 0 || (inicio && ev.pointerId !== dedo)) return;
      dedo = ev.pointerId;
      asa = ev.currentTarget as HTMLElement;
      inicio = { x: ev.clientX, y: ev.clientY };
      deLado = false;
      muestras = [{ x: ev.clientX, t: performance.now() }];
    };
    const mover = (ev: PointerEvent): void => {
      if (!inicio || ev.pointerId !== dedo) return;
      // Un ratón que soltó fuera, antes de que el gesto fuera de lado
      // (sin captura no llega el `pointerup`): ya no hay gesto.
      if (ev.pointerType === 'mouse' && ev.buttons === 0) {
        inicio = null;
        return;
      }
      const dx = ev.clientX - inicio.x;
      const dy = ev.clientY - inicio.y;
      if (!deLado) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) < UMBRAL) return;
        if (Math.abs(dy) > Math.abs(dx)) {
          inicio = null;
          return;
        }
        deLado = true;
        this.#detener();
        this.#plantar();
        grid.setAttribute('data-arrastrando', '');
        asa.setPointerCapture?.(ev.pointerId);
      }
      asomar(dx);
      const sigue = daVuelta(dx) ? goma(dx, asa.clientWidth || 1) : dx;
      grid.style.setProperty('--cf-arrastre', `${sigue}px`);
      const t = performance.now();
      muestras.push({ x: ev.clientX, t });
      muestras = muestras.filter(m => t - m.t <= 100);
    };
    const terminar = (ev: PointerEvent): void => {
      if (ev.pointerId !== dedo) return;
      if (!inicio || !deLado) {
        inicio = null;
        return;
      }
      const dx = ev.clientX - inicio.x;
      const t = performance.now();
      muestras.push({ x: ev.clientX, t });
      const viejas = muestras.filter(m => t - m.t <= 100);
      const primera = viejas[0];
      const v = primera && t > primera.t ? (ev.clientX - primera.x) / (t - primera.t) : 0;
      const llega = dx + proyectar(v);
      inicio = null;
      const ancho = asa.clientWidth || 1;
      if (ev.type === 'pointerup' && Math.abs(llega) > ancho / 3 && Math.sign(llega) === Math.sign(dx)) {
        const j = vecino(dx);
        // La escena se cambia aún pegada al dedo, para que el desliz salga
        // de donde se soltó y no del centro.
        if (this.#marco && !sinMovimiento()) {
          this.#preparar(this.#pestanas[j].dataset.paso ?? '', dx < 0 ? 'despues' : 'antes');
        }
        // El texto también se queda donde lo dejó el dedo, y de ahí sale.
        for (const e of this.#explicas) e.style.translate = getComputedStyle(e).translate;
        const vuelta = daVuelta(dx);
        soltar();
        this.#elegir(j, dx < 0 ? 'adelante' : 'atras', vuelta);
      } else {
        soltar();
        // Vuelve a su sitio: el vecino que asomaba también se va animado.
        for (const e of this.#explicas) if (e.dataset.lugar !== 'actual') this.#salir(e);
        if (this.#fantasma) this.#irse(this.#fantasma);
      }
    };
    for (const e of asas) {
      e.addEventListener('pointerdown', empezar);
      e.addEventListener('pointermove', mover);
      e.addEventListener('pointerup', terminar);
      e.addEventListener('pointercancel', terminar);
    }
  }
}
