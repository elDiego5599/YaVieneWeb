/**
 * El interruptor de «Qué resuelve» y la ceremonia que lo acompaña.
 *
 * La sección enseña la misma espera dos veces: «A ciegas», que es el
 * problema, y «Con Ya Viene», que es lo que la app hace con él. Las dos
 * caras están escritas en el HTML y dibujadas en `componentes/problema.css`;
 * de aquí sale el atributo `data-cara` de la sección, que es de donde
 * cuelga todo el cambio.
 *
 * Pasar de una cara a la otra no es un cambio, es una escena, y por eso
 * hay un segundo atributo, `data-fase`, con el tramo en el que va:
 *
 *   reposo → aspira → carga → brota → reposo
 *
 * En `aspira` la alerta roja se encoge hasta ser el logo y el escenario
 * entero se va hacia él: primero se apaga el circuito, luego se van los
 * chispazos, luego las voces del paradero y al final las tres fichas.
 * El orden es el del tamaño, de lo más pequeño a lo más grande, que es
 * como se vacía algo de verdad —lo ligero se va enseguida y lo pesado
 * cuesta— y de paso deja el argumento para el final: lo último que se
 * lleva no es el ruido, es el problema. En `carga` el logo late y cambia
 * de color. En `brota` se vuelve a abrir como «Ya Viene», baja el árbol
 * y las fichas salen del logo una a una hasta plantarse en su fila.
 * Contado así, no es que el desorden desaparezca: es que alguien se lo
 * lleva y devuelve otra cosa en su sitio.
 *
 * El viaje de cada pieza hasta el logo se calcula aquí y no en el CSS
 * porque depende de dónde esté cada una en ese momento y de dónde esté el
 * logo, y eso cambia con el ancho de la ventana. Lo demás —el encogido de
 * la píldora, el latido, el árbol— es CSS colgando de `data-fase`.
 *
 * La vuelta no tiene ceremonia: volver a «A ciegas» es rebobinar, y
 * repetir el ritual al revés lo abarataría.
 *
 * Lo otro que hace, y por lo que no basta con dos `<button>` sueltos: el
 * lector de pantalla no puede oír las dos versiones del titular seguidas,
 * así que la cara que no toca se marca con `aria-hidden`.
 *
 * Y una cortesía: la primera vez que la sección asoma se cambia sola de
 * lado, una vez, para que se vea que el interruptor está ahí. Quien lo
 * toque antes cancela el aviso —a partir de ese momento manda quien lee—,
 * y quien haya pedido que nada se mueva no lo ve nunca: ni ceremonia ni
 * cambio automático.
 */

import { sinMovimiento } from './scrolly';

/** Lo que espera la sección, ya delante, antes de enseñar la otra cara. */
const ESPERA_MS = 2400;

/**
 * Cuánto tiene que verse de la sección para darla por mirada, y por
 * debajo de cuánto se da por abandonada. Son dos números y no uno para
 * que el cambio no se dispare y se deshaga en el borde exacto.
 */
const ASOMO_ENTRA = 0.7;
const ASOMO_SALE = 0.15;

/**
 * Una sección más alta que la ventana no llega nunca a enseñar el 70% de
 * sí misma —en un móvil ésta mide casi el doble—, así que vale también
 * con que ocupe la mayor parte de lo que se está viendo.
 */
const PANTALLA = 0.6;

/**
 * El viaje de una pieza hasta el logo y el relevo entre la primera que
 * sale y la última. El relevo es largo porque no es un desfase de
 * adorno: es el orden de tamaño, y tiene que verse que las fichas se van
 * cuando ya no queda nada más que llevarse.
 */
const VIAJE_MS = 520;
const RELEVO_MS = 600;

/**
 * Los tres tramos de la ceremonia. El primero es el más largo porque
 * dentro tiene que caber el escenario entero, y eso no es un gesto sino
 * un relevo; el segundo es corto a propósito, que un latido largo se
 * vuelve un pulso de espera; el tercero dura lo que tarda el árbol en
 * llegar a los puntos de las ramas y la última ficha en plantarse.
 */
// El último viaje acaba en RELEVO_MS + VIAJE_MS + 90; los 60 que
// sobran son el escenario vacío, que es la mitad de lo que se cuenta.
const ASPIRA_MS = VIAJE_MS + RELEVO_MS + 150;
const CARGA_MS = 460;
const BROTA_MS = 1250;

/**
 * El despliegue de las fichas: cuánto espera la primera a que el árbol
 * arranque, cuánto va de una a la siguiente y lo que tarda cada una en
 * plantarse.
 */
const ESPERA_FICHA_MS = 160;
const RELEVO_FICHA_MS = 110;
const DESPLIEGUE_MS = 720;

