/**
 * El interruptor de «Qué resuelve».
 *
 * La sección enseña la misma espera dos veces: «A ciegas», que es el
 * problema, y «Con Ya Viene», que es lo que la app hace con él. Las dos
 * caras están escritas en el HTML y dibujadas en `componentes/problema.css`;
 * de aquí sale el atributo `data-cara` de la sección, que es de donde
 * cuelga todo el cambio, y `data-pulsado`, el del interruptor, que cambia
 * con el toque junto con `aria-pressed` y del que cuelga la marca blanca.
 *
 * El cambio es el del diagrama de Problem/Solution de incident.io:
 * ordenarse en su sitio. Nada se traga ni vuela al centro, y la escena
 * nunca se queda vacía: el ruido se apaga donde está, la alerta roja se
 * vuelve la píldora verde sin moverse de su centro, los avisos se
 * enderezan y se deslizan a su fila —de la píldora hacia fuera— y el
 * árbol crece a su paso. Todo son transiciones de CSS colgadas de
 * `data-cara` (sólo transform, opacity y clip-path), y por eso un toque a
 * media escena no necesita nada de aquí: el navegador retoma cada
 * transición desde el valor que está pintando.
 *
 * Aquí sólo se calcula lo que depende del ancho: adónde va cada aviso
 * (`--fila`), cuánto sube la píldora (`--subida`), cuánto se cierra su
 * recorte (`--recorte`), el turno de cada aviso y cada pieza del árbol
 * (`--orden`) y por dónde pasa cada hilo (`escenario-red.ts`).
 *
 * Lo otro que hace, y por lo que no basta con dos `<button>` sueltos: el
 * lector de pantalla no puede oír las dos versiones del titular seguidas,
 * así que la cara que no toca se marca con `aria-hidden`.
 *
 * Y una cortesía: la primera vez que la sección asoma se cambia sola de
 * lado, una vez, para que se vea que el interruptor está ahí. Quien lo
 * toque antes cancela el aviso —a partir de ese momento manda quien lee—,
 * y quien haya pedido que nada se mueva no lo ve nunca: sólo el fundido
 * de las caras del CSS, y cuando lo pide él.
 */

import { tramos, trazar } from './escenario-red';
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

export class Problema {
  readonly #seccion: HTMLElement;
  readonly #botones: HTMLButtonElement[];
  readonly #estado: HTMLElement | null;

  #ojo: IntersectionObserver | null = null;
  #reloj: number | null = null;

  /** Los hilos, creados una vez; `#trazar` sólo les cambia el `d`. */
  #enredo: SVGPathElement[] = [];
  #arbol: SVGPathElement[] = [];

