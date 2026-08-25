import { entre, limitar, scrollDePista, seguirPista, sinMovimiento, suavizar } from './scrolly';

/**
 * La solución, momento por momento, con el teléfono quieto.
 *
 * Al principio sólo está el titular, grande y centrado. Al bajar, el
 * titular se abre —crece y se va— y detrás aparece la obra: el texto a la
 * izquierda, el teléfono a la derecha.
 *
 * A partir de ahí el contenido cambia como una secuencia de tarjetas: el
 * texto entra desde abajo y el teléfono pasa suavemente a la pantalla del
 * momento siguiente. Así se entiende el relevo sin que dos vistas de la
 * app compitan en el mismo lugar.
 *
 * Lo importante sigue siendo el descanso: la mayor parte de su turno el
 * momento está completamente quieto, y ése es el rato en el que el
 * teléfono hace su demo. La cinta no vuelve a moverse hasta que se acaba
 * el turno.
 */

/** Dónde acaba la portada y empieza la cinta, en avance de pista. */
const PORTADA_FIN = 0.17;

/**
 * La portada termina de irse antes de que le toque el turno al primer
 * momento, y la obra empieza a aparecer antes de que ella acabe: entre
 * las dos hay que dejar solape, o queda un tramo de scroll con la sección
 * vacía. Los tres números son fracciones del turno de la portada.
 */
const PORTADA_FUNDE = 0.8;
const OBRA_DESDE = 0.36;
const OBRA_HASTA = 0.98;

/**
 * Cuánto de cada turno se pasa viajando, y el resto es descanso. El viaje
 * va a caballo del cambio de turno —la mitad al final de uno, la mitad al
 * principio del siguiente— para que el descanso caiga en el centro del
 * turno, que es adonde lleva el riel cuando se toca una pestaña.
 *
 * Con 0.44 el momento pasa algo más de la mitad de su turno parado. Menos
 * que eso y la cinta se mueve casi todo el rato; más, y el salto de un
 * momento a otro se vuelve brusco por lo poco que dura.
 */
const CRUCE = 0.44;

/**
 * Cuánto tiene que cambiar un valor para que valga la pena escribirlo.
 *
 * Escribir en `style` no es gratis aunque el valor sea el mismo: cada
 * asignación pasa por el analizador de CSS y ensucia el estilo del
 * elemento. Redondeando el desplazamiento a la veinteava parte de un uno
 * por ciento del visor —medio píxel en una ventana normal— y la opacidad
 * al uno por ciento, la mayoría de los cuadros no escribe nada: se ve
 * igual y el navegador se queda tranquilo.
 */
/**
 * Lo que tarda el viaje cuando se toca una pestaña, según lo lejos que
 * quede el momento: del primero al segundo es medio segundo largo, del
 * primero al tercero casi uno. Con un tiempo fijo, el salto corto se
 * arrastra y el largo va a la carrera.
 */
const VIAJE_MIN = 700;
const VIAJE_MAX = 1200;

const PASO_CINTA = 0.05;
const PASO_OPACIDAD = 0.01;
/* La línea es una sola y recorre los tres momentos, así que cada punto de
   scroll mueve un tercio de lo que movía antes. A ese ritmo un escalón del
   1 % se ve; con milésimas el borde avanza medio píxel por cuadro. */
const PASO_LINEA = 0.001;

const cuantizar = (v: number, paso: number): number => Math.round(v / paso) * paso;

/** Las piezas de un momento, buscadas una vez y no en cada cuadro. */
interface Momento {
  paso: HTMLElement;
  toma: HTMLElement | null;
  pestana: HTMLElement | null;
  /** Lo último que se le puso, para no repetir escrituras inútiles. */
  opacidad: number;
}

export class Pasos {
  private readonly pista: HTMLElement;
  private readonly portada: HTMLElement;
  private readonly obra: HTMLElement;
  private readonly carro: HTMLElement;
  private readonly mando: HTMLElement | null;
  private readonly linea: HTMLElement | null;
  private readonly cuenta: HTMLElement | null;
  private readonly momentos: Momento[];

  private soltar: (() => void) | null = null;
  private viaje = 0;
  private cortar: (() => void) | null = null;
  private indice = -1;
  private cinta = NaN;
  private portadaIrse = -1;
  private portadaBorrosa = -1;
  private obraEntra = -1;
  private mandoVisible = false;
  private lineaAvance = -1;

