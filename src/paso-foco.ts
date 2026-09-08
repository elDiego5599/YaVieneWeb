/**
 * Cuál de los tres pasos se está contando ahora mismo.
 *
 * La sección se queda clavada mientras se baja: la pista mide varias
 * pantallas de alto y la escena se pega arriba, así que durante todo ese
 * recorrido la página no avanza y lo único que cambia es cuál de los tres
 * pasos manda. Aquí se traduce ese recorrido a un número: cuánto se ha
 * bajado de la pista, repartido en tantos tramos como pasos haya.
 *
 * El reparto es plano —el primer tercio es el primer paso, y así— porque
 * la escena está pegada y no hay nada más con lo que comparar: no hay
 * columnas subiendo por la ventana ni centros que medir. Antes de que la
 * pista llegue arriba manda el primero, y pasado el final manda el
 * último, de modo que la sección nunca se ve sin ninguno encendido.
 *
 * De aquí sale un número entero y nada más. Antes salía también un
 * continuo con decimales, y de él colgaba todo lo que se veía: la fila
 * corría pegada al dedo y cada teléfono crecía, se aclaraba y se enfocaba
 * fotograma a fotograma, con una línea verde que bajaba por la lista al
 * mismo ritmo. Eso hacía que el gesto durase lo que durase el gesto de
 * quien lee: con la rueda a fondo, tres teléfonos cruzando la escena de
 * un tirón. Ahora el scroll sólo dice cuándo se cambia de paso; cuánto
 * tarda el cambio y con qué curva lo decide el CSS, siempre igual.
 *
 * Con la sección fuera de pantalla no manda ninguno, que es lo que apaga
 * los tres bucles a la vez. Lo que se ve, en cambio, se queda como
 * estaba: si al salir se apagara también, al volver habría que rehacer el
 * viaje entero delante de quien acaba de llegar.
 */

function topar(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export interface PasoFocoPiezas {
  /** El bloque alto que se recorre mientras la escena está pegada. */
  pista: HTMLElement;
  /** Las tres tomas apiladas en el visor, una por paso. */
  columnas: HTMLElement[];
  marcas: HTMLElement[];
  /** El paso que pasa a mandar, o `-1` con la sección fuera de vista. */
  alCambiar: (indice: number) => void;
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
    // pista encogida— manda el primero y no hay tramos que repartir.
    const recorrido = caja.height - innerHeight;
    const avance = recorrido <= 0 ? 0 : topar(-caja.top / recorrido, 0, 1);

    this.aplicar(Math.min(total - 1, Math.floor(avance * total)));
  }

  /**
   * Enciende el paso que manda: la toma de turno se marca y el CSS hace
   * el relevo por encima de la anterior.
   *
   * Fuera de vista sólo se avisa hacia fuera, para que se paren los
   * bucles; las clases no se tocan, de modo que al volver la escena está
   * ya donde se dejó.
   */
  private aplicar(indice: number): void {
    if (indice === this.actual) return;
    this.actual = indice;

    if (indice >= 0) {
      this.piezas.columnas.forEach((columna, i) => {
        columna.classList.toggle('is-activa', i === indice);
      });

      this.piezas.marcas.forEach((marca, i) => {
        marca.classList.toggle('is-activa', i === indice);
      });
    }

    this.piezas.alCambiar(indice);
  }
}