/**
 * Cuánto se desvía cada pieza del camino recto al centro, en tanto por
 * uno de lo que le falta por recorrer. Todas se desvían hacia el mismo
 * lado: eso es lo que hace que trece viajes se lean como un remolino y
 * no como trece cosas cayendo a un agujero.
 */
const REMOLINO = 0.3;

/** Lo que mide la píldora una vez encogida: un círculo con el logo dentro. */
const NUCLEO_PX = 46;

export class Problema {
  private readonly seccion: HTMLElement;
  private readonly botones: HTMLButtonElement[];
  private readonly estado: HTMLElement | null;

  private ojo: IntersectionObserver | null = null;
  private reloj: number | null = null;

  /** Los relojes de la ceremonia, para poder cortarla a media escena. */
  private tramos: number[] = [];
  /** Lo que está volando hacia el logo ahora mismo. */
  private vuelos: Animation[] = [];
  /**
   * Las fichas van aparte porque son las únicas que vuelven: lo demás se
   * lo queda el logo, pero ellas salen otra vez en el despliegue y hay
   * que poder cortarles el viaje sin cortar el de las voces.
   */
  private vuelosFicha: Animation[] = [];
  /** Adónde se fue cada ficha, para saber de dónde tiene que volver. */
  private idas: { ficha: HTMLElement; dx: number; dy: number }[] = [];

  constructor(seccion: HTMLElement) {
    this.seccion = seccion;
    this.estado = seccion.querySelector<HTMLElement>('.escenario-estado');
    this.botones = Array.from(
      seccion.querySelectorAll<HTMLButtonElement>('.interruptor-opcion')
    );

    for (const boton of this.botones) {
      boton.addEventListener('click', () => {
        // Un toque en el interruptor apaga el cambio automático: ya no
        // hace falta enseñar nada, se ha entendido.
        this.parar();
        this.poner(boton.dataset.cara ?? 'ciego');
      });
    }

    // El ancho de la píldora hay que saberlo en píxeles para poder
    // encogerla hasta el círculo: `width: auto` no se puede animar. Se
    // mide con la tipografía ya cargada, porque con la de respaldo el
    // texto ocupa otra cosa.
    this.medirEstado();
    if (document.fonts) void document.fonts.ready.then(() => this.medirEstado());
    addEventListener('resize', () => this.pedirMedida(), { passive: true });

    if (!sinMovimiento()) this.esperarAQueAsome();
  }

  destroy(): void {
    this.parar();
    this.cortarCeremonia();
  }

  /**
   * El observador no se apaga después del primer aviso: la cuenta atrás
   * arranca cada vez que la sección se pone delante y se deshace cuando
   * se va. Así, quien vuelva a subir se encuentra otra vez el problema,
   * que es por donde hay que empezar a leerla —y, sobre todo, nadie se
   * pierde el cambio por haber pasado de largo mientras corría.
   */
  private esperarAQueAsome(): void {
    this.ojo = new IntersectionObserver(
      (entradas) => {
        for (const entrada of entradas) {
          if (this.seMira(entrada)) this.contar();
          else if (entrada.intersectionRatio <= ASOMO_SALE) this.rebobinar();
        }
      },
      { threshold: [0, ASOMO_SALE, ASOMO_ENTRA, 1] }
    );
    this.ojo.observe(this.seccion);
  }

  private seMira(entrada: IntersectionObserverEntry): boolean {
    if (!entrada.isIntersecting) return false;
    return (
      entrada.intersectionRatio >= ASOMO_ENTRA ||
      entrada.intersectionRect.height >= window.innerHeight * PANTALLA
    );
  }

  private contar(): void {
    if (this.reloj !== null) return;
    this.reloj = window.setTimeout(() => {
      this.reloj = null;
      this.poner('claro');
    }, ESPERA_MS);
  }

  private rebobinar(): void {
    if (this.reloj !== null) {
      window.clearTimeout(this.reloj);
      this.reloj = null;
    }
    this.poner('ciego');
  }

  private parar(): void {
    if (this.reloj !== null) {
      window.clearTimeout(this.reloj);
      this.reloj = null;
    }
    this.ojo?.disconnect();
    this.ojo = null;
  }

  // ── La medida de la píldora ────────────────────────────────────────

  private pedirMedida(): void {
    // Sólo en reposo: a media ceremonia la píldora está encogida y
    // medirla ahí congelaría el círculo como si fuera su tamaño real.
    if (this.seccion.dataset.fase && this.seccion.dataset.fase !== 'reposo') return;
    this.medirEstado();
  }

