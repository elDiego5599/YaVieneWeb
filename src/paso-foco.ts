/**
 * Cuál de los tres pasos se está contando ahora mismo.
 *
 * La sección se queda clavada mientras se baja: la pista mide varias
 * pantallas de alto y la escena se pega arriba, así que durante todo ese
 * recorrido la página no avanza y lo único que se mueve es la fila de los
 * tres pasos. Aquí se traduce ese recorrido a un número: cuánto se ha
 * bajado de la pista, repartido en tantos tramos como pasos haya.
 *
 * El reparto es plano —el primer tercio es el primer paso, y así— porque
 * la escena está pegada y no hay nada más con lo que comparar: no hay
 * columnas subiendo por la ventana ni centros que medir. Antes de que la
 * pista llegue arriba manda el primero, y pasado el final manda el
 * último, de modo que la sección nunca se ve sin ninguno encendido.
 *
 * Lo que hace con el número: enciende la columna que toca, mueve la fila
 * para dejarla en el centro —`data-activo` en la fila, que es de donde
 * cuelga el desplazamiento en el CSS— y avisa fuera para que sólo corra
 * el bucle de ese teléfono. Con la sección fuera de pantalla no manda
 * ninguno, que es lo que apaga los tres bucles a la vez; la fila se queda
 * donde estaba para que al volver no dé un salto.
 */
export interface PasoFocoPiezas {
  /** El bloque alto que se recorre mientras la escena está pegada. */
  pista: HTMLElement;
  /** La fila de los tres pasos, la que se desplaza. */
  pase: HTMLElement;
  columnas: HTMLElement[];
  marcas: HTMLElement[];
  alCambiar: (indice: number) => void;
  /**
   * El recorrido crudo, de 0 a 1 por toda la pista. Es lo que mueve la
   * línea de la lista lateral: `alCambiar` salta de paso en paso y esto
   * no salta nunca, así que la línea va suave aunque los pasos cambien
   * a golpes. Opcional para no romper a quien sólo quiera el discreto.
   */
  alAvanzar?: (avance: number) => void;
}

export class PasoFoco {
  private readonly piezas: PasoFocoPiezas;

  private actual = -1;
  private pedido = 0;
  private dentro = false;

  constructor(piezas: PasoFocoPiezas) {
    this.piezas = piezas;

    // Un margen generoso para que el primer paso ya esté encendido cuando
    // la sección asoma, y no arranque el bucle a mitad de gesto.
    const mirilla = new IntersectionObserver(
      ([entrada]) => {
        if (!entrada) return;
        this.dentro = entrada.isIntersecting;
        if (this.dentro) this.medir();
        else this.aplicar(-1);
      },
      { rootMargin: '300px 0px' }
    );
    mirilla.observe(piezas.pista);

    const avisar = () => {
      if (!this.dentro || this.pedido) return;
      this.pedido = requestAnimationFrame(() => {
        this.pedido = 0;
        this.medir();
      });
    };

    addEventListener('scroll', avisar, { passive: true });
    addEventListener('resize', avisar, { passive: true });
  }

  private medir(): void {
    const total = this.piezas.columnas.length;
    if (total === 0) return;

    const caja = this.piezas.pista.getBoundingClientRect();
    // Lo que la pista sobra por encima de la ventana es el recorrido real
    // de la escena pegada. Si no sobra nada —animaciones desactivadas,
    // pista encogida— manda el primero y no hay pase que valga.
    const recorrido = caja.height - innerHeight;
    if (recorrido <= 0) {
      this.piezas.alAvanzar?.(0);
      this.aplicar(0);
      return;
    }

    const avance = Math.min(1, Math.max(0, -caja.top / recorrido));
    this.piezas.alAvanzar?.(avance);
    this.aplicar(Math.min(total - 1, Math.floor(avance * total)));
  }

  private aplicar(indice: number): void {
    if (indice === this.actual) return;
    this.actual = indice;

    this.piezas.columnas.forEach((columna, i) => {
      columna.classList.toggle('is-activa', i === indice);
    });

    this.piezas.marcas.forEach((marca, i) => {
      marca.classList.toggle('is-activa', i === indice);
    });

    if (indice >= 0) this.piezas.pase.dataset.activo = String(indice);

    this.piezas.alCambiar(indice);
  }
}
