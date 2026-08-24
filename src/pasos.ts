import { entre, scrollDePista, seguirPista, sinMovimiento } from './scrolly';

/**
 * La solución, momento por momento, sobre una cinta que corre hacia la
 * izquierda.
 *
 * Al principio sólo está el titular, grande y centrado. Al bajar, el
 * titular se abre —crece y se va— y detrás empieza a pasar la cinta: cada
 * momento entra por la derecha, se planta en el centro y sale por la
 * izquierda para que llegue el siguiente. Todo viaja en la misma
 * dirección, que es lo que hace que se lea como una cosa después de otra
 * y no como tres tarjetas iguales apiladas.
 *
 * Lo importante es el descanso: en la mitad de su turno el momento se
 * queda completamente quieto, y ése es el rato en el que el teléfono hace
 * su demo. La animación no se corta a media frase para dar paso a la
 * siguiente; termina, y después la cinta vuelve a moverse.
 */

/**
 * Bordes del cruce, en unidades de turno. El que entra empieza antes de
 * que acabe el turno anterior y el que sale termina ya dentro del
 * siguiente: si no se pisaran, quedaría un tramo de pantalla vacía entre
 * momento y momento.
 */
const ENTRA_DESDE = 0.18;
const ENTRA_HASTA = 0.16;
const SALE_DESDE = 0.16;
const SALE_HASTA = 0.18;

/** Cuánto viaja cada momento de lado, en píxeles. */
const VIAJE = 210;

/** Dónde acaba la portada y empieza la cinta, en avance de pista. */
const PORTADA_FIN = 0.17;

/**
 * La portada termina de irse antes de que le toque el turno al primer
 * momento, y el primero empieza a entrar antes de que ella acabe: entre
 * los dos hay que dejar solape, o queda un tramo de scroll con la sección
 * vacía. Los dos números son fracciones del turno de la portada.
 */
const PORTADA_FUNDE = 0.8;
const PRIMERO_DESDE = 0.3;

/**
 * Tope del desenfoque de entrada, en píxeles, y el escalón con el que se
 * mueve.
 *
 * Aquí está la diferencia entre ir a sesenta cuadros y no ir. Un `filter`
 * obliga al navegador a volver a pintar todo lo que hay debajo, y un
 * bloque de estos son mil ciento ochenta por seiscientos ochenta y cinco
 * píxeles con un teléfono y un mapa dentro. Si el valor cambia en cada
 * cuadro —y en un cruce hay dos bloques a la vez— no hay máquina que lo
 * aguante. Así que el desenfoque va sólo sobre la columna de texto, que
 * es pequeña, y a saltos de un píxel: cinco repintados por cruce en vez
 * de noventa. El teléfono cruza con opacidad y desplazamiento, que son
 * las dos cosas que la tarjeta gráfica hace gratis.
 */
const BORROSO_MAX = 5;

/**
 * Cuánto tiene que cambiar un valor para que valga la pena escribirlo.
 *
 * Escribir en `style` no es gratis aunque el valor sea el mismo: cada
 * asignación pasa por el analizador de CSS y ensucia el estilo del
 * elemento. En un cruce hay tres bloques por cuatro propiedades cada
 * uno, sesenta veces por segundo. Redondeando a medio píxel y a un uno
 * por ciento de opacidad, la mayoría de los cuadros no escribe nada: se
 * ve igual y el navegador se queda tranquilo.
 */
const PASO_PX = 0.5;
const PASO_OPACIDAD = 0.01;
const PASO_BARRA = 1;

const cuantizar = (v: number, paso: number): number => Math.round(v / paso) * paso;

/** Las piezas de un momento, buscadas una vez y no en cada cuadro. */
interface Momento {
  raiz: HTMLElement;
  cuerpo: HTMLElement | null;
  toma: HTMLElement | null;
  pestana: HTMLElement | null;
  barra: HTMLElement | null;
  /** Lo último que se le puso, para no repetir escrituras inútiles. */
  borroso: number;
  movil: boolean;
  opacidad: number;
  x: number;
  tomaX: number;
  visible: boolean;
  activo: boolean;
  tabActiva: boolean;
  avance: number;
}

