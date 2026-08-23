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
 * Los dos números marcados en la esfera —3 y 30— son los de la frase, no
 * unos inventados para la ocasión. El color sigue la misma escala que la
 * barra de la app: verde mientras la cosa va bien, ámbar cuando ya llevas
 * rato, coral cuando la espera se volvió el problema.
 */

/** Tope de la esfera, en minutos. Sale de la frase de la sección. */
const TOPE_MIN = 30;

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
      this.pintar(1);
      for (const beat of this.beats) beat.classList.add('is-visible');
      return;
    }

    this.soltar = seguirPista(pista, (p) => this.pintar(p));
  }

  private pintar(p: number): void {
    const minutos = p * TOPE_MIN;
    const enteros = Math.floor(minutos);
    const segundos = Math.floor((minutos - enteros) * 60);

    this.min.textContent = dos(enteros);
    this.seg.textContent = dos(segundos);

    this.avance.style.strokeDashoffset = String(ARCO * (1 - p));
    this.aguja.style.transform = `rotate(${INICIO + p * 300}deg)`;
    // Una vuelta por minuto, como un segundero de verdad: es lo que hace
    // que el reloj se lea como en marcha y no como una barra de progreso.
    this.segundero.style.transform = `rotate(${(minutos * 360) % 360}deg)`;

    this.cara.dataset.urgencia =
      enteros < 3 ? 'calma' : minutos < TOPE_MIN * 0.7 ? 'rato' : 'harto';

    for (const beat of this.beats) {
      const desde = Number(beat.dataset.beat);
      beat.classList.toggle('is-visible', p >= desde);
    }

    this.pista.style.setProperty('--espera', String(entre(p, 0, 1)));
  }

  destroy(): void {
    this.soltar?.();
    this.soltar = null;
  }
}

function req<T extends Element>(raiz: ParentNode, sel: string): T {
  const el = raiz.querySelector<T>(sel);
  if (!el) throw new Error(`Reloj: falta ${sel}`);
  return el;
}