  constructor(seccion: HTMLElement) {
    this.#seccion = seccion;
    this.#estado = seccion.querySelector<HTMLElement>('.escenario-estado');
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
    if (document.fonts) void document.fonts.ready.then(() => this.#trazar());
    // El escenario y los avisos, no la ventana: los avisos van fuera del
    // flujo y cambian de alto con el ancho y la letra sin que el
    // escenario se entere, y los hilos tienen que seguir tocándolos. El
    // observador ya agrupa por cuadro (e2e/resize-agrupado.spec.ts).
    const medida = new ResizeObserver(() => this.#trazar());
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
    // Quien vuelva a subir se encuentra otra vez el problema.
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

  // ── Los hilos y la fila ────────────────────────────────────────────

  /**
   * Lee el escenario a ciegas —`offset*` y el `left`/`top` calculados no
   * ven el viaje ni el ladeo, que van en `translate` y `rotate`, así que
   * se puede medir también a media escena— y deja escrito lo que depende
   * del ancho. Por debajo de 1024 el lienzo no se dibuja y los avisos van
   * apilados: no hay fila ni árbol, pero el recorte de la píldora sí.
   */
  #trazar(): void {
    if (!this.#estado) return;
    // La píldora no cambia de tamaño: lo que se cierra es su recorte, a
    // cada lado lo que sobra de «Ya Viene» con su aire (el `padding`), y
    // así la forma es la de la píldora de la app y no la de la alerta.
    const { paddingLeft, paddingRight } = getComputedStyle(this.#estado);
    const claro = this.#estado.querySelector<HTMLElement>('.cara--claro');
    const sobra = this.#estado.offsetWidth - (claro?.offsetWidth ?? 0) - parseFloat(paddingLeft) - parseFloat(paddingRight);
    this.#estado.style.setProperty('--recorte', `${Math.max(0, sobra / 2)}px`);

    // Los cuatro avisos, del alto del más alto (dueño, 2026-10-12): el
    // texto de cada uno cambia lo que mide y la fila quedaba dentada. Se
    // mide sin el mínimo puesto, para que encoja si el texto encoge.
    const lista = this.#seccion.querySelector<HTMLElement>('.avisos');
    if (lista) {
      lista.style.removeProperty('--alto-aviso');
      const alto = Math.max(...Array.from(lista.querySelectorAll<HTMLElement>('.aviso'), (a) => a.offsetHeight));
      if (alto > 0) lista.style.setProperty('--alto-aviso', `${alto}px`);
    }

    const red = this.#seccion.querySelector<SVGSVGElement>('.escenario-red');
    const escena = red?.parentElement;
    if (!red || !escena || getComputedStyle(red).display === 'none') return;
    const avisos = Array.from(this.#seccion.querySelectorAll<HTMLElement>('.aviso'));
    const e = this.#estado;
    // Su celda va posicionada (lleva la sombra por encima de los hilos):
    // los `offset*` de la píldora son desde ella, y el plano es el escenario.
    const celda = e.parentElement !== escena ? e.parentElement : null;
    const pildora = {
      x: e.offsetLeft + (celda?.offsetLeft ?? 0),
      y: e.offsetTop + (celda?.offsetTop ?? 0),
      w: e.offsetWidth,
      h: e.offsetHeight,
    };
    // Los avisos, con decimales: `offset*` redondea y la fila se veía
    // escalonada medio píxel.
    const ciegas = avisos.map((a) => {
      const { left, top, width, height } = getComputedStyle(a);
      return { x: parseFloat(left), y: parseFloat(top), w: parseFloat(width), h: parseFloat(height) };
    });

    const w = escena.clientWidth;
    const h = escena.clientHeight;
    const plano = trazar({ ancho: w, alto: h }, pildora, ciegas);

    avisos.forEach((aviso, i) => {
      const { x, y } = plano.fila[i];
      aviso.style.setProperty('--fila', `${x - ciegas[i].x}px ${y - ciegas[i].y}px`);
      aviso.style.setProperty('--orden', String(plano.orden[i]));
    });
    this.#estado.style.setProperty('--subida', `${plano.pildoraClara.y - pildora.y}px`);

    red.setAttribute('viewBox', `0 0 ${w} ${h}`);
    const hilo = (guardados: SVGPathElement[], i: number): SVGPathElement => {
      guardados[i] ??= red.appendChild(document.createElementNS('http://www.w3.org/2000/svg', 'path'));
      return guardados[i];
    };
    plano.enredo.forEach((d, i) => {
      const camino = hilo(this.#enredo, i);
      camino.setAttribute('class', 'hilo hilo--enredo');
      camino.setAttribute('d', d);
    });
    // Cada rama, en sus piezas: crecen por turnos con su aviso. El codo
    // de abajo (`rodilla`) va después de la viga y no con el tronco.
    plano.arbol.flatMap((d, i) => tramos(d).map((t, j) => ({ ...t, j, orden: plano.orden[i] }))).forEach((t, i) => {
      const camino = hilo(this.#arbol, i);
      const extra = (t.izq ? ' tramo--izq' : '') + (t.pieza === 'codo' && t.j > 2 ? ' tramo--rodilla' : '');
      camino.setAttribute('class', `hilo hilo--arbol tramo tramo--${t.pieza}${extra}`);
      camino.setAttribute('d', t.d);
      camino.style.setProperty('--orden', String(t.orden));
    });
  }

  // ── El cambio de cara ──────────────────────────────────────────────

  #poner(cara: string): void {
    // Pedir lo que ya está pedido no es un cambio.
    if (this.#seccion.dataset.pulsado === cara) return;
    this.#pulsar(cara);
    this.#cambiar(cara);
  }

  /** El control, en el acto: la marca cuelga de `data-pulsado`. */
  #pulsar(cara: string): void {
    this.#seccion.dataset.pulsado = cara;
    for (const boton of this.#botones) {
      boton.setAttribute('aria-pressed', String(boton.dataset.cara === cara));
    }
  }

  /** La escena entera cuelga de este atributo; el CSS hace el resto. */
  #cambiar(cara: string): void {
    this.#seccion.dataset.cara = cara;
    for (const rostro of this.#seccion.querySelectorAll<Element>('.cara')) {
      if (rostro.classList.contains(`cara--${cara}`)) {
        rostro.removeAttribute('aria-hidden');
      } else {
        rostro.setAttribute('aria-hidden', 'true');
      }
    }
  }
}