export class Pasos {
  private readonly portada: HTMLElement;
  private readonly momentos: Momento[];
  private readonly riel: HTMLElement | null;
  private readonly pista: HTMLElement;
  private soltar: (() => void) | null = null;
  private reposo = -1;
  private portadaBorrosa = -1;
  private portadaIrse = -1;
  private rielVisible = false;

  /** Le dice a main.ts qué teléfono está quieto y le toca moverse. */
  alReposo: ((indice: number) => void) | null = null;

  constructor(pista: HTMLElement) {
    const portada = pista.querySelector<HTMLElement>('[data-pasos-portada]');
    const pasos = Array.from(pista.querySelectorAll<HTMLElement>('[data-paso]'));
    if (!portada || pasos.length === 0) throw new Error('Pasos: faltan piezas');
    this.pista = pista;
    this.portada = portada;
    this.riel = pista.querySelector<HTMLElement>('.pasos-riel');

    const pestanas = Array.from(pista.querySelectorAll<HTMLElement>('[data-pasos-tab]'));
    this.momentos = pasos.map((raiz, i) => ({
      raiz,
      cuerpo: raiz.querySelector<HTMLElement>('.paso-cuerpo'),
      toma: raiz.querySelector<HTMLElement>('.paso-toma'),
      pestana: pestanas[i] ?? null,
      barra: pestanas[i]?.querySelector<HTMLElement>('.pasos-tab-avance') ?? null,
      borroso: -1,
      movil: false,
      opacidad: -1,
      x: NaN,
      tomaX: NaN,
      visible: true,
      activo: false,
      tabActiva: false,
      avance: -1,
    }));

    // Un tramo por momento. Con el tramo de sobra que había antes, la
    // sección pedía casi ocho pantallas de scroll para tres ideas: la
    // portada ya tiene su propio arranque y el último momento se queda
    // puesto hasta que la sección sale, así que no hace falta pagar un
    // tramo entero por ese remate.
    pista.style.setProperty('--tramos', String(pasos.length));

    // Sin animaciones no hay cinta que valga: los momentos se apilan en el
    // flujo normal —lo arma el CSS— y aquí sólo hay que quitarles el
    // maquillaje para que no queden invisibles.
    if (sinMovimiento()) {
      this.portada.removeAttribute('style');
      for (const paso of pasos) paso.removeAttribute('style');
      return;
    }

    pestanas.forEach((pestana, i) => {
      pestana.addEventListener('click', () => this.irA(i));
    });

    this.soltar = seguirPista(pista, (p) => this.pintar(p));
  }

