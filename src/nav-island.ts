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
 *
 * Lo otro que hace, y que no tiene que ver con abrir y cerrar, es marcar
 * en qué sección está el que lee. Vive aquí porque es lo mismo que ya
 * hacía el velo de la cabecera —mirar el desplazamiento y tocar la
 * barra—, y en el mismo cuadro: son dos lecturas de medidas seguidas y
 * no dos oyentes de scroll compitiendo.
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

    // Fundido con el hero: arriba la cabecera es el mismo papel, sin velo
    // ni línea; al bajar aparecen los dos. Ver nav.css `.is-arriba`.
    const cabecera = isla.closest<HTMLElement>('.site-header');
    const marcarArriba = (): void => {
      cabecera?.classList.toggle('is-arriba', window.scrollY <= 4);
    };

    /*
      Dónde estás.

      La barra llevaba los tres enlaces del mismo color de principio a
      fin: se podía recorrer la página entera sin que dijera en ningún
      momento qué sección se estaba leyendo. Aquí se marca la que manda
      con `aria-current`, que es lo que anuncia el lector de pantalla, y
      nav.css le pone el trazo verde debajo.

      Sólo entran los enlaces que apuntan a una sección de esta misma
      página. En `empresas.html` también los hay desde que su menú dejó
      de mandar a la portada: «Panel de control», «Beneficios» y el botón
      del formulario se marcan igual que aquí; «Inicio» va a `/` y se
      queda fuera. Lo que allí no cambia es el
      rótulo de la barra plegada, que no lleva `data-nav-lugar` y dice
      siempre «Para empresas». El botón del mapa entra como uno más,
      porque es el único enlace que hay a esa sección.
    */
    const dianas: [HTMLElement, HTMLElement][] = [];
    for (const enlace of isla.querySelectorAll<HTMLAnchorElement>(
      '.nav-link[href^="#"], .nav-island-cta[href^="#"]'
    )) {
      const destino = document.getElementById(enlace.hash.slice(1));
      if (destino) dianas.push([destino, enlace]);
    }

    let marcado: HTMLElement | null = null;
    // El rótulo de la barra plegada. Debajo de 880 los enlaces no están a
    // la vista, así que la marca que se les pone no la ve nadie: el
    // nombre de la sección se escribe también aquí. Lo que se copia es
    // `data-lugar` si el enlace lo trae —el botón del mapa dice «Ver el
    // mapa en vivo», que arriba no pega— y si no, su propio texto.
    const lugar = isla.querySelector<HTMLElement>('[data-nav-lugar]');

    /*
      Manda la sección que cruza la línea de lectura: el 40 % del alto de
      la ventana, algo por encima de la mitad, que es donde se posa la
      vista al leer. La línea iba pegada debajo de la barra, y con una
      sección corta detrás de una larga fallaba: en `empresas.html`
      «Beneficios» mide 497 y el panel de encima 1072, así que con
      «Beneficios» ya entera en la pantalla el panel seguía debajo de la
      barra y era el que salía marcado. La barra queda como suelo, para
      que en una ventana muy baja la línea no suba por detrás de ella.

      Con esa regla, en el hero y en el pie no manda ninguna —ninguna de
      las dos tiene enlace— y la barra se queda sin marca, que es lo
      honesto: no hay a qué apuntar.
    */
    const mirar = (): void => {
      const linea = Math.max((cabecera?.offsetHeight ?? 0) + 8, window.innerHeight * 0.4);
      let manda: HTMLElement | null = null;
      for (const [seccion, enlace] of dianas) {
        const caja = seccion.getBoundingClientRect();
        if (caja.top <= linea && caja.bottom > linea) manda = enlace;
      }
      if (manda === marcado) return;
      marcado?.removeAttribute('aria-current');
      // `location` y no `page`: la sección está dentro de esta página, y
      // `page` es lo que gasta el enlace de una página en la que ya se
      // está. Los dos se ven igual, y eso lo decide la hoja.
      manda?.setAttribute('aria-current', 'location');
      marcado = manda;
      if (lugar) {
        lugar.textContent = manda ? manda.dataset.lugar || manda.textContent : '';
      }
    };

    // Las dos leen medidas, así que van juntas y una sola vez por cuadro:
    // el desplazamiento dispara muchos más avisos que pinturas.
    let repaso = 0;
    const repasar = (): void => {
      if (repaso) return;
      repaso = requestAnimationFrame(() => {
        repaso = 0;
        marcarArriba();
        mirar();
      });
    };

    marcarArriba();
    mirar();
    addEventListener('scroll', repasar, { passive: true });
    addEventListener('resize', repasar, { passive: true });
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
