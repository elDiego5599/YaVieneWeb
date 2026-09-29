/**
 * Duerme lo que no se está viendo.
 *
 * La página respira: los paneles mueven despacio sus degradados, el pie
 * los agranda, los buses del hero levitan. El problema es que una
 * animación de `background-position` sobre un panel del tamaño de la
 * ventana no la mueve la tarjeta gráfica —hay que volver a pintar el
 * panel entero en cada cuadro—, y esas animaciones son `infinite`: siguen
 * corriendo cuando la sección lleva tres pantallas fuera de la vista.
 * Media docena a la vez es la diferencia entre bajar a sesenta cuadros y
 * bajar a tirones.
 *
 * Así que cada bloque grande se para al salir de pantalla y arranca al
 * volver, con un margen generoso para que nadie llegue a ver el arranque.
 * Lo que se ve no cambia; lo que cuesta, sí.
 */

/** Cuánto antes de asomar se despierta un bloque. */
const MARGEN = '200px 0px';

export class Reposo {
  readonly #ojo: IntersectionObserver;

  constructor(bloques: HTMLElement[]) {
    this.#ojo = new IntersectionObserver(
      (entradas) => {
        for (const entrada of entradas) {
          entrada.target.classList.toggle('en-reposo', !entrada.isIntersecting);
        }
      },
      { rootMargin: MARGEN }
    );
    for (const bloque of bloques) this.#ojo.observe(bloque);
  }

  destroy(): void {
    this.#ojo.disconnect();
  }
}

/**
 * Los bloques que valen la pena: las secciones de primer nivel y el pie.
 * No se baja a buscar elemento por elemento porque la clase se hereda
 * hacia dentro por selector, y observar doscientas cajas para apagar seis
 * animaciones sale más caro que la propia animación.
 */
export const dormirLoQueNoSeVe = (): Reposo | null => {
  const bloques = Array.from(
    document.querySelectorAll<HTMLElement>('main > section, .site-footer')
  );
  return bloques.length > 0 ? new Reposo(bloques) : null;
};