  /** Lleva el scroll al centro del descanso de un momento. */
  private irA(indice: number): void {
    const ancho = (1 - PORTADA_FIN) / this.momentos.length;
    scrollDePista(this.pista, PORTADA_FIN + ancho * (indice + 0.5));
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
    // Mismo trato que los momentos: el desenfoque va a saltos para no
    // repintar el titular entero sesenta veces por segundo.
    const portadaBorrosa = irse >= 1 ? 0 : Math.round(irse * 12);
    if (portadaBorrosa !== this.portadaBorrosa) {
      this.portadaBorrosa = portadaBorrosa;
      this.portada.style.filter = portadaBorrosa > 0 ? `blur(${portadaBorrosa}px)` : 'none';
    }

    // El riel es la salida de emergencia de la sección: si aparece a
    // mitad de la portada, el que no quiera leer los tres momentos ya
    // puede saltar al que le interese en vez de bajar a ciegas. Y una vez
    // puesto se queda: al volver hacia arriba desaparecía, y un índice que
    // se esconde justo cuando el que mira duda es un índice inútil.
    const rielVisible = this.rielVisible || irse > 0.14;
    if (rielVisible !== this.rielVisible) {
      this.rielVisible = rielVisible;
      this.riel?.classList.toggle('is-visible', rielVisible);
    }

    const n = this.momentos.length;
    const ancho = (1 - PORTADA_FIN) / n;
    let reposo = -1;

    this.momentos.forEach((m, i) => {
      const inicio = PORTADA_FIN + ancho * i;
      const fin = inicio + ancho;

      // El primero se adelanta menos que los demás: pisa la cola de la
      // portada lo justo para que no haya pantalla en blanco entre las dos.
      const desde = inicio - ancho * (i === 0 ? PRIMERO_DESDE : ENTRA_DESDE);
      const entra = entre(p, desde, inicio + ancho * ENTRA_HASTA);
      // El último no se va: si se fuera, la sección terminaría en blanco.
      const sale =
        i === n - 1 ? 0 : entre(p, fin - ancho * SALE_DESDE, fin + ancho * SALE_HASTA);

      // Un solo eje y un solo sentido: entra por la derecha, se planta,
      // sale por la izquierda.
      const x = cuantizar(VIAJE * (1 - entra) - VIAJE * sale, PASO_PX);
      const opacidad = cuantizar(entra * (1 - sale), PASO_OPACIDAD);
      const quieto = entra > 0.995 && sale < 0.005;
      const oculto = opacidad <= 0.001;

      if (opacidad !== m.opacidad) {
        m.opacidad = opacidad;
        m.raiz.style.opacity = String(opacidad);
      }
      // `quieto` entra en la cuenta porque al pararse hay que cambiar el
      // `translate3d` por `none` y soltar la capa de composición.
      const parado = quieto ? NaN : x;
      if (!Object.is(parado, m.x)) {
        m.x = parado;
        m.raiz.style.transform = quieto ? 'none' : `translate3d(${x}px, 0, 0)`;
      }
      if (oculto === m.visible) {
        m.visible = !oculto;
        m.raiz.style.visibility = oculto ? 'hidden' : 'visible';
      }

      // El aviso a la tarjeta gráfica se da al empezar a moverse y se
      // retira al pararse: dejarlo puesto en los tres bloques a la vez
      // reserva memoria de vídeo para nada.
      const movil = !quieto && !oculto;
      if (movil !== m.movil) {
        m.movil = movil;
        m.raiz.style.willChange = movil ? 'transform, opacity' : 'auto';
      }

      // El desenfoque, a saltos y sólo sobre el texto. Ver BORROSO_MAX.
      const borroso = oculto ? 0 : Math.round(((1 - entra) + sale) * BORROSO_MAX);
      if (m.cuerpo && borroso !== m.borroso) {
        m.borroso = borroso;
        m.cuerpo.style.filter = borroso > 0 ? `blur(${borroso}px)` : 'none';
      }

      const activo = opacidad > 0.5;
      if (activo !== m.activo) {
        m.activo = activo;
        m.raiz.classList.toggle('is-activo', activo);
      }

      // El teléfono viaja un poco más que su texto: al cruzarse, la mano
      // que lleva el aparato va por delante de la frase que lo explica.
      if (m.toma) {
        const extra = quieto ? NaN : cuantizar(x * 0.34, PASO_PX);
        if (!Object.is(extra, m.tomaX)) {
          m.tomaX = extra;
          m.toma.style.transform = quieto ? 'none' : `translate3d(${extra}px, 0, 0)`;
        }
      }

      const avance = cuantizar(entre(p, inicio, fin) * 100, PASO_BARRA);
      if (avance !== m.avance) {
        m.avance = avance;
        const tabActiva = avance > 0 && avance < 100;
        if (tabActiva !== m.tabActiva) {
          m.tabActiva = tabActiva;
          m.pestana?.classList.toggle('is-activa', tabActiva);
        }
        m.barra?.style.setProperty('--avance', `${avance}%`);
      }

      if (quieto) reposo = i;
    });

    if (reposo !== this.reposo) {
      this.reposo = reposo;
      this.alReposo?.(reposo);
    }
  }

  destroy(): void {
    this.soltar?.();
    this.soltar = null;
  }
}