  /**
   * Le dice a main.ts qué teléfono está a la vista y le toca moverse.
   *
   * Entra por el constructor y no como propiedad suelta a propósito. La
   * primera medida se toma aquí dentro, antes de devolver el objeto: si
   * la página arranca ya parada dentro de un momento —refrescando a media
   * sección— ése es el único aviso que se da en todo el rato, porque el
   * siguiente no llega hasta que la cinta cambie de momento. Asignando
   * el aviso después, ese primero se perdía y el teléfono se quedaba
   * congelado en su foto de reposo hasta que uno subía y volvía a bajar.
   */
  private readonly alReposo: ((indice: number) => void) | null;

  constructor(pista: HTMLElement, alReposo?: (indice: number) => void) {
    const portada = pista.querySelector<HTMLElement>('[data-pasos-portada]');
    const obra = pista.querySelector<HTMLElement>('[data-pasos-obra]');
    const carro = pista.querySelector<HTMLElement>('[data-pasos-carro]');
    const pasos = Array.from(pista.querySelectorAll<HTMLElement>('[data-paso]'));
    if (!portada || !obra || !carro || pasos.length === 0) {
      throw new Error('Pasos: faltan piezas');
    }

    this.alReposo = alReposo ?? null;
    this.pista = pista;
    this.portada = portada;
    this.obra = obra;
    this.carro = carro;
    this.mando = pista.querySelector<HTMLElement>('.pasos-mando');
    this.linea = pista.querySelector<HTMLElement>('[data-pasos-avance]');
    this.cuenta = pista.querySelector<HTMLElement>('[data-pasos-cuenta]');

    const pestanas = Array.from(pista.querySelectorAll<HTMLElement>('[data-pasos-tab]'));
    const tomas = Array.from(pista.querySelectorAll<HTMLElement>('[data-toma]'));
    this.momentos = pasos.map((paso, i) => ({
      paso,
      toma: tomas[i] ?? null,
      pestana: pestanas[i] ?? null,
      opacidad: -1,
    }));

    // Un tramo por momento. La portada tiene su arranque dentro del primero
    // y el último se queda puesto hasta que la sección sale, así que no
    // hace falta pagar un tramo entero por ninguno de los dos remates.
    pista.style.setProperty('--tramos', String(pasos.length));

    // Sin animaciones no hay cinta que valga: los momentos y los teléfonos
    // se leen de arriba abajo como una lista de toda la vida. Lo arma el
    // CSS; aquí sólo hay que no ponerse en medio.
    if (sinMovimiento()) return;

    // La portada tapa a la obra sólo cuando hay quien las gobierne. Sin
    // JavaScript se quedan una debajo de otra, que es feo pero se lee;
    // superpuestas y sin nadie que las funda, serían dos textos encima del
    // mismo sitio. Ver `.es-cinta` en pasos.css.
    pista.classList.add('es-cinta');

    pestanas.forEach((pestana, i) => {
      pestana.addEventListener('click', () => this.irA(i));
      pestana.addEventListener('keydown', (evento) => this.teclado(evento, i));
    });

    this.soltar = seguirPista(pista, (p) => this.pintar(p));
  }

  /**
   * Lleva el scroll al centro del descanso de un momento.
   *
   * El viaje se anima a mano, cuadro a cuadro, y las pistas se quedan
   * vivas: lo que se ve mientras dura es la cinta pasando por los
   * momentos del camino y la barrita del riel llenándose hasta el
   * destino, que es lo que hace que tocar una pestaña se lea como un
   * recorrido y no como un corte. Antes se congelaban —como hacen los
   * enlaces del menú, ver salto.ts— y el momento aparecía de golpe.
   *
   * Si el que mira toca la rueda o la pantalla, el viaje se corta ahí
   * mismo: el scroll es suyo, no nuestro.
   */
  private irA(indice: number): void {
    const ancho = (1 - PORTADA_FIN) / this.momentos.length;
    const destino = scrollDePista(this.pista, PORTADA_FIN + ancho * (indice + 0.5));
    const desde = window.scrollY;
    const salto = destino - desde;
    if (Math.abs(salto) < 2) return;

    this.cortarViaje();
    const duracion = Math.min(VIAJE_MAX, Math.max(VIAJE_MIN, Math.abs(salto) * 1.45));
    const arranque = performance.now();
    this.cortar = () => {
      window.removeEventListener('wheel', this.cortar!);
      window.removeEventListener('touchstart', this.cortar!);
      this.cortarViaje();
    };
    window.addEventListener('wheel', this.cortar, { passive: true });
    window.addEventListener('touchstart', this.cortar, { passive: true });

    // `instant` a propósito: el documento lleva `scroll-behavior: smooth`
    // —ver base.css— y sin decírselo cada cuadro del viaje arrancaría su
    // propio scroll suave, cancelando el del cuadro anterior. La página se
    // quedaba clavada casi un segundo y luego daba el salto entero de
    // golpe, que era justo lo contrario de lo que se buscaba.
    const paso = (ahora: number): void => {
      const t = limitar((ahora - arranque) / duracion);
      window.scrollTo({ top: desde + salto * suavizar(t), behavior: 'instant' });
      if (t < 1) this.viaje = requestAnimationFrame(paso);
      else this.cortarViaje();
    };
    this.viaje = requestAnimationFrame(paso);
  }

