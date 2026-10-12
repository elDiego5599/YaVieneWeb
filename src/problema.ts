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
 * En `aspira` la alerta roja se encoge hasta ser el logo, la maraña de
 * hilos se recoge hacia él y se traga los rayos y las voces, que son el
 * ruido. Y engorda con lo que se traga: cada llegada le da un tirón y de
 * una a otra queda un poco más grande. En `carga` ese bulto late y cambia
 * de color. En `brota` se vuelve a abrir como «Ya Viene», sube, los
 * cuatro avisos viajan a su fila y se enderezan, y de la píldora brota el
 * árbol de hilos verdes que baja a cada uno. Los avisos no se los traga:
 * son lo que se lee, y lo que se cuenta es que lo mismo se pone en orden
 * (como el diagrama de incident.io), no que desaparezca y salga otra cosa.
 *
 * Aquí se calculan las medidas que dependen del ancho: el vuelo de cada
 * pieza hasta el logo, adónde viaja cada aviso y por dónde pasa cada hilo
 * (`escenario-red.ts`, con las cajas de verdad). Lo demás —el encogido,
 * el latido, el viaje y el dibujo de los hilos— es CSS colgando de
 * `data-cara` y `data-fase`.
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

import { trazar } from './escenario-red';
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
 * sale y la última. Sólo viajan los rayos y las voces, cosas pequeñas:
 * un relevo largo se leería como espera.
 */
const VIAJE_MS = 380;
const RELEVO_MS = 160;

/**
 * Los tres tramos de la ceremonia, 1,8 s entre todos. El primero dura el
 * último viaje y un respiro con el escenario limpio; el segundo es corto
 * a propósito, que un latido largo se vuelve un pulso de espera; el
 * tercero es lo que tarda el último aviso en llegar a la fila (0,62 s
 * con 0,3 s de turno, `problema.css`).
 */
const ASPIRA_MS = VIAJE_MS + RELEVO_MS + 60;
const CARGA_MS = 240;
const BROTA_MS = 960;

/**
 * Cuánto se desvía cada pieza del camino recto al centro, en tanto por
 * uno de lo que le falta por recorrer. Todas se desvían hacia el mismo
 * lado: eso es lo que hace que siete viajes se lean como un remolino y
 * no como siete cosas cayendo a un agujero.
 */
const REMOLINO = 0.3;

/** Lo que mide la píldora una vez encogida: un círculo con el logo dentro. */
const NUCLEO_PX = 46;

/**
 * El engorde. `GORDO` es lo que mide el logo al acabar de tragárselo
 * todo, en tanto por uno de su tamaño de partida; `TRAGO` es el tirón
 * de más que da en cada llegada, y `REVIENTA` lo que se estira en el
 * instante de abrirse. Medio tamaño más es mucho para un adorno y poco
 * para lo que aquí se está contando: tiene que verse sin mirarlo.
 */
const GORDO = 1.34;
const TRAGO = 0.1;
const REVIENTA = 1.46;

/**
 * Dos llegadas más juntas que esto se cuentan como un solo trago. Sin
 * esto son siete tirones de 46 ms encabalgados, que no es engordar: es
 * vibrar.
 */
const TRAGO_MINIMO_MS = 150;

/** Lo que tarda el logo en soltar el bulto al abrirse. */
const SUELTA_MS = 340;

export class Problema {
  readonly #seccion: HTMLElement;
  readonly #botones: HTMLButtonElement[];
  readonly #estado: HTMLElement | null;

  #ojo: IntersectionObserver | null = null;
  #reloj: number | null = null;

  /** Los relojes de la ceremonia, para poder cortarla a media escena. */
  #tramos: number[] = [];
  /** Lo que está volando hacia el logo ahora mismo. */
  #vuelos: Animation[] = [];
  /** Los hilos, creados una vez; `#trazar` sólo les cambia el `d`. */
  #enredo: SVGPathElement[] = [];
  #arbol: SVGPathElement[] = [];

  constructor(seccion: HTMLElement) {
    this.#seccion = seccion;
    this.#estado = seccion.querySelector<HTMLElement>('.escenario-estado');
    this.#botones = Array.from(
      seccion.querySelectorAll<HTMLButtonElement>('.interruptor-opcion')
    );