  /**
   * No se mide la píldora, se mide lo que lleva dentro. La píldora tiene
   * el ancho en transición para poder encogerse, así que preguntarle
   * cuánto mide a media transición devuelve el número de ese cuadro, no
   * el suyo. El bloque de las dos caras no se anima nunca y no baja de
   * su ancho mínimo aunque el padre se cierre: ése es el número bueno.
   */
  private medirEstado(): void {
    if (!this.estado) return;
    const caras = this.estado.querySelector<HTMLElement>('.dos-caras');
    if (!caras) return;

    const estilo = getComputedStyle(this.estado);
    const aire =
      parseFloat(estilo.paddingLeft || '0') + parseFloat(estilo.paddingRight || '0');
    const ancho = Math.ceil(caras.getBoundingClientRect().width + aire + 16);

    if (ancho <= NUCLEO_PX) return;
    this.estado.style.setProperty('--ancho-estado', `${ancho}px`);
  }

  // ── El cambio de cara ──────────────────────────────────────────────

  private poner(cara: string): void {
    if (this.seccion.dataset.cara === cara && !this.tramos.length) return;

    this.cortarCeremonia();

    if (cara === 'claro' && !sinMovimiento()) this.ceremonia();
    else this.cambiar(cara);
  }

  /** El cambio pelado, sin escena: es lo que hace la vuelta atrás. */
  private cambiar(cara: string): void {
    this.seccion.dataset.fase = 'reposo';
    if (this.seccion.dataset.cara === cara) return;
    this.seccion.dataset.cara = cara;

    for (const boton of this.botones) {
      boton.setAttribute('aria-pressed', String(boton.dataset.cara === cara));
    }

    for (const rostro of this.seccion.querySelectorAll<Element>('.cara')) {
      if (rostro.classList.contains(`cara--${cara}`)) {
        rostro.removeAttribute('aria-hidden');
      } else {
        rostro.setAttribute('aria-hidden', 'true');
      }
    }
  }

  // ── La ceremonia ───────────────────────────────────────────────────

  private ceremonia(): void {
    this.seccion.dataset.fase = 'aspira';
    this.aspirar();

    this.tramos.push(
      window.setTimeout(() => {
        this.seccion.dataset.fase = 'carga';
      }, ASPIRA_MS),

      window.setTimeout(() => {
        // La cara cambia justo cuando el logo se vuelve a abrir: de ahí
        // en adelante manda otra vez el CSS de `data-cara`.
        this.seccion.dataset.fase = 'brota';
        this.cambiar('claro');
        this.seccion.dataset.fase = 'brota';
        this.desplegar();
      }, ASPIRA_MS + CARGA_MS),

      window.setTimeout(() => {
        this.cortarCeremonia();
        this.seccion.dataset.fase = 'reposo';
        this.medirEstado();
      }, ASPIRA_MS + CARGA_MS + BROTA_MS)
    );
  }

