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
 * Del recorrido salen dos números, no uno. El continuo —`0` a `total - 1`
 * con decimales— es el que manda en lo que se ve moverse: la corrida de
 * la fila y, columna por columna, lo cerca que está cada una de tener el
 * turno. Va pegado al dedo, sin transición larga que lo persiga, así que
 * la fila no se queda quieta un tercio del scroll para luego pegar un
 * viaje de golpe. Entre paso y paso hay un retén: la primera parte del
 * tramo la fila casi no se mueve —el paso se deja leer— y el resto es el
 * viaje, con una curva suave a la entrada y a la salida.
 *
 * El discreto sale de redondear el continuo, y es el que enciende clases
 * y avisa fuera para que sólo corra el bucle de ese teléfono: cambia
 * justo cuando los dos teléfonos se cruzan por la mitad del viaje. Con la
 * sección fuera de pantalla no manda ninguno, que es lo que apaga los
 * tres bucles a la vez; la fila se queda donde estaba para que al volver
 * no dé un salto.
 */
/**
 * Cuánto del tramo de un paso se va en dejarlo quieto antes de empezar
 * el viaje al siguiente. Sin retén la fila no para nunca y no se llega a
 * leer ningún paso; con demasiado vuelve el salto de antes.
 */
const RETEN = 0.42;

/** El desenfoque del que está más lejos de mandar, en píxeles. */
const VELO_MAX = 4;

/** Suavizado de toda la vida: sale y entra sin esquinas. */
function suave(t: number): number {
  return t * t * (3 - 2 * t);
}

function topar(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

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
  private continuo = -1;
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
      this.fluir(0);
      this.aplicar(0);
      return;
    }

    const avance = topar(-caja.top / recorrido, 0, 1);
    this.piezas.alAvanzar?.(avance);

    // El tramo de cada paso: la primera parte quieto y la segunda de
    // viaje, suavizada por los dos extremos.
    const bruto = avance * total;
    const paso = Math.min(total - 1, Math.floor(bruto));
    const dentro = bruto - paso;
    const rampa = suave(topar((dentro - RETEN) / (1 - RETEN), 0, 1));

    this.fluir(Math.min(total - 1, paso + rampa));
    this.aplicar(Math.min(total - 1, Math.round(this.continuo)));
  }

  /**
   * El número con decimales, repartido al CSS. La fila se corre lo que
   * le falta al paso de turno para quedar en el eje, y cada columna
   * recibe lo cerca que está de mandar (`--cerca`, de 0 a 1) para que el
   * tamaño, el velo y el halo salgan de ahí y no de una clase que se
   * enciende de golpe.
   *
   * El desenfoque va en pasos de medio píxel: es lo único de aquí que
   * obliga a rehacer el mapa del teléfono, y con el valor redondeado
   * sólo lo rehace cuando de verdad cambia. Al que ya manda se le quita
   * el filtro entero —`is-nitida`—, que un `blur(0px)` sigue costando
   * una capa y ablanda el texto de la pantalla.
   */
  private fluir(continuo: number): void {
    if (continuo === this.continuo) return;
    this.continuo = continuo;

    const centro = (this.piezas.columnas.length - 1) / 2;
    this.piezas.pase.style.setProperty(
      '--corrida-pasos',
      (centro - continuo).toFixed(4)
    );

    this.piezas.columnas.forEach((columna, i) => {
      const cerca = suave(topar(1 - Math.abs(i - continuo), 0, 1));
      const nitida = cerca > 0.985;
      columna.style.setProperty('--cerca', cerca.toFixed(4));
      columna.style.setProperty(
        '--velo',
        `${(Math.round((1 - cerca) * VELO_MAX * 2) / 2).toFixed(1)}px`
      );
      columna.classList.toggle('is-nitida', nitida);
    });
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

    this.piezas.alCambiar(indice);
  }
}
