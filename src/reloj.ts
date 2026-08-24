import { entre, seguirPista, sinMovimiento } from './scrolly';

/**
 * El reloj del problema.
 *
 * La sección dice, con estas palabras, que «el bus puede tardar 3 minutos
 * o 30». Contarlo es una cosa y sentirlo es otra: aquí el que baja por la
 * página es el que espera. El reloj arranca en cero y llega a treinta
 * justo cuando la sección termina, y el texto de al lado va apareciendo a
 * medida que la espera se alarga.
 *
 * Y si el que mira se queda quieto, el reloj sigue. Esa es la otra mitad
 * del asunto: el bus no llega antes por dejar de mirar el teléfono. El
 * scroll marca dónde va la espera; el tiempo real le va sumando encima,
 * segundo a segundo, hasta un tope para que la página no acabe contando
 * horas si alguien la deja abierta.
 *
 * Los dos números marcados en la esfera —3 y 30— son los de la frase, no
 * unos inventados para la ocasión. El color sigue la misma escala que la
 * barra de la app: verde mientras la cosa va bien, ámbar cuando ya llevas
 * rato, coral cuando la espera se volvió el problema.
 */

/** Tope de la esfera, en minutos. Sale de la frase de la sección. */
const TOPE_MIN = 30;

/** Cuánto se le permite al tiempo real adelantarse al scroll, en minutos. */
const DERIVA_TOPE_MIN = 12;

/** Un salto de pestaña no cuenta como espera: el cuadro se recorta. */
const CUADRO_MAX_S = 0.25;

/**
 * La esfera, en coordenadas del SVG (280 x 280, centro 140).
 *
 * No da la vuelta entera: deja un hueco abajo y recorre 300 grados, de las
 * siete a las cinco. Si cerrara el círculo, el treinta caería justo encima
 * del cero y no se sabría si el reloj está empezando o acabando.
 */
const RADIO = 110;
const VUELTA = 2 * Math.PI * RADIO;
const ARCO = (VUELTA * 300) / 360;
const INICIO = -150;

const dos = (n: number): string => (n < 10 ? `0${n}` : String(n));

export class Reloj {
  private readonly pista: HTMLElement;
  private readonly avance: SVGCircleElement;
  private readonly aguja: SVGGElement;
  private readonly segundero: SVGGElement;
  private readonly min: HTMLElement;
  private readonly seg: HTMLElement;
  private readonly cara: HTMLElement;
  private readonly beats: HTMLElement[];
  private soltar: (() => void) | null = null;
  private vigia: IntersectionObserver | null = null;
  private cuadro = 0;
  private ultimo = 0;
  /** Lo que lleva recorrido la pista, de 0 a 1. */
  private scroll = 0;
  /** Los minutos que ha puesto el tiempo real por su cuenta. */
  private deriva = 0;

  constructor(pista: HTMLElement) {
    this.pista = pista;
    this.cara = req<HTMLElement>(pista, '[data-reloj]');
    this.avance = req<SVGCircleElement>(pista, '[data-reloj-avance]');
    this.aguja = req<SVGGElement>(pista, '[data-reloj-aguja]');
    this.segundero = req<SVGGElement>(pista, '[data-reloj-segundero]');
    this.min = req<HTMLElement>(pista, '[data-reloj-min]');
    this.seg = req<HTMLElement>(pista, '[data-reloj-seg]');
    this.beats = Array.from(pista.querySelectorAll<HTMLElement>('[data-beat]'));

    this.avance.style.strokeDasharray = `${ARCO} ${VUELTA}`;
    this.avance.style.strokeDashoffset = String(ARCO);

    // Sin animaciones el reloj no cuenta nada: se queda en el tope, que es
    // el dato que importa —treinta minutos—, y el texto sale entero.
    if (sinMovimiento()) {
      this.scroll = 1;
      this.pintar();
      for (const beat of this.beats) beat.classList.add('is-visible');
      return;
    }

    this.soltar = seguirPista(pista, (p) => {
      this.scroll = p;
      this.pintar();
    });

    // El tiempo sólo corre mientras la sección se está viendo: fuera de
    // pantalla no hay nadie esperando, y tampoco hay por qué gastar cuadros.
    this.vigia = new IntersectionObserver(
      ([entrada]) => this.correr(entrada?.isIntersecting ?? false),
      { threshold: 0 }
    );
    this.vigia.observe(pista);
  }

  private correr(encendido: boolean): void {
    if (encendido === Boolean(this.cuadro)) return;
    if (!encendido) {
      cancelAnimationFrame(this.cuadro);
      this.cuadro = 0;
      return;
    }
    this.ultimo = performance.now();
    const paso = (ahora: number): void => {
      const dt = Math.min(CUADRO_MAX_S, (ahora - this.ultimo) / 1000);
      this.ultimo = ahora;
      this.deriva = Math.min(DERIVA_TOPE_MIN, this.deriva + dt / 60);
      this.pintar();
      this.cuadro = requestAnimationFrame(paso);
    };
    this.cuadro = requestAnimationFrame(paso);
  }

  private pintar(): void {
    const minutos = this.scroll * TOPE_MIN + this.deriva;
    const enteros = Math.floor(minutos);
    const segundos = Math.floor((minutos - enteros) * 60);

    const mm = dos(enteros);
    const ss = dos(segundos);
    if (this.min.textContent !== mm) this.min.textContent = mm;
    if (this.seg.textContent !== ss) this.seg.textContent = ss;

    // La esfera llega hasta treinta y ahí se queda llena; la lectura sigue
    // subiendo, que es justo lo que pasa en el paradero.
    const lleno = entre(minutos, 0, TOPE_MIN);
    this.avance.style.strokeDashoffset = String(ARCO * (1 - lleno));
    this.aguja.style.transform = `rotate(${INICIO + lleno * 300}deg)`;
    // Una vuelta por minuto, como un segundero de verdad: es lo que hace
    // que el reloj se lea como en marcha y no como una barra de progreso.
    this.segundero.style.transform = `rotate(${(minutos * 360) % 360}deg)`;

    this.cara.dataset.urgencia =
      enteros < 3 ? 'calma' : minutos < TOPE_MIN * 0.7 ? 'rato' : 'harto';

    for (const beat of this.beats) {
      const desde = Number(beat.dataset.beat);
      beat.classList.toggle('is-visible', this.scroll >= desde);
    }

    this.pista.style.setProperty('--espera', String(lleno));
  }

  destroy(): void {
    this.soltar?.();
    this.soltar = null;
    this.vigia?.disconnect();
    this.vigia = null;
    if (this.cuadro) cancelAnimationFrame(this.cuadro);
    this.cuadro = 0;
  }
}

function req<T extends Element>(raiz: ParentNode, sel: string): T {
  const el = raiz.querySelector<T>(sel);
  if (!el) throw new Error(`Reloj: falta ${sel}`);
  return el;
}