  /** Corta el viaje en curso y recoge lo que dejó puesto. */
  private cortarViaje(): void {
    if (this.viaje !== 0) cancelAnimationFrame(this.viaje);
    this.viaje = 0;
    if (this.cortar) {
      window.removeEventListener('wheel', this.cortar);
      window.removeEventListener('touchstart', this.cortar);
      this.cortar = null;
    }
  }

  /** Las flechas recorren el riel, como en cualquier grupo de pestañas. */
  private teclado(evento: KeyboardEvent, indice: number): void {
    const ultimo = this.momentos.length - 1;
    let destino = indice;
    if (evento.key === 'ArrowRight' || evento.key === 'ArrowDown') destino = indice + 1;
    else if (evento.key === 'ArrowLeft' || evento.key === 'ArrowUp') destino = indice - 1;
    else if (evento.key === 'Home') destino = 0;
    else if (evento.key === 'End') destino = ultimo;
    else return;

    evento.preventDefault();
    destino = destino < 0 ? 0 : destino > ultimo ? ultimo : destino;
    if (destino === indice) return;
    this.momentos[destino]?.pestana?.focus();
    this.irA(destino);
  }

  private pintar(p: number): void {
    // La portada no se desvanece de lado: se acerca hasta pasarse de
    // largo, como si la página entrara dentro de ella.
    const irse = cuantizar(entre(p, 0.03, PORTADA_FIN * PORTADA_FUNDE), PASO_OPACIDAD);
    if (irse !== this.portadaIrse) {
      this.portadaIrse = irse;
      this.portada.style.opacity = String(1 - irse);
      this.portada.style.transform = `scale(${1 + irse * 0.34}) translateY(${irse * -24}px)`;
      this.portada.style.visibility = irse >= 1 ? 'hidden' : 'visible';
    }
    // El desenfoque va a saltos de un píxel: un `filter` obliga a repintar
    // el titular entero, y hacerlo sesenta veces por segundo es la
    // diferencia entre ir a sesenta cuadros y no ir.
    const portadaBorrosa = irse >= 1 ? 0 : Math.round(irse * 12);
    if (portadaBorrosa !== this.portadaBorrosa) {
      this.portadaBorrosa = portadaBorrosa;
      this.portada.style.filter = portadaBorrosa > 0 ? `blur(${portadaBorrosa}px)` : 'none';
    }

    // La obra entra entera de una vez, con la portada todavía yéndose.
    // Este es el único fundido que queda en la sección, y es el de la
    // portada al contenido: entre momento y momento no hay ninguno.
    const entra = cuantizar(
      suavizar(entre(p, PORTADA_FIN * OBRA_DESDE, PORTADA_FIN * OBRA_HASTA)),
      PASO_OPACIDAD
    );
    if (entra !== this.obraEntra) {
      const movia = this.obraEntra > 0 && this.obraEntra < 1;
      const mueve = entra > 0 && entra < 1;
      this.obraEntra = entra;
      this.obra.style.opacity = String(entra);
      this.obra.style.visibility = entra <= 0 ? 'hidden' : 'visible';
      if (mueve !== movia) this.obra.style.willChange = mueve ? 'opacity' : 'auto';
      // El riel va pegado al borde de arriba de la tarjeta, así que entra
      // con ella y no por su cuenta: son la misma pieza.
      if (this.mando) this.mando.style.opacity = String(entra);
    }

    // El mando es la salida de emergencia de la sección: en cuanto la
    // tarjeta asoma, el que no quiera ver los tres momentos ya puede
    // saltar al que le interese en vez de bajar a ciegas. Va y viene con
    // ella —no se queda puesto— porque lo que se ve es opacidad, y una
    // barra invisible que sigue recibiendo clics es una barra que se come
    // los del titular de portada que hay debajo.
    const mandoVisible = entra > 0.02;
    if (mandoVisible !== this.mandoVisible) {
      this.mandoVisible = mandoVisible;
      this.mando?.classList.toggle('is-visible', mandoVisible);
    }

    const n = this.momentos.length;
    const ancho = (1 - PORTADA_FIN) / n;
    // En qué turno va la pista, con decimales: 0 es el primer momento, 1
    // el segundo. La cinta no empieza a correr hasta el final del turno.
    const turno = (p - PORTADA_FIN) / ancho;

    /*
      Dónde está la cinta, en anchos de visor. Cada relevo es un escalón
      suavizado a caballo del cambio de turno, y entre escalón y escalón
      la cinta está exactamente quieta. Sumarlos en vez de calcular «el
      turno actual más lo que lleve recorrido» evita el caso raro de dos
      relevos pisándose si algún día `CRUCE` pasara de uno.
    */
    let desplazada = 0;
    for (let i = 1; i < n; i++) {
      desplazada += suavizar(entre(turno, i - CRUCE / 2, i + CRUCE / 2));
    }

    const cinta = cuantizar(desplazada * 100, PASO_CINTA);
    if (cinta !== this.cinta) {
      const paraba = this.cinta % 100 === 0;
      const para = cinta % 100 === 0;
      this.cinta = cinta;
      this.carro.style.transform = `translate3d(0, ${-cinta}%, 0)`;
      // El aviso a la tarjeta gráfica se da al empezar a moverse y se
      // retira al pararse: dejarlo puesto reserva memoria de vídeo para
      // nada durante todo el descanso, que es la mayor parte del rato.
      if (para !== paraba) this.carro.style.willChange = para ? 'auto' : 'transform';
    }

    /* La tarjeta que sale se vuelve un recuerdo al llegar al borde alto y
       la que entra termina de aparecer desde abajo. No se ven dos textos
       recortados a la vez: es el relevo suave de la referencia, aplicado
       a los tres momentos de la app. */
    this.momentos.forEach((m, i) => {
      const opacidad = cuantizar(1 - Math.min(1, Math.abs(i - desplazada) * 1.35), PASO_OPACIDAD);
      if (opacidad === m.opacidad) return;
      m.opacidad = opacidad;
      m.paso.style.opacity = String(opacidad);
    });

    /* Un único avance para toda la cinta, no uno por tramo: el verde sale
       del filo izquierdo y no vuelve atrás, y en cada descanso la cabeza
       cae justo en el centro de la pestaña que está encendida. */
    const avance = cuantizar(entre(p, PORTADA_FIN, 1), PASO_LINEA);
    if (avance !== this.lineaAvance) {
      this.lineaAvance = avance;
      this.linea?.style.setProperty('--avance', String(avance));
    }

    /*
      Y el teléfono. El cambio cae en la mitad del relevo, que es cuando la
      cinta va más rápida y el ojo está en el texto que pasa: la pantalla
      del aparato ya es la del momento que llega antes de que el texto
      termine de sentarse. Mientras la portada tapa, no hay ninguno.
    */
    const indice = entra > 0.02 ? Math.round(desplazada) : -1;
    if (indice !== this.indice) {
      this.indice = indice;
      // Con la sección fuera de pantalla no hay momento activo, pero el
      // riel tiene que seguir siendo alcanzable con el tabulador: en ese
      // caso el que recibe el foco es el primero.
      const foco = indice < 0 ? 0 : indice;
      this.momentos.forEach((m, i) => {
        m.toma?.classList.toggle('is-activa', i === indice);
        m.pestana?.classList.toggle('is-activa', i === indice);
        m.pestana?.setAttribute('aria-selected', String(i === indice));
        if (m.pestana) m.pestana.tabIndex = i === foco ? 0 : -1;
      });
      if (this.cuenta && indice >= 0) this.cuenta.textContent = String(indice + 1);
      this.alReposo?.(indice);
    }
  }

  destroy(): void {
    this.cortarViaje();
    this.soltar?.();
    this.soltar = null;
  }
}
