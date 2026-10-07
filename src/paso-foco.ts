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
 * De aquí salen dos cosas: qué paso manda —un entero— y cuánto se lleva
 * recorrido de ese paso —de 0 a 1—. El entero decide todo lo que se ve:
 * qué toma está encima, qué botón está encendido, qué bucle corre. El
 * continuo no decide nada de eso; sólo llena el riel de la lista.
 *
 * La distinción importa, porque el continuo ya estuvo aquí y se quitó
 * por bueno motivo: de él colgaba la escena entera —la fila corría
 * pegada al dedo y cada teléfono crecía, se aclaraba y se enfocaba
 * fotograma a fotograma—, así que un tirón de rueda pasaba los tres
 * teléfonos de un golpe. Eso no vuelve: cuánto tarda el relevo y con qué
 * curva lo sigue decidiendo el CSS, siempre igual. Vuelve sólo para la
 * barra, que es la única pieza a la que el recorrido crudo le sienta
 * bien: la pista está pegada tres pantallas y, sin algo que se mueva con
 * el dedo, la sección no dice por ninguna parte que bajando se cambia de
 * paso.
 *
 * Con la sección fuera de pantalla no manda ninguno, que es lo que apaga
 * los tres bucles a la vez. Lo que se ve, en cambio, se queda como
 * estaba: si al salir se apagara también, al volver habría que rehacer el
 * viaje entero delante de quien acaba de llegar.
 */

function topar(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

/**
 * Cuánto de cada tramo del rodillo se queda quieto a cada lado de un paso.
 * Con un cuarto, la mitad del recorrido de la pista deja la lista parada
 * en un paso y la otra mitad la lleva al siguiente, pegada al dedo.
 */
const PARADA = 0.25;

/**
 * Dónde va el rodillo para un recorrido `bruto` (de 0 a `total`): sigue al
 * dedo entre dos pasos y se detiene un trecho en cada uno (dueño,
 * 2026-10-07). El paso `k` queda en el foco con el recorrido en `k + 0,5`,
 * su mitad; en el cruce —el entero, donde cambia el teléfono— el rodillo
 * va a medio camino. Entre una parada y la siguiente acelera y frena con
 * `smoothstep`, para no arrancar ni llegar de golpe.
 */
function giroDe(bruto: number, total: number): number {
  const x = topar(bruto - 0.5, 0, total - 1);
  const n = Math.min(Math.floor(x), total - 1);
  const t = topar((x - n - PARADA) / (1 - 2 * PARADA), 0, 1);
  return n + t * t * (3 - 2 * t);
}

interface PasoFocoPiezas {
  /** El bloque alto que se recorre mientras la escena está pegada. */
  pista: HTMLElement;
  /** Las tres tomas apiladas en el visor, una por paso. */
  columnas: HTMLElement[];
  marcas: HTMLElement[];
  /** La lista de al lado: recibe cuánto lleva lleno el tramo de turno. */
  riel: HTMLElement | null;
  /** El paso que pasa a mandar, o `-1` con la sección fuera de vista. */
  alCambiar: (indice: number) => void;
}

export class PasoFoco {
  readonly #piezas: PasoFocoPiezas;

  #actual = -1;
  #llenado = -1;
  #giro = -1;
  #pedido = 0;
  #dentro = false;

  constructor(piezas: PasoFocoPiezas) {
    this.#piezas = piezas;

    // El riel arranca vacío: hasta que la pista no empieza a correr no
    // hay nada recorrido. El valor por omisión que trae la hoja es el
    // tramo lleno, y ése es para cuando este módulo no llega a cargar.
    this.#llenar(0);

    // Un margen generoso para que el primer paso ya esté encendido cuando
    // la sección asoma, y no arranque el bucle a mitad de gesto.
    const mirilla = new IntersectionObserver(
      ([entrada]) => {
        if (!entrada) return;
        this.#dentro = entrada.isIntersecting;
        if (this.#dentro) this.#medir();
        else this.#aplicar(-1);
      },
      { rootMargin: '300px 0px' }
    );
    mirilla.observe(piezas.pista);

    const avisar = () => {
      if (!this.#dentro || this.#pedido) return;
      this.#pedido = requestAnimationFrame(() => {
        this.#pedido = 0;
        this.#medir();
      });
    };

    addEventListener('scroll', avisar, { passive: true });
    addEventListener('resize', avisar, { passive: true });
  }

  #medir(): void {
    const total = this.#piezas.columnas.length;
    if (total === 0) return;

    const caja = this.#piezas.pista.getBoundingClientRect();
    // Lo que la pista sobra por encima de la ventana es el recorrido real
    // de la escena pegada. Si no sobra nada —animaciones desactivadas,
    // pista encogida— manda el primero y no hay tramos que repartir.
    const recorrido = caja.height - innerHeight;
    const avance = recorrido <= 0 ? 0 : topar(-caja.top / recorrido, 0, 1);

    // El tramo de cada paso es una parte igual del recorrido: la parte
    // entera dice cuál manda y lo que sobra, cuánto se lleva de él. En el
    // final justo la cuenta da `total`, que no es un paso; se topa en el
    // último y entonces lo que sobra vale uno, con el riel hasta abajo.
    const bruto = avance * total;
    const indice = Math.min(total - 1, Math.floor(bruto));

    this.#llenar(topar(bruto - indice, 0, 1));
    this.#girar(giroDe(bruto, total));
    this.#aplicar(indice);
  }

  /**
   * Cuánto lleva lleno el tramo del paso de turno, de 0 a 1. Sale a una
   * variable de CSS y la gasta el riel con `scaleY`, que no toca el
   * layout: esto se escribe en cada cuadro del desplazamiento.
   *
   * Se redondea a la milésima antes de comparar, y así la mitad de los
   * cuadros no escriben nada: en un tramo de 200 px una milésima es un
   * quinto de píxel, o sea que el riel se mueve exactamente igual.
   */
  #llenar(parte: number): void {
    const redondo = Math.round(parte * 1000) / 1000;
    if (redondo === this.#llenado) return;
    this.#llenado = redondo;
    this.#piezas.riel?.style.setProperty('--paso-llenado', String(redondo));
  }

  /**
   * Lleva el rodillo de la lista (pasos.css, escritorio). Como el riel, se
   * escribe en cada cuadro y se redondea a la milésima: quieto en una
   * parada no escribe nada.
   */
  #girar(giro: number): void {
    const redondo = Math.round(giro * 1000) / 1000;
    if (redondo === this.#giro) return;
    this.#giro = redondo;
    this.#piezas.riel?.style.setProperty('--paso-giro', String(redondo));
  }

  /**
   * Enciende el paso que manda: la toma de turno se marca y el CSS hace
   * el relevo por encima de la anterior.
   *
   * Fuera de vista sólo se avisa hacia fuera, para que se paren los
   * bucles; las clases no se tocan, de modo que al volver la escena está
   * ya donde se dejó.
   */
  #aplicar(indice: number): void {
    if (indice === this.#actual) return;
    this.#actual = indice;

    if (indice >= 0) {
      this.#piezas.columnas.forEach((columna, i) => {
        columna.classList.toggle('is-activa', i === indice);
      });

      this.#piezas.marcas.forEach((marca, i) => {
        marca.classList.toggle('is-activa', i === indice);
      });
    }

    this.#piezas.alCambiar(indice);
  }
}
