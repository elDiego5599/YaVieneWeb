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
 *   ida:    reposo → aspira → carga → brota → reposo
 *   vuelta: reposo → recoge → brota → reposo
 *
 * Y un tercero, `data-pulsado`, que es el del interruptor: cambia con el
 * toque, junto con `aria-pressed`, y de él cuelga la marca blanca. La
 * escena puede tardar en llegar a la cara nueva; el control no.
 *
 * En `aspira` la alerta roja se encoge hasta ser el logo, la maraña de
 * hilos se recoge hacia él y se traga los rayos y las voces, que son el
 * ruido, y también el titular y la frase de la cabecera (el interruptor
 * se queda): durante la escena sólo queda la píldora que cambia. Y engorda con lo que se traga: cada llegada le da un tirón y de
 * una a otra queda un poco más grande. En `carga` ese bulto late y cambia
 * de color. En `brota` se vuelve a abrir como «Ya Viene», sube, los
 * titular y la frase nuevos salen de ella, vuelven a su sitio y tras ellos
 * los cuatro avisos, ya arriba, crecen hasta su fila mientras brota el
 * árbol de hilos verdes que baja a cada uno (todo con transform y opacity:
 * el alto de la cabecera no se mueve). Los avisos también
 * se los traga —lo caótico entra por el centro y sale ordenado, como en
 * el diagrama de incident.io—, con el mismo remolino que los rayos y las
 * voces, largo y suave (ease-in, la escala baja a lo largo del viaje y la
 * opacidad sólo cae al llegar); al acabar quedan en su sitio, enteros y sin transformación.
 *
 * Pulsar a media escena la corta, y cada pieza vuelve a su sitio desde
 * donde se estaba viendo, no desde donde debería estar: se lee lo que el
 * navegador está pintando antes de cancelar y se vuelve desde ahí.
 *
 * Aquí se calculan las medidas que dependen del ancho: el vuelo de cada
 * pieza hasta el logo, adónde viaja cada aviso y por dónde pasa cada hilo
 * (`escenario-red.ts`, con las cajas de verdad). Lo demás —el encogido,
 * el latido, el viaje y el dibujo de los hilos— es CSS colgando de
 * `data-cara` y `data-fase`.
 *
 * La vuelta es corta, 0,8 s, y hace el camino de la ida al revés: los
 * avisos y la cabecera entran en la píldora mientras baja al centro, y
 * de ahí salen a su desorden, con los rayos y las voces, por el mismo
 * remolino y con la curva espejada. Sin el carga ni el latido: deshacer
 * no se celebra, pero lo que entró por un sitio sale por el mismo.
 *
 * Lo otro que hace, y por lo que no basta con dos `<button>` sueltos: el
 * lector de pantalla no puede oír las dos versiones del titular seguidas,
 * así que la cara que no toca se marca con `aria-hidden`.
 *
 * Y una cortesía: la primera vez que la sección asoma se cambia sola de
 * lado, una vez, para que se vea que el interruptor está ahí. Quien lo
 * toque antes cancela el aviso —a partir de ese momento manda quien lee—,
 * y quien haya pedido que nada se mueva no lo ve nunca: ni ceremonia, ni
 * vuelta, ni regreso, ni cambio automático; sólo el fundido de las caras
 * del CSS.
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
 * sale y la última. Viajan los rayos, las voces, los avisos y el texto de
 * la cabecera (los grandes salen los últimos: se ordenan de menor a mayor
 * bulto). 760 ms es lo que hace falta para seguir con el ojo una pieza
 * que cruza la sección (con 380 se leía como un tirón); el relevo de
 * 260 ms reparte las salidas sin que la escena se lea como espera.
 */
const VIAJE_MS = 760;
const RELEVO_MS = 260;

/**
 * Los tres tramos de la ceremonia, 2,6 s entre todos (tope 2,8). El
 * primero dura el último viaje —texto y avisos incluidos— y 80 ms de
 * respiro con el escenario limpio; el segundo es corto a propósito, que un
 * latido largo se vuelve un pulso de espera; el tercero es lo que tarda el
 * último aviso en salir de la píldora: su espera (`ESPERA_AVISOS_MS`, tras
 * el texto) más `SALE_MS` y su turno (`TURNO_SALIDA_MS` por aviso), con el
 * árbol terminando a los 0,95 s (`problema.css`).
 */
