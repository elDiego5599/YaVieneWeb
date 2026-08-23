/**
 * NavIsland — la píldora de navegación que se abre y se cierra.
 *
 * Tuvo el despliegue en el CSS, con `:hover` y `:focus-within`, y de ahí
 * venía el fallo: al pulsar la ✕ el puntero sigue encima de la píldora y
 * el foco sigue dentro del botón, así que el CSS la reabría en el mismo
 * fotograma mientras esta clase la daba por cerrada. El icono se quedaba
 * en ✕ con la píldora abierta, el clic siguiente parecía no hacer nada y
 * sólo se recomponía al sacar el ratón.
 *
 * La solución no fue tapar ese caso, sino quitarle al CSS la decisión:
 * abrir y cerrar es poner y quitar `is-open`, y eso lo hace sólo este
 * módulo. El puntero, el teclado y el toque son tres maneras de pedir lo
 * mismo, y las tres pasan por aquí.
 *
 * El cierre por puntero lleva un respiro de `margenMs`. Sin él, el hueco
 * de 10 px entre la píldora y el panel desplegado en móvil, o un temblor
 * de la mano en el borde, cerraban el menú a mitad de camino.
 */

const MARGEN_MS = 120;

export class NavIsland {
  private readonly isla: HTMLElement;
  private readonly boton: HTMLButtonElement;
  private abierta = false;
  /** Cierre pendiente, mientras dura el respiro. */
  private pendiente: number | null = null;
  /**
   * Devolver el foco al botón tras cerrar con Escape dispara `focusin`, y
   * `focusin` abre. Este pestillo tapa ese único instante.
   */
  private devolviendoFoco = false;

  constructor(isla: HTMLElement, boton: HTMLButtonElement) {
    this.isla = isla;
    this.boton = boton;

    boton.addEventListener('click', () => {
      if (this.abierta) this.cerrar();
      else this.abrir();
    });

    // Puntero. `pointerenter` no llega en pantallas táctiles, así que el
    // toque sigue dependiendo del botón y no hay nada que filtrar aquí.
    isla.addEventListener('pointerenter', e => {
      if (e.pointerType === 'touch') return;
      this.abrir();
    });

    isla.addEventListener('pointerleave', e => {
      if (e.pointerType === 'touch') return;
      this.cerrarConMargen();
    });

    // Teclado: tabular hasta dentro la abre; salir del todo la cierra.
    isla.addEventListener('focusin', () => {
      if (this.devolviendoFoco) return;
      this.abrir();
    });
    isla.addEventListener('focusout', e => {
      const va = e.relatedTarget;
      if (va instanceof Node && isla.contains(va)) return;
      this.cerrar();
    });

    // Un enlace lleva a otra sección: la isla ya cumplió y se recoge.
    for (const enlace of isla.querySelectorAll('a')) {
      enlace.addEventListener('click', () => this.cerrar());
    }

    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape' || !this.abierta) return;
      this.cerrar();
      // El foco vuelve al botón: quien la abrió con el teclado no queda
      // perdido dentro de un menú que ya no está.
      this.devolviendoFoco = true;
      this.boton.focus({ preventScroll: true });
      this.devolviendoFoco = false;
    });

    // Un toque fuera la cierra: en táctil no hay puntero que se aleje.
    document.addEventListener('pointerdown', e => {
      if (!this.abierta) return;
      if (e.target instanceof Node && isla.contains(e.target)) return;
      this.cerrar();
    });

    window.addEventListener('scroll', () => this.cerrar(), { passive: true });
  }

  private abrir(): void {
    this.cancelarPendiente();
    if (this.abierta) return;
    this.abierta = true;
    this.isla.classList.add('is-open');
    this.boton.setAttribute('aria-expanded', 'true');
    this.boton.setAttribute('aria-label', 'Cerrar el menú');
  }

  private cerrar(): void {
    this.cancelarPendiente();
    if (!this.abierta) return;
    this.abierta = false;
    this.isla.classList.remove('is-open');
    this.boton.setAttribute('aria-expanded', 'false');
    this.boton.setAttribute('aria-label', 'Abrir el menú');
  }

  private cerrarConMargen(): void {
    this.cancelarPendiente();
    this.pendiente = window.setTimeout(() => {
      this.pendiente = null;
      this.cerrar();
    }, MARGEN_MS);
  }

  private cancelarPendiente(): void {
    if (this.pendiente === null) return;
    window.clearTimeout(this.pendiente);
    this.pendiente = null;
  }
}