  /**
   * Se lo lleva todo. No queda nada en el escenario: los chispazos, las
   * voces y las tres fichas se van al logo, y el circuito se apaga con
   * ellas desde el CSS.
   *
   * El turno lo reparte el tamaño, de lo más pequeño a lo más grande.
   * Es lo que separa «desaparece el ruido» de «se vacía el escenario»:
   * si todo sale a la vez es un fundido, y si salen antes las fichas —lo
   * único que se lee— parece que se ha borrado el argumento. Saliendo al
   * final, lo último que cruza la pantalla es el problema entero.
   *
   * El pequeño tirón hacia atrás del principio es lo que separa «se lo
   * llevan» de «se apaga»: sin ese impulso, entrar en el logo se lee
   * como un desvanecido cualquiera.
   */
  private aspirar(): void {
    if (!this.estado) return;

    const nucleo = this.estado.getBoundingClientRect();
    const destino = {
      x: nucleo.x + nucleo.width / 2,
      y: nucleo.y + nucleo.height / 2,
    };

    const piezas = Array.from(
      this.seccion.querySelectorAll<HTMLElement>('.chispa, .ruido, .ficha')
    )
      .map((pieza) => {
        const caja = pieza.getBoundingClientRect();
        return {
          pieza,
          dx: destino.x - (caja.x + caja.width / 2),
          dy: destino.y - (caja.y + caja.height / 2),
          bulto: caja.width * caja.height,
        };
      })
      // Lo que no se dibuja no viaja: por debajo de 860 px no hay ni
      // ruido ni chispazos en el escenario.
      .filter((v) => v.bulto > 0)
      .sort((a, b) => a.bulto - b.bulto);

    const ultima = Math.max(1, piezas.length - 1);
    this.idas = [];

    piezas.forEach(({ pieza, dx, dy }, turno) => {
      const tarjeta = pieza.classList.contains('ficha');
      const espera = (turno / ultima) * RELEVO_MS;

      // El desvío es perpendicular al camino recto y del mismo signo
      // para todas, que es lo que convierte trece viajes en un remolino:
      // en vez de caer al centro en línea, todas lo rodean por el mismo
      // lado antes de entrar.
      const desvioX = -dy * REMOLINO;
      const desvioY = dx * REMOLINO;

      // Un papel puede girar de lado y seguir leyéndose; un chispazo no
      // tiene arriba ni abajo, así que da la vuelta entera. Una ficha
      // pesa: se ladea y poco más.
      const vuelta = tarjeta ? 12 : pieza.classList.contains('chispa') ? 200 : 42;
      // La postura con la que estaba en la mesa, para que viaje como
      // estaba en vez de enderezarse de un salto al arrancar.
      const raiz = this.reposoDe(pieza);
      // Lo pesado se resiste menos a moverse hacia atrás: el tirón de
      // una ficha es la mitad del de una voz.
      const tiron = tarjeta ? 0.03 : 0.06;

      const vuelo = pieza.animate(
        [
          { transform: `translate(0px, 0px) scale(1)${raiz}`, opacity: 1 },
          {
            offset: 0.2,
            transform: `translate(${(-dx * tiron).toFixed(1)}px, ${(-dy * tiron).toFixed(1)}px) scale(1.04)${raiz}`,
            opacity: 1,
          },
          {
            offset: 0.62,
            transform: `translate(${(dx * 0.42 + desvioX * 0.58).toFixed(1)}px, ${(dy * 0.42 + desvioY * 0.58).toFixed(1)}px) scale(0.58) rotate(${(vuelta * 0.35).toFixed(0)}deg)${raiz}`,
            opacity: tarjeta ? 0.9 : 0.85,
          },
          {
            transform: `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(0.04) rotate(${vuelta}deg)${raiz}`,
            opacity: 0,
          },
        ],
        {
          duration: tarjeta ? VIAJE_MS + 90 : VIAJE_MS,
          delay: espera,
          // Sale despacio y llega disparada: es la curva de algo que
          // tira, no de algo que se va.
          easing: 'cubic-bezier(0.5, 0, 0.75, 0.15)',
          fill: 'forwards',
        }
      );

      if (tarjeta) {
        this.vuelosFicha.push(vuelo);
        this.idas.push({ ficha: pieza, dx, dy });
      } else {
        this.vuelos.push(vuelo);
      }
    });

    // El orden de la vuelta es el de la fila, no el del viaje: la de la
    // izquierda se planta primero aunque se haya ido la última.
    this.idas.sort((a, b) =>
      a.ficha.compareDocumentPosition(b.ficha) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
    );

  }

  /**
   * La vuelta. Las fichas salen del logo, no aparecen en su sitio: cada
   * una crece desde el centro hasta plantarse, con un punto de rebote al
   * final. Se sueltan escalonadas y de izquierda a derecha, así que
   * mientras el árbol baja la fila se va montando debajo.
   *
   * El vuelo no se queda pegado al final —`fill` de ida y no de vuelta—:
   * en cuanto termina manda otra vez el CSS de la cara ordenada, que es
   * exactamente donde lo deja el último fotograma.
   */
  private desplegar(): void {
    for (const vuelo of this.vuelosFicha) vuelo.cancel();
    this.vuelosFicha = [];

    this.idas.forEach(({ ficha, dx, dy }, turno) => {
      this.vuelosFicha.push(
        ficha.animate(
          [
            {
              transform: `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(0.06)`,
              opacity: 0,
              easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
            },
            {
              offset: 0.45,
              transform: `translate(${(dx * 0.2).toFixed(1)}px, ${(dy * 0.2).toFixed(1)}px) scale(0.74)`,
              opacity: 1,
              easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
            },
            { transform: 'none', opacity: 1 },
          ],
          {
            duration: DESPLIEGUE_MS,
            delay: ESPERA_FICHA_MS + turno * RELEVO_FICHA_MS,
            // Mientras espera su turno se queda donde la dejó el viaje,
            // dentro del logo, en vez de asomar entera en su sitio.
            fill: 'backwards',
          }
        )
      );
    });
  }

  /**
   * La postura de reposo de una pieza, tal cual la dejó el CSS: la
   * torcedura de una voz, el ladeo de una ficha desparramada. Va al
   * final de la lista —o sea, se aplica primero— para que el viaje se
   * monte encima en vez de enderezarla de golpe al arrancar.
   */
  private reposoDe(pieza: HTMLElement): string {
    const base = getComputedStyle(pieza).transform;
    return !base || base === 'none' ? '' : ` ${base}`;
  }

  private cortarCeremonia(): void {
    for (const reloj of this.tramos) window.clearTimeout(reloj);
    this.tramos = [];
    for (const vuelo of this.vuelos) vuelo.cancel();
    this.vuelos = [];
    for (const vuelo of this.vuelosFicha) vuelo.cancel();
    this.vuelosFicha = [];
    this.idas = [];
  }
}