const ASPIRA_MS = VIAJE_MS + RELEVO_MS + 80;
const CARGA_MS = 320;
const BROTA_MS = 1200;

/** Lo que tarda una pieza en crecer desde la píldora hasta su sitio. */
const SALE_MS = 700;
/** El escalón entre una pieza y la siguiente: el texto sale primero. */
const TURNO_SALIDA_MS = 90;
/** Los avisos esperan a que titular y párrafo (2 turnos) hayan salido: 180 + 3 × 90 + 700 = 1150 < BROTA_MS. */
const ESPERA_AVISOS_MS = 2 * TURNO_SALIDA_MS;

/**
 * Cuánto gira el texto de la cabecera en el remolino, respecto a las
 * piezas pequeñas: un bloque de texto de ancho completo dando 200° se lee
 * como un error de maquetación, no como un remolino.
 */
const GIRO_TEXTO = 0.2;

/**
 * Cuánto se desvía cada pieza del camino recto al centro, en tanto por
 * uno de lo que le falta por recorrer. Todas se desvían hacia el mismo
 * lado: eso es lo que hace que siete viajes se lean como un remolino y
 * no como siete cosas cayendo a un agujero.
 */
const REMOLINO = 0.3;

/** El texto de la cabecera que cambia de cara: titular y párrafo (el interruptor no). */
const CABEZA = '.seccion-cabecera .dos-caras';

/**
 * El engorde. `GORDO` es lo que mide el logo al acabar de tragárselo
 * todo, en tanto por uno de su tamaño de partida; `TRAGO` es el tirón
 * de más que da en cada llegada, y `REVIENTA` lo que se estira en el
 * instante de abrirse. Medio tamaño más es mucho para un adorno y poco
 * para lo que aquí se está contando: tiene que verse sin mirarlo.
 */
const GORDO = 1.34;
const TRAGO = 0.05;
const REVIENTA = 1.4;

/**
 * Dos llegadas más juntas que esto se cuentan como un solo trago. Sin
 * esto son siete tirones de 46 ms encabalgados, que no es engordar: es
 * vibrar.
 */
const TRAGO_MINIMO_MS = 220;

/** Lo que tarda el logo en soltar el bulto al abrirse. */
const SUELTA_MS = 400;

/**
 * El regreso cuando se corta la escena. Cerca de su sitio, 350 ms: más
 * corto se lee como un salto, más largo como que la escena no hace caso.
 * Lejos, la duración crece con lo que le falta a la pieza más lejana,
 * 1,75 ms por px, y todas llegan juntas: la curva de abajo tiene su pico
 * a 2,56 veces la media, así que 1/1,75 px/ms × 2,56 × 16,7 ms ≈ 24 px
 * en el peor cuadro, el tope de lo que se sigue con la vista sin leerse
 * como salto. Hasta 800 ms, lo que dura la vuelta entera: un regreso no
 * puede tardar más que la escena que deshace; ese tope llega a ~460 px,
 * y más lejos que eso solo están las chispas, chicas o transparentes.
 * Medido en el navegador (1440×900), el peor cuadro pesado por
 * opacidad × escala queda bajo 25 px en cualquier momento del corte.
 */
const REGRESO_MS = 350;
const REGRESO_MAX_MS = 800;
const REGRESO_MS_POR_PX = 1.75;

/**
 * La curva del regreso, ease-in-out (0.3, 0, 0.2, 1): arranca con
 * pendiente 0, porque las piezas iban hacia el logo y dar la vuelta con
 * la velocidad de salida de `--ease-fluida` (6× la media en el primer
 * cuadro, hasta 136 px) es un muro; se posa con la cola larga de la
 * fluida (el 0,2 y el 1), sin rebote. Su pico es 2,6× la media: con
 * 1,1 ms por px, unos 39 px por cuadro sin pesar, y a esa altura del
 * vuelo la pieza aún va pequeña y transparente.
 */