    for (const boton of this.#botones) {
      boton.addEventListener('click', () => {
        // Un toque en el interruptor apaga el cambio automático: ya no
        // hace falta enseñar nada, se ha entendido.
        this.#parar();
        this.#poner(boton.dataset.cara ?? 'ciego');
      });
    }

    // El ancho de la píldora hay que saberlo en píxeles para poder
    // encogerla hasta el círculo: `width: auto` no se puede animar. Se
    // mide con la tipografía ya cargada, porque con la de respaldo el
    // texto ocupa otra cosa, y con ella se trazan los hilos.
    this.#medirEstado();
    if (document.fonts) void document.fonts.ready.then(() => this.#pedirMedida());
    // El escenario y los avisos, no la ventana: los avisos van fuera del
    // flujo y cambian de alto con el ancho y la letra sin que el
    // escenario se entere, y los hilos tienen que seguir tocándolos. El
    // observador ya agrupa por cuadro (e2e/resize-agrupado.spec.ts).
    const medida = new ResizeObserver(() => this.#pedirMedida());
    for (const caja of seccion.querySelectorAll('.escenario, .aviso')) medida.observe(caja);

    if (!sinMovimiento()) this.#esperarAQueAsome();
  }

  /**
   * El observador no se apaga después del primer aviso: la cuenta atrás
   * arranca cada vez que la sección se pone delante y se deshace cuando
   * se va. Así, quien vuelva a subir se encuentra otra vez el problema,
   * que es por donde hay que empezar a leerla —y, sobre todo, nadie se
   * pierde el cambio por haber pasado de largo mientras corría.
   */
  #esperarAQueAsome(): void {
    this.#ojo = new IntersectionObserver(
      (entradas) => {
        for (const entrada of entradas) {
          if (this.#seMira(entrada)) this.#contar();
          else if (entrada.intersectionRatio <= ASOMO_SALE) this.#rebobinar();
        }
      },
      { threshold: [0, ASOMO_SALE, ASOMO_ENTRA, 1] }
    );
    this.#ojo.observe(this.#seccion);
  }

