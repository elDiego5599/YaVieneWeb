import { seguirPista, sinMovimiento } from './scrolly';

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
 * segundo a segundo, hasta llegar a treinta. Ahí para: treinta es el
 * número de la frase y pasarse de largo lo convertiría en otro dato, uno
 * que la sección no dice. Y parado de verdad —el bucle se apaga, no se
 * queda dando vueltas repintando el mismo minuto.
 *
 * El reloj se repinta por segundos, no por cuadros: entre un cuadro y el
 * siguiente la esfera no se mueve lo bastante como para que valga la pena
 * escribir tres estilos, y el segundero avanza a saltos, como el de un
 * reloj de cuarzo de verdad.
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
  /** La sección está a la vista: sin esto el bucle no puede volver. */
  private mirando = false;
  /** El último segundo pintado, para no repintar el mismo. */
  private tic = -1;
  /** El último avance de scroll pintado, en centésimas. */
  private tramo = -1;

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

    // A partir de aquí manda el scroll: sin esta clase los golpes de
    // texto se quedan puestos, que es lo que se lee si el JavaScript no
    // llega. Ver `.es-guion .problema-beat` en problema.css.
    this.pista.classList.add('es-guion');

    // Al refrescar a media página el navegador devuelve el scroll a donde
    // estabas, pero no siempre antes de que esto arranque: la primera
    // medida sale con la página en el cero, el reloj se pinta en verde y
    // en cero, y cuando llega el scroll de verdad se ve el arco barrer
    // hasta el minuto que toca cambiando de color por el camino. La
    // lectura acaba siendo la correcta; lo que sobra es el viaje. Con
    // `es-crudo` las transiciones no existen todavía, así que esa primera
    // corrección ocurre en un cuadro y no se ve. Ver problema.css.
    this.pista.classList.add('es-crudo');
    this.asentar();

    this.soltar = seguirPista(pista, (p) => {
      this.scroll = p;
      this.pintar();
      // Volver hacia arriba baja la lectura por debajo del tope: si el
      // bucle se había apagado ahí, aquí es donde vuelve a arrancar.
      this.correr(this.mirando);
    });

    // El tiempo sólo corre mientras la sección se está viendo: fuera de
    // pantalla no hay nadie esperando, y tampoco hay por qué gastar cuadros.
    this.vigia = new IntersectionObserver(
      ([entrada]) => {
        this.mirando = entrada?.isIntersecting ?? false;
        this.correr(this.mirando);
      },
      { threshold: 0 }
    );
    this.vigia.observe(pista);
  }

  /**
   * Suelta las transiciones cuando la página ya está en su sitio: cargada
   * del todo —ahí es donde el navegador ha terminado de devolver el
   * scroll— y con un cuadro de margen para que la corrección que venga de
   * ese scroll entre todavía sin transición.
   */
  private asentar(): void {
    const soltar = (): void => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => this.pista.classList.remove('es-crudo'));
      });
    };
    if (document.readyState === 'complete') soltar();
    else window.addEventListener('load', soltar, { once: true });
  }

  /**
   * Ya no queda tiempo que sumar: o la esfera llegó a treinta, o la deriva
   * tocó su tope. En cualquiera de los dos casos el bucle sólo repintaría
   * el mismo cuadro, así que se apaga.
   */
  private get rematado(): boolean {
    return (
      this.deriva >= DERIVA_TOPE_MIN ||
      this.scroll * TOPE_MIN + this.deriva >= TOPE_MIN
    );
  }

  private correr(encendido: boolean): void {
    const debe = encendido && !this.rematado;
    if (debe === Boolean(this.cuadro)) return;
    if (!debe) {
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
      if (this.rematado) {
        this.cuadro = 0;
        return;
      }
      this.cuadro = requestAnimationFrame(paso);
    };
    this.cuadro = requestAnimationFrame(paso);
  }

  private pintar(): void {
    // Treinta es el tope de la frase y también el de la lectura: llegado
    // ahí el reloj se queda quieto en 30:00 en vez de seguir contando un
    // número que la sección nunca prometió.
    const minutos = Math.min(TOPE_MIN, this.scroll * TOPE_MIN + this.deriva);
    const tics = Math.round(minutos * 60);

    if (tics !== this.tic) {
      this.tic = tics;
      const enteros = Math.floor(tics / 60);
      const segundos = tics % 60;

      const mm = dos(enteros);
      const ss = dos(segundos);
      if (this.min.textContent !== mm) this.min.textContent = mm;
      if (this.seg.textContent !== ss) this.seg.textContent = ss;

      const lleno = minutos / TOPE_MIN;
      this.avance.style.strokeDashoffset = (ARCO * (1 - lleno)).toFixed(2);
      this.aguja.style.transform = `rotate(${(INICIO + lleno * 300).toFixed(2)}deg)`;
      // Una vuelta por minuto, como un segundero de verdad, y a saltos de
      // segundo: es lo que hace que el reloj se lea como en marcha y no
      // como una barra de progreso.
      this.segundero.style.transform = `rotate(${segundos * 6}deg)`;

      const urgencia =
        enteros < 3 ? 'calma' : minutos < TOPE_MIN * 0.7 ? 'rato' : 'harto';
      if (this.cara.dataset.urgencia !== urgencia) this.cara.dataset.urgencia = urgencia;

      this.pista.style.setProperty('--espera', lleno.toFixed(3));
    }

    // Los párrafos siguen al scroll, no al reloj: con la esfera llena en
    // treinta la lectura ya no cambia, pero el texto todavía tiene que
    // aparecer mientras la sección baja.
    const tramo = Math.round(this.scroll * 100);
    if (tramo !== this.tramo) {
      this.tramo = tramo;
      for (const beat of this.beats) {
        const desde = Number(beat.dataset.beat);
        beat.classList.toggle('is-visible', this.scroll >= desde);
      }
    }
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