const REGRESO_CURVA = 'cubic-bezier(0.3, 0, 0.2, 1)';

/**
 * La vuelta, 0,8 s entre todo. `recoge`: cada pieza tarda 240 ms en
 * entrar y la siguiente sale 25 ms después (seis piezas, la última a los
 * 125: bajo el techo de 150 en el que un escalonado aún se lee como un
 * solo gesto), y el tramo se cierra a los 380, un cuadro después de que
 * llegue la última. Luego salen en 340 ms, repartidas en 80: 380 + 80 +
 * 340 = 800.
 */
const ENTRA_MS = 240;
const ESCALON_ENTRA_MS = 25;
const RECOGE_MS = 380;
const SUELTA_VUELTA_MS = 340;
const RELEVO_VUELTA_MS = 80;
const VUELTA_MS = RECOGE_MS + RELEVO_VUELTA_MS + SUELTA_VUELTA_MS;

/**
 * Las curvas de la vuelta, espejo de las de la ida (los puntos de
 * control, al revés y restados de 1). Entrar en la píldora es la salida
 * de `brota` (0.16, 1, 0.3, 1) espejada, pero con el primer punto en 0,4
 * y no en 0,7: la espejada exacta pasa los primeros 50 ms quieta, y la
 * primera pieza tiene que moverse en el primer cuadro. Salir es el
 * remolino de `aspira` (0.42, 0, 0.8, 0.55) espejado.
 */
const ENTRA_CURVA = 'cubic-bezier(0.4, 0, 1, 1)';
const SALE_CURVA = 'cubic-bezier(0.2, 0.45, 0.58, 1)';

/** Una animación y la pieza que mueve: hace falta la pieza para leer dónde está. */
type Vuelo = { el: HTMLElement; anim: Animation };

export class Problema {
  readonly #seccion: HTMLElement;
  readonly #botones: HTMLButtonElement[];
  readonly #estado: HTMLElement | null;
  /** Lo que rodea al círculo y el recorte de la píldora se comería. */
  readonly #halo: HTMLElement | null;

  #ojo: IntersectionObserver | null = null;
  #reloj: number | null = null;

  /** Los relojes de la ceremonia, para poder cortarla a media escena. */
  #tramos: number[] = [];
  /** Lo que está volando hacia el logo ahora mismo. */
  #vuelos: Vuelo[] = [];
  /** Lo mismo, pero de los avisos: `brota` los cancela para medirlos. */
  #cartas: Vuelo[] = [];
  /** Los hilos, creados una vez; `#trazar` sólo les cambia el `d`. */
  #enredo: SVGPathElement[] = [];
  #arbol: SVGPathElement[] = [];

  constructor(seccion: HTMLElement) {
    this.#seccion = seccion;
    this.#estado = seccion.querySelector<HTMLElement>('.escenario-estado');
    this.#halo = seccion.querySelector<HTMLElement>('.estado-halo');
    this.#botones = Array.from(
      seccion.querySelectorAll<HTMLButtonElement>('.interruptor-opcion')
    );
    this.#pulsar(seccion.dataset.cara ?? 'ciego');

    for (const boton of this.#botones) {
      boton.addEventListener('click', () => {
        // Un toque en el interruptor apaga el cambio automático: ya no
        // hace falta enseñar nada, se ha entendido.
        this.#parar();
        this.#poner(boton.dataset.cara ?? 'ciego');
      });
    }