  #seMira(entrada: IntersectionObserverEntry): boolean {
    if (!entrada.isIntersecting) return false;
    return (
      entrada.intersectionRatio >= ASOMO_ENTRA ||
      entrada.intersectionRect.height >= window.innerHeight * PANTALLA
    );
  }

  #contar(): void {
    if (this.#reloj !== null) return;
    this.#reloj = window.setTimeout(() => {
      this.#reloj = null;
      this.#poner('claro');
    }, ESPERA_MS);
  }

  #rebobinar(): void {
    if (this.#reloj !== null) {
      window.clearTimeout(this.#reloj);
      this.#reloj = null;
    }
    this.#poner('ciego');
  }

  #parar(): void {
    if (this.#reloj !== null) {
      window.clearTimeout(this.#reloj);
      this.#reloj = null;
    }
    this.#ojo?.disconnect();
    this.#ojo = null;
  }

  // ── La medida de la píldora ────────────────────────────────────────

  #pedirMedida(): void {
    // Sólo en reposo: a media ceremonia la píldora está encogida y
    // medirla ahí congelaría el círculo como si fuera su tamaño real.
    if (this.#seccion.dataset.fase && this.#seccion.dataset.fase !== 'reposo') return;
    this.#medirEstado();
    this.#trazar();
  }

  /**
   * No se mide la píldora, se mide lo que lleva dentro. La píldora tiene
   * el ancho en transición para poder encogerse, así que preguntarle
   * cuánto mide a media transición devuelve el número de ese cuadro, no
   * el suyo. El bloque de las dos caras no se anima nunca y no baja de
   * su ancho mínimo aunque el padre se cierre: ése es el número bueno.
   */
  #medirEstado(): void {
    if (!this.#estado) return;
    const caras = this.#estado.querySelector<HTMLElement>('.dos-caras');
    if (!caras) return;

    const estilo = getComputedStyle(this.#estado);
    const aire =
      parseFloat(estilo.paddingLeft || '0') + parseFloat(estilo.paddingRight || '0');
    const ancho = Math.ceil(caras.getBoundingClientRect().width + aire + 16);

    if (ancho <= NUCLEO_PX) return;
    this.#estado.style.setProperty('--ancho-estado', `${ancho}px`);
  }

  // ── Los hilos y la fila ────────────────────────────────────────────

  /**
   * Lee el escenario a ciegas —`offset*` no ve ni el viaje ni el ladeo,
   * que van en `translate` y `rotate`— y deja escrito lo que depende del
   * ancho: cuánto viaja cada aviso hasta la fila (`--fila`), cuánto sube
   * la píldora (`--subida`) y los `d` de los hilos, en un lienzo de los
   * mismos píxeles que el escenario. Por debajo de 1024 el lienzo no se
   * dibuja y los avisos van apilados: no hay nada que medir.
   */
  #trazar(): void {
    const red = this.#seccion.querySelector<SVGSVGElement>('.escenario-red');
    const escena = red?.parentElement;
    if (!red || !escena || !this.#estado || getComputedStyle(red).display === 'none') return;
    const avisos = Array.from(this.#seccion.querySelectorAll<HTMLElement>('.aviso'));
    const caja = (e: HTMLElement) => ({ x: e.offsetLeft, y: e.offsetTop, w: e.offsetWidth, h: e.offsetHeight });
    // Los avisos, con decimales: `offset*` redondea y la fila se veía
    // escalonada medio píxel. Su `top` y su `left` calculados son los de
    // la caja sin girar, que es la que se mueve.
    const tarjeta = (e: HTMLElement) => {
      const { left, top, width, height } = getComputedStyle(e);
      return { x: parseFloat(left), y: parseFloat(top), w: parseFloat(width), h: parseFloat(height) };
    };

    // La píldora con su ancho de reposo, el medido: la de verdad puede
    // estar todavía abriéndose.
    const ancho = parseFloat(this.#estado.style.getPropertyValue('--ancho-estado')) || this.#estado.offsetWidth;
    const pildora = caja(this.#estado);
    pildora.x += (pildora.w - ancho) / 2;
    pildora.w = ancho;

    const w = escena.clientWidth;
    const h = escena.clientHeight;
    const ciegas = avisos.map(tarjeta);
    const plano = trazar({ ancho: w, alto: h }, pildora, ciegas);

    avisos.forEach((aviso, i) => {
      const { x, y } = plano.fila[i];
      aviso.style.setProperty('--fila', `${x - ciegas[i].x}px ${y - ciegas[i].y}px`);
    });
    this.#estado.style.setProperty('--subida', `${plano.pildoraClara.y - pildora.y}px`);

    red.setAttribute('viewBox', `0 0 ${w} ${h}`);
    const hilos = (clase: string, guardados: SVGPathElement[], ds: string[]) => {
      ds.forEach((d, i) => {
        let hilo = guardados[i];
        if (!hilo) {
          hilo = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          hilo.setAttribute('class', `hilo hilo--${clase}`);
          hilo.setAttribute('pathLength', '1');
          red.append(hilo);
          guardados.push(hilo);
        }
        hilo.setAttribute('d', d);
      });
    };
    hilos('enredo', this.#enredo, plano.enredo);
    hilos('arbol', this.#arbol, plano.arbol);
  }

  // ── El cambio de cara ──────────────────────────────────────────────

  #poner(cara: string): void {
    // Adónde va la sección ahora mismo. Con una ceremonia en marcha va a
    // «claro» aunque el atributo todavía diga otra cosa: la cara sólo se
    // cambia a mitad de la escena. Pedir esa misma cara no es un cambio y
    // no se rehace nada. Sin esto, volver a pulsar el botón ya pulsado
    // mientras la red acababa de ponerse verde relanzaba la ceremonia
    // con `data-cara` ya en «claro», y el tramo del enredo se
    // representaba con los textos y los avisos de «Con Ya Viene».
    const destino = this.#tramos.length ? 'claro' : this.#seccion.dataset.cara;
    if (destino === cara) return;

    this.#cortarCeremonia();

    if (cara === 'claro' && !sinMovimiento()) this.#ceremonia();
    else this.#cambiar(cara);
  }

  /** El cambio pelado, sin escena: es lo que hace la vuelta atrás. */
  #cambiar(cara: string): void {
    this.#seccion.dataset.fase = 'reposo';
    if (this.#seccion.dataset.cara === cara) return;
    this.#seccion.dataset.cara = cara;

    for (const boton of this.#botones) {
      boton.setAttribute('aria-pressed', String(boton.dataset.cara === cara));
    }

    for (const rostro of this.#seccion.querySelectorAll<Element>('.cara')) {
      if (rostro.classList.contains(`cara--${cara}`)) {
        rostro.removeAttribute('aria-hidden');
      } else {
        rostro.setAttribute('aria-hidden', 'true');
      }
    }
  }

  // ── La ceremonia ───────────────────────────────────────────────────

  #ceremonia(): void {
    this.#seccion.dataset.fase = 'aspira';
    this.#aspirar();

    this.#tramos.push(
      window.setTimeout(() => {
        this.#seccion.dataset.fase = 'carga';
      }, ASPIRA_MS),

      window.setTimeout(() => {
        // La cara cambia justo cuando el logo se vuelve a abrir: de ahí
        // en adelante manda otra vez el CSS de `data-cara`.
        this.#seccion.dataset.fase = 'brota';
        this.#cambiar('claro');
        this.#seccion.dataset.fase = 'brota';
      }, ASPIRA_MS + CARGA_MS),

      window.setTimeout(() => {
        this.#cortarCeremonia();
        this.#seccion.dataset.fase = 'reposo';
        this.#pedirMedida();
      }, ASPIRA_MS + CARGA_MS + BROTA_MS)
    );
  }

  /**
   * Se lleva el ruido: los rayos y las voces van al logo, de lo más
   * pequeño a lo más grande, y la maraña se recoge con ellos desde el CSS.
   * Los avisos se quedan: son lo que se lee, y se ordenan en `brota`.
   *
   * El pequeño tirón hacia atrás del principio es lo que separa «se lo
   * llevan» de «se apaga»: sin ese impulso, entrar en el logo se lee
   * como un desvanecido cualquiera.
   */
  #aspirar(): void {
    if (!this.#estado) return;

    const nucleo = this.#estado.getBoundingClientRect();
    const destino = {
      x: nucleo.x + nucleo.width / 2,
      y: nucleo.y + nucleo.height / 2,
    };

    const piezas = Array.from(this.#seccion.querySelectorAll<HTMLElement>('.chispa, .ruido'))
      .map((pieza) => {
        const caja = pieza.getBoundingClientRect();
        return {
          pieza,
          dx: destino.x - (caja.x + caja.width / 2),
          dy: destino.y - (caja.y + caja.height / 2),
          bulto: caja.width * caja.height,
        };
      })
      // Lo que no se dibuja no viaja: por debajo de 1024 px no hay
      // chispazos ni voces en el escenario.
      .filter((v) => v.bulto > 0)
      .sort((a, b) => a.bulto - b.bulto);

    const ultima = Math.max(1, piezas.length - 1);
    const llegadas: number[] = [];

    piezas.forEach(({ pieza, dx, dy }, turno) => {
      const espera = (turno / ultima) * RELEVO_MS;

      // El desvío es perpendicular al camino recto y del mismo signo
      // para todas, que es lo que convierte siete viajes en un remolino:
      // en vez de caer al centro en línea, todas lo rodean por el mismo
      // lado antes de entrar.
      const desvioX = -dy * REMOLINO;
      const desvioY = dx * REMOLINO;

      this.#vuelos.push(
        pieza.animate(
          [
            { transform: `translate(0px, 0px) scale(1)`, opacity: 1 },
            {
              offset: 0.2,
              transform: `translate(${(-dx * 0.06).toFixed(1)}px, ${(-dy * 0.06).toFixed(1)}px) scale(1.04)`,
              opacity: 1,
            },
            {
              offset: 0.62,
              transform: `translate(${(dx * 0.42 + desvioX * 0.58).toFixed(1)}px, ${(dy * 0.42 + desvioY * 0.58).toFixed(1)}px) scale(0.58) rotate(70deg)`,
              opacity: 0.85,
            },
            {
              transform: `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(0.04) rotate(200deg)`,
              opacity: 0,
            },
          ],
          {
            duration: VIAJE_MS,
            delay: espera,
            // Sale despacio y llega disparada: es la curva de algo que
            // tira, no de algo que se va.
            easing: 'cubic-bezier(0.5, 0, 0.75, 0.15)',
            fill: 'forwards',
          }
        )
      );
      llegadas.push(espera + VIAJE_MS);
    });

    this.#engordar(llegadas);
  }

  /**
   * El logo engorda con lo que se traga.
   *
   * Se le da un tirón por cada llegada —se ensancha de golpe, rebota y
   * se recompone— y entre tirón y tirón el tamaño de reposo sube un
   * escalón, así que al final del viaje mide `GORDO`. Dos llegadas muy
   * juntas cuentan como una sola: siete tirones encabalgados no se leen
   * como engordar sino como vibrar.
   *
   * Va todo en una animación y no en clases porque los tiempos son los
   * de los viajes, y ésos los reparte el ancho de la ventana. Sigue
   * corriendo durante la carga —ahí el bulto se tensa— y muere en la
   * primera parte de `brota`, soltando de golpe lo que llevaba encima:
   * la píldora se abre justo mientras se desinfla.
   *
   * El tirón es redondo, no un aplastado. Un círculo achatado no se lee
   * como un golpe encajado sino como un círculo recortado por arriba: el
   * filo plano se ve antes que el gesto. Lo que da el golpe es el
   * encogido de un punto justo antes de recibir y el muelle de después,
   * no la deformación.
   */
  #engordar(llegadas: number[]): void {
    if (!this.#estado) return;

    const tragos: number[] = [];
    for (const cuando of [...llegadas].sort((a, b) => a - b)) {
      const anterior = tragos[tragos.length - 1];
      if (anterior === undefined || cuando - anterior >= TRAGO_MINIMO_MS) {
        tragos.push(cuando);
      }
    }
    if (!tragos.length) return;

    const total = ASPIRA_MS + CARGA_MS + SUELTA_MS;
    const punto = (ms: number): number => Math.min(1, Math.max(0, ms / total));
    const bulto = (paso: number): number => 1 + (paso / tragos.length) * (GORDO - 1);

    const cuadros: Keyframe[] = [{ offset: 0, transform: 'scale(1)' }];
    const marcar = (ms: number, tamano: number, salida?: string): void => {
      const offset = punto(ms);
      const ultimo = cuadros[cuadros.length - 1]?.offset;
      if (typeof ultimo === 'number' && offset < ultimo) return;
      const cuadro: Keyframe = { offset, transform: `scale(${tamano.toFixed(3)})` };
      if (salida) cuadro.easing = salida;
      cuadros.push(cuadro);
    };

    tragos.forEach((cuando, i) => {
      const antes = bulto(i);
      const luego = bulto(i + 1);

      // Se encoge un punto justo antes de recibir: es lo que hace que
      // el tirón siguiente se lea como un golpe y no como un escalón.
      marcar(cuando - 60, antes * 0.98, 'cubic-bezier(0.5, 0, 0.75, 0.15)');
      // El tirón.
      marcar(cuando, luego + TRAGO, 'cubic-bezier(0.16, 1, 0.3, 1)');
      // Y se recompone en su tamaño nuevo.
      marcar(cuando + 130, luego, 'cubic-bezier(0.34, 1.56, 0.64, 1)');
    });

    // Lleno. Durante la carga el bulto se tensa hacia dentro y en el
    // último instante revienta: ahí es donde la píldora se abre.
    marcar(ASPIRA_MS, GORDO, 'cubic-bezier(0.34, 1.56, 0.64, 1)');
    marcar(ASPIRA_MS + CARGA_MS * 0.45, GORDO * 0.97, 'cubic-bezier(0.5, 0, 0.75, 0.15)');
    marcar(ASPIRA_MS + CARGA_MS, REVIENTA, 'cubic-bezier(0.16, 1, 0.3, 1)');
    cuadros.push({ offset: 1, transform: 'scale(1)' });

    this.#vuelos.push(
      this.#estado.animate(cuadros, {
        duration: total,
        easing: 'linear',
        fill: 'forwards',
      })
    );
  }

  #cortarCeremonia(): void {
    for (const reloj of this.#tramos) window.clearTimeout(reloj);
    this.#tramos = [];
    for (const vuelo of this.#vuelos) vuelo.cancel();
    this.#vuelos = [];
  }
}