    // Los hilos se trazan con la tipografía ya cargada: con la de
    // respaldo la píldora y los avisos miden otra cosa.
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
    // Fuera de la vista no hay a quién enseñarle la vuelta.
    this.#poner('ciego', false);
  }

  #parar(): void {
    if (this.#reloj !== null) {
      window.clearTimeout(this.#reloj);
      this.#reloj = null;
    }
    this.#ojo?.disconnect();
    this.#ojo = null;
  }

  // ── La medida ──────────────────────────────────────────────────────

  #pedirMedida(): void {
    // Sólo en reposo: a media escena los avisos están volando y la
    // fila se mediría desde donde no están.
    if (this.#seccion.dataset.fase && this.#seccion.dataset.fase !== 'reposo') return;
    this.#trazar();
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

    // La píldora no cambia de tamaño (lo que se cierra es su recorte):
    // su caja es la de reposo siempre.
    const pildora = caja(this.#estado);

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

  #poner(cara: string, escena = true): void {
    // Adónde va la sección es lo que dice el control, no la escena: la
    // cara sólo cambia a mitad de la ceremonia. Pedir lo que ya está
    // pedido no es un cambio y no se rehace nada. Sin esto, volver a
    // pulsar el botón ya pulsado mientras la red acababa de ponerse verde
    // relanzaba la ceremonia con `data-cara` ya en «claro», y el tramo
    // del enredo se representaba con los textos y los avisos de «Con Ya
    // Viene».
    if (this.#seccion.dataset.pulsado === cara) return;
    this.#pulsar(cara);

    // A media escena (o a media vuelta atrás de otra) no se empieza otra
    // ceremonia encima: se vuelve al reposo desde lo que se ve y la cara
    // cambia con el relevo del CSS.
    const aMedias = this.#tramos.length > 0;
    this.#cortarCeremonia(aMedias);

    if (aMedias || !escena || sinMovimiento() || this.#seccion.dataset.cara === cara) this.#cambiar(cara);
    else if (cara === 'claro') this.#ceremonia();
    else if (this.#ancho()) this.#vuelta();
    else this.#cambiar(cara);
  }

  /** El control, en el acto: la marca cuelga de `data-pulsado`. */
  #pulsar(cara: string): void {
    this.#seccion.dataset.pulsado = cara;
    for (const boton of this.#botones) {
      boton.setAttribute('aria-pressed', String(boton.dataset.cara === cara));
    }
  }

  /** El cambio pelado de la escena, sin ceremonia. */
  #cambiar(cara: string): void {
    this.#seccion.dataset.fase = 'reposo';
    if (this.#seccion.dataset.cara === cara) return;
    this.#seccion.dataset.cara = cara;

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
        this.#brotar();
      }, ASPIRA_MS + CARGA_MS),

      window.setTimeout(() => {
        this.#cortarCeremonia();
        this.#seccion.dataset.fase = 'reposo';
        this.#pedirMedida();
      }, ASPIRA_MS + CARGA_MS + BROTA_MS)
    );
  }

  /**
   * Se lo lleva todo: los rayos, las voces y los avisos van al logo, de
   * lo más pequeño a lo más grande, y la maraña se recoge con ellos desde
   * el CSS. Los avisos vuelven a salir de él en `brota`.
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

    const escenarioAncho = this.#ancho();
    const piezas = Array.from(this.#seccion.querySelectorAll<HTMLElement>(`.chispa, .ruido, .aviso, ${CABEZA}`))
      // Avisos y texto sólo vuelan con el escenario ancho: debajo van apilados.
      .filter((pieza) => escenarioAncho || !pieza.matches(`.aviso, ${CABEZA}`))
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
      // chispazos ni voces, y los avisos están apilados sin ceremonia que romper.
      .filter((v) => v.bulto > 0)
      .sort((a, b) => a.bulto - b.bulto);

    const ultima = Math.max(1, piezas.length - 1);
    const llegadas: number[] = [];

    piezas.forEach(({ pieza, dx, dy }, turno) => {
      const espera = (turno / ultima) * RELEVO_MS;

      const anim = pieza.animate(this.#remolino(dx, dy, pieza.matches(CABEZA) ? GIRO_TEXTO : 1), {
        duration: VIAJE_MS,
        delay: espera,
        // Aceleración progresiva (ease-in suave): sale con calma, coge
        // velocidad y entra sin el latigazo de la curva anterior.
        easing: 'cubic-bezier(0.42, 0, 0.8, 0.55)',
        fill: 'forwards',
      });
      (pieza.matches(`.aviso, ${CABEZA}`) ? this.#cartas : this.#vuelos).push({ el: pieza, anim });
      llegadas.push(espera + VIAJE_MS);
    });

    this.#engordar(llegadas);
  }

  /** ¿Se dibuja el lienzo de hilos? Es lo que dice que los avisos están sueltos (≥ 1024 px). */
  #ancho(): boolean {
    const red = this.#seccion.querySelector('.escenario-red');
    return !!red && getComputedStyle(red).display !== 'none';
  }

  /**
   * El camino de una pieza hasta el centro del logo (dx, dy es lo que le
   * falta). Compartido por rayos, voces, avisos y texto: el mismo
   * remolino a la ida y, recorrido al revés, en la vuelta.
   */
  #remolino(dx: number, dy: number, giro = 1): Keyframe[] {
    // El desvío es perpendicular al camino recto y del mismo signo
    // para todas, que es lo que convierte siete viajes en un remolino:
    // en vez de caer al centro en línea, todas lo rodean por el mismo
    // lado antes de entrar.
    const desvioX = -dy * REMOLINO;
    const desvioY = dx * REMOLINO;
    const gira = (grados: number) => `rotate(${(grados * giro).toFixed(0)}deg)`;
    // La escala baja a lo largo de todo el viaje y no llega a casi 0
    // hasta el último cuadro; la opacidad se mantiene entera hasta tres
    // cuartos y cae sólo al llegar: la pieza se ve entrar, no se apaga.
    return [
        { offset: 0, transform: `translate(0px, 0px) scale(1)`, opacity: 1 },
        {
          offset: 0.18,
          transform: `translate(${(-dx * 0.04).toFixed(1)}px, ${(-dy * 0.04).toFixed(1)}px) scale(1.03)`,
          opacity: 1,
        },
        {
          offset: 0.55,
          transform: `translate(${(dx * 0.4 + desvioX * 0.6).toFixed(1)}px, ${(dy * 0.4 + desvioY * 0.6).toFixed(1)}px) scale(0.66) ${gira(70)}`,
          opacity: 1,
        },
        {
          offset: 0.85,
          transform: `translate(${(dx * 0.86).toFixed(1)}px, ${(dy * 0.86).toFixed(1)}px) scale(0.3) ${gira(150)}`,
          opacity: 0.75,
        },
        {
          offset: 1,
          transform: `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(0.04) ${gira(200)}`,
          opacity: 0,
        },
    ];
  }

  /**
   * Los avisos salen de la píldora, ya arriba, y crecen hasta su fila,
   * uno detrás de otro. Se parte de que el CSS de `brota` los deja ya en
   * su sitio (sin transición): aquí sólo se les resta el camino a la
   * píldora y se les devuelve creciendo. Al acabar, la animación se
   * cancela con la ceremonia y no queda transformación alguna.
   */
  #brotar(): void {
    if (!this.#estado || !this.#ancho()) return;
    // Las animaciones de `aspira` los tienen encogidos: fuera, para medirlos.
    for (const { anim } of this.#cartas) anim.cancel();
    this.#cartas = [];

    const n = this.#estado.getBoundingClientRect();
    const subida = parseFloat(this.#estado.style.getPropertyValue('--subida')) || 0;
    const destino = { x: n.x + n.width / 2, y: n.y + n.height / 2 + subida };

    // Primero el texto (titular, párrafo) y tras él los avisos.
    const salidas = [
      ...Array.from(this.#seccion.querySelectorAll<HTMLElement>(CABEZA), (el) => ({ el, extra: 0 })),
      ...Array.from(this.#seccion.querySelectorAll<HTMLElement>('.aviso'), (el) => ({ el, extra: ESPERA_AVISOS_MS })),
    ];
    salidas.forEach(({ el: aviso, extra }, i) => {
      const caja = aviso.getBoundingClientRect();
      if (caja.width * caja.height === 0) return;
      const dx = destino.x - (caja.x + caja.width / 2);
      const dy = destino.y - (caja.y + caja.height / 2);
      this.#vuelos.push({
        el: aviso,
        anim: aviso.animate(
          [
            { transform: `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(0.04)`, opacity: 0 },
            { transform: 'translate(0px, 0px) scale(1)', opacity: 1 },
          ],
          {
            duration: SALE_MS,
            delay: extra + (extra ? i - 2 : i) * TURNO_SALIDA_MS,
            // Sale con empuje y se posa: la salida del trago.
            easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
            // `both`: encogido y sin verse mientras espera su turno.
            fill: 'both',
          }
        ),
      });
    });
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
      marcar(cuando - 90, antes * 0.99, 'cubic-bezier(0.42, 0, 0.8, 0.55)');
      // El tirón.
      marcar(cuando, luego + TRAGO, 'cubic-bezier(0.22, 1, 0.36, 1)');
      // Y se recompone en su tamaño nuevo, con un muelle corto.
      marcar(cuando + 220, luego, 'cubic-bezier(0.34, 1.2, 0.64, 1)');
    });

    // Lleno. Durante la carga el bulto se tensa hacia dentro y en el
    // último instante revienta: ahí es donde la píldora se abre.
    marcar(ASPIRA_MS, GORDO, 'cubic-bezier(0.34, 1.2, 0.64, 1)');
    marcar(ASPIRA_MS + CARGA_MS * 0.45, GORDO * 0.98, 'cubic-bezier(0.42, 0, 0.8, 0.55)');
    marcar(ASPIRA_MS + CARGA_MS, REVIENTA, 'cubic-bezier(0.22, 1, 0.36, 1)');
    cuadros.push({ offset: 1, transform: 'scale(1)' });

    // El halo engorda con la píldora: es su borde.
    for (const el of [this.#estado, this.#halo]) {
      if (el) this.#vuelos.push({ el, anim: el.animate(cuadros, { duration: total, easing: 'linear', fill: 'forwards' }) });
    }
  }

  // ── La vuelta ──────────────────────────────────────────────────────

  /**
   * Avisos y cabecera entran en la píldora mientras ella baja al centro
   * (CSS de `recoge`): del último que salió al primero, y van al centro
   * de «A ciegas», no a donde está ahora, para encontrarse con ella.
   * Luego la cara cambia y todo sale de ese centro a su desorden.
   */
  #vuelta(): void {
    if (!this.#estado) return;
    this.#seccion.dataset.fase = 'recoge';

    const n = this.#estado.getBoundingClientRect();
    const subida = parseFloat(this.#estado.style.getPropertyValue('--subida')) || 0;
    const centro = { x: n.x + n.width / 2, y: n.y + n.height / 2 - subida };

    const entran = Array.from(this.#seccion.querySelectorAll<HTMLElement>(`${CABEZA}, .aviso`)).reverse();
    entran.forEach((el, i) => {
      const caja = el.getBoundingClientRect();
      if (caja.width * caja.height === 0) return;
      const dx = centro.x - (caja.x + caja.width / 2);
      const dy = centro.y - (caja.y + caja.height / 2);
      this.#cartas.push({
        el,
        anim: el.animate(
          [
            { transform: 'translate(0px, 0px) scale(1)', opacity: 1 },
            { transform: `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(0.04)`, opacity: 0 },
          ],
          { duration: ENTRA_MS, delay: i * ESCALON_ENTRA_MS, easing: ENTRA_CURVA, fill: 'forwards' }
        ),
      });
    });

    this.#tramos.push(
      window.setTimeout(() => {
        this.#cambiar('ciego');
        this.#seccion.dataset.fase = 'brota';
        this.#soltar(centro);
      }, RECOGE_MS),
      window.setTimeout(() => {
        this.#cortarCeremonia();
        this.#seccion.dataset.fase = 'reposo';
        this.#pedirMedida();
      }, VUELTA_MS)
    );
  }

  /**
   * Todo sale del centro a su desorden por el remolino de la ida, al
   * revés: rayos, voces, avisos y texto, de lo más grande a lo más
   * pequeño (el último que entró a la ida es el primero que sale). Sin
   * el tirón de arranque de la ida, que al revés sería un rebote al
   * llegar.
   */
  #soltar(centro: { x: number; y: number }): void {
    // Lo de `recoge` los tiene encogidos en el centro: fuera, para medirlos.
    for (const { anim } of this.#cartas) anim.cancel();
    this.#cartas = [];

    const piezas = Array.from(this.#seccion.querySelectorAll<HTMLElement>(`.chispa, .ruido, .aviso, ${CABEZA}`))
      .map((el) => {
        const caja = el.getBoundingClientRect();
        return {
          el,
          dx: centro.x - (caja.x + caja.width / 2),
          dy: centro.y - (caja.y + caja.height / 2),
          bulto: caja.width * caja.height,
        };
      })
      .filter((v) => v.bulto > 0)
      .sort((a, b) => b.bulto - a.bulto);

    const ultima = Math.max(1, piezas.length - 1);
    piezas.forEach(({ el, dx, dy }, turno) => {
      const camino = this.#remolino(dx, dy, el.matches(CABEZA) ? GIRO_TEXTO : 1)
        .filter((cuadro) => cuadro.offset !== 0.18)
        .reverse()
        .map((cuadro) => ({ ...cuadro, offset: 1 - Number(cuadro.offset) }));
      this.#vuelos.push({
        el,
        anim: el.animate(camino, {
          duration: SUELTA_VUELTA_MS,
          delay: (turno / ultima) * RELEVO_VUELTA_MS,
          easing: SALE_CURVA,
          fill: 'both',
        }),
      });
    });
  }

  /**
   * Corta lo que esté en marcha. Con `suave`, cada pieza vuelve a su
   * reposo desde lo que se está viendo: se lee el transform y la
   * opacidad que el navegador pinta ahora —antes de cancelar, que
   * cancelada la pieza ya está en su sitio y se leería el destino— y se
   * anima desde ahí hasta el valor de debajo (un solo cuadro, en 0: el
   * final lo pone el CSS). Sin esto la píldora y los avisos saltaban de
   * golpe a su sitio.
   */
  #cortarCeremonia(suave = false): void {
    for (const reloj of this.#tramos) window.clearTimeout(reloj);
    this.#tramos = [];
    const todos = [...this.#vuelos, ...this.#cartas];
    this.#vuelos = [];
    this.#cartas = [];

    const vistos =
      suave && !sinMovimiento()
        ? [...new Set(todos.map(({ el }) => el))].map((el) => {
            const { transform, opacity } = window.getComputedStyle(el);
            return { el, transform: transform || 'none', opacity, falta: falta(el, transform) };
          })
        : [];
    for (const { anim } of todos) anim.cancel();

    const lejos = Math.max(0, ...vistos.map((v) => v.falta));
    const duracion = Math.round(Math.min(REGRESO_MAX_MS, Math.max(REGRESO_MS, lejos * REGRESO_MS_POR_PX)));
    for (const { el, transform, opacity } of vistos) {
      const desde: Keyframe = { offset: 0, transform };
      if (opacity) desde.opacity = opacity;
      this.#vuelos.push({ el, anim: el.animate([desde], { duration: duracion, easing: REGRESO_CURVA }) });
    }
    // Mientras vuelven, un toque más es otro corte, no una ceremonia nueva.
    if (vistos.length) {
      this.#tramos.push(
        window.setTimeout(() => {
          this.#tramos = [];
          this.#vuelos = [];
        }, duracion)
      );
    }
  }
}

/**
 * Cuánto le falta a una pieza para volver a su sitio desde `transform`
 * (lo que pinta el navegador, `matrix(a, b, c, d, e, f)`): lo que está
 * desplazada más lo que se mueve su borde al recuperar la escala, que
 * en la píldora encogida es todo el viaje.
 */
function falta(el: HTMLElement, transform: string): number {
  const m = transform.match(/^matrix\(([^)]+)\)$/)?.[1].split(',').map(Number);
  if (!m || m.length !== 6 || m.some((n) => !Number.isFinite(n))) return 0;
  const escala = Math.hypot(m[0], m[1]);
  return Math.hypot(m[4], m[5]) + (Math.abs(1 - escala) * Math.max(el.offsetWidth, el.offsetHeight)) / 2;
}
