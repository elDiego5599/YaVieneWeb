/**
 * El motor del scrollytelling.
 *
 * Una «pista» es un bloque alto —varias pantallas— con una escena pegada
 * dentro. Mientras la pista cruza la ventana la escena se queda quieta y
 * lo que cambia es lo que hay dentro de ella: el reloj corre, los pasos se
 * acercan, el visor pasa de una pieza a otra. Todo eso necesita el mismo
 * dato, un número de 0 a 1 que diga cuánto se ha recorrido de la pista.
 *
 * Aquí no hay animaciones: sólo la medida. Cada módulo decide qué hace con
 * ella. La medición va enganchada a `requestAnimationFrame`, así que por
 * mucho que el navegador dispare eventos de scroll sólo se lee el layout
 * una vez por cuadro.
 */

export const limitar = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Suaviza los extremos: arranca y frena en vez de ir a tirones. */
export const suavizar = (t: number): number => {
  const x = limitar(t);
  return x * x * (3 - 2 * x);
};

/** Regla de tres recortada: dónde cae `v` entre `a` y `b`. */
export const entre = (v: number, a: number, b: number): number =>
  b === a ? 0 : limitar((v - a) / (b - a));

/** Reparte 0..1 en `n` tramos iguales; devuelve cuál y cuánto lleva. */
export function tramo(p: number, n: number): { indice: number; dentro: number } {
  const escala = limitar(p) * n;
  const indice = Math.min(n - 1, Math.floor(escala));
  return { indice, dentro: limitar(escala - indice) };
}

export const sinMovimiento = (): boolean =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/*
  Un salto del menú son cuatro o cinco mil píxeles de scroll suave en medio
  segundo, y por el camino se cruzan las dos pistas enteras. El muestreo por
  cuadro las obedece: el reloj daba su vuelta completa y los tres momentos
  cruzaban de golpe, todo en ese medio segundo, y se llegaba al destino con
  las transiciones CSS a mitad de camino. Eso es lo que se veía «saltado».

  Mientras dura el viaje las pistas no se recalculan, y al parar se mide
  cada una exactamente una vez: se llega con la escena ya colocada, sin
  haberla visto correr. Quién congela y quién suelta está en salto.ts.
*/
let congeladas = false;
const medidores = new Set<() => void>();

export function congelarPistas(valor: boolean): void {
  if (congeladas === valor) return;
  congeladas = valor;
  if (!valor) for (const medir of medidores) medir();
}

/** El alto real de la escena pegada; si no hay, se supone una ventana. */
const altoEscena = (pista: HTMLElement): number => {
  const escena = pista.firstElementChild as HTMLElement | null;
  return escena?.offsetHeight || window.innerHeight;
};

/*
  El scroll no manda del todo sobre el reloj de la escena.

  Engancharlo uno a uno es lo correcto mientras se lee a velocidad de
  lectura, y deja de serlo en cuanto alguien tira del dedo o de la rueda:
  mil quinientos píxeles en cuatro cuadros son la historia entera en
  sesenta milisegundos, y lo que se ve no es una animación rápida sino un
  borrón. Los tres momentos de «Cómo funciona» entran, se plantan y salen
  sin que dé tiempo a distinguir ninguno de los tres.

  Con esto la escena tiene su propio paso, y hay dos maneras de que el
  scroll se le adelante:

  · Se le adelanta un poco. Entonces la escena avanza a `RITMO_MAX` como
    mucho, se queda atrás a propósito y sigue corriendo un momento después
    de que el scroll se pare, hasta alcanzarlo. Ese rezago es el que hace
    que un tirón corto se vea entero en vez de pasar de largo. Para que no
    crezca sin fin, pasado `SALTO` la escena acelera —`RECUPERA`— hasta
    ponerse a tiro otra vez.

  · Se le adelanta mucho. Perseguir un scroll que va al triple acaba
    enseñando la escena de un sitio donde ya no estás, y eso es peor que
    no animar: entre `RAPIDO_DESDE` y `RAPIDO_HASTA` la dosificación se
    va soltando, y por encima la escena aparece directamente donde toca.
    Si vas tan deprisa, es que no ibas a mirarla.

  Lo que decide cuál de las dos es la velocidad del scroll, y se mide
  suavizada —`TAU_VEL`— para que un cuadro suelto no cambie de modo: un
  salto de barra de desplazamiento no debe dejar la pista en modo rápido
  para el arrastre tranquilo que venga después.

  Las cifras van en avance de pista, no en píxeles, para que sigan
  valiendo aunque la pista cambie de alto: `RITMO_MAX` deja la historia
  completa en algo más de dos segundos, y `SALTO` es aproximadamente media
  ventana de rezago en las pistas de esta página.
*/
const RITMO_MAX = 0.45;
const SALTO = 0.12;
const RECUPERA = 6;
const RAPIDO_DESDE = 0.7;
const RAPIDO_HASTA = 1.4;
const TAU_VEL = 0.08;

/**
 * Sigue el avance de una pista y avisa cuando cambia.
 *
 * El recorrido útil no es el alto de la pista: la escena va pegada arriba
 * y ocupa lo suyo, así que el viaje empieza cuando el techo de la pista
 * llega al de la ventana y termina cuando el suelo de la escena alcanza el
 * de la pista. Se mide la escena en vez de dar por hecho que mide una
 * ventana justa, que en pantallas bajas no es verdad.
 */
export function seguirPista(
  pista: HTMLElement,
  alAvanzar: (p: number) => void
): () => void {
  // Con las animaciones desactivadas no hay nada que dosificar: la escena
  // va donde diga el scroll y punto.
  const amortigua = !sinMovimiento();

  let pedido = 0;
  /** Último avance entregado a la escena. */
  let ultimo = Number.NaN;
  /** El avance que está pintado, que no siempre es el que pide el scroll. */
  let mostrado = Number.NaN;
  /** El que pedía el scroll en el cuadro anterior, para sacar la velocidad. */
  let metaPrevia = Number.NaN;
  /** Velocidad del scroll suavizada, en avance de pista por segundo. */
  let velocidad = 0;
  let ultimoMs = 0;

  /** El avance que pide el scroll ahora mismo. */
  const objetivo = (): number => {
    const caja = pista.getBoundingClientRect();
    const recorrido = caja.height - altoEscena(pista);
    return recorrido <= 0 ? 0 : limitar(-caja.top / recorrido);
  };

  const entregar = (p: number): void => {
    // Medio milésimo de avance no mueve un píxel en pantalla; no vale la
    // pena repintar por él.
    if (Math.abs(p - ultimo) < 0.0005) return;
    ultimo = p;
    alAvanzar(p);
  };

  /** Sin perseguir a nadie: la escena se planta donde diga el scroll. */
  const colocar = (): void => {
    ultimoMs = 0;
    velocidad = 0;
    mostrado = objetivo();
    metaPrevia = mostrado;
    entregar(mostrado);
  };

  const cuadro = (ahora: number): void => {
    pedido = 0;
    if (congeladas) return;

    const meta = objetivo();

    if (!Number.isFinite(mostrado) || !amortigua) {
      mostrado = meta;
      metaPrevia = meta;
      entregar(mostrado);
      return;
    }

    // Un cuadro perdido —una pestaña en segundo plano, un repintado
    // pesado— no puede valer por medio segundo de avance: el tope de dt
    // convierte el parón en un cuadro normal en vez de en un tirón.
    const dt = ultimoMs ? Math.min(0.05, (ahora - ultimoMs) / 1000) : 0;
    ultimoMs = ahora;

    if (dt > 0) {
      const bruta = Math.abs(meta - metaPrevia) / dt;
      velocidad += (bruta - velocidad) * Math.min(1, dt / TAU_VEL);
    }
    metaPrevia = meta;

    const falta = meta - mostrado;
    const pendiente = Math.abs(falta);

    // Lo que se deja avanzar en este cuadro: el ritmo de siempre, más lo
    // que haga falta para recortar el rezago que ya pasó de `SALTO`.
    const tope = (RITMO_MAX + Math.max(0, pendiente - SALTO) * RECUPERA) * dt;
    // Y cuánto de ese tope se deja de aplicar porque el scroll va rápido:
    // 0 es dosificar del todo, 1 es ir donde diga el scroll sin más.
    const suelta = suavizar(entre(velocidad, RAPIDO_DESDE, RAPIDO_HASTA));
    const paso = tope + (pendiente - tope) * suelta;

    if (pendiente <= paso) mostrado = meta;
    else mostrado += Math.sign(falta) * paso;

    entregar(mostrado);
    if (mostrado !== meta) pedir();
  };

  const pedir = (): void => {
    if (pedido) return;
    pedido = requestAnimationFrame(cuadro);
  };

  window.addEventListener('scroll', pedir, { passive: true });
  window.addEventListener('resize', pedir);
  medidores.add(colocar);
  colocar();

  return () => {
    if (pedido) cancelAnimationFrame(pedido);
    window.removeEventListener('scroll', pedir);
    window.removeEventListener('resize', pedir);
    medidores.delete(colocar);
  };
}

/** El scroll que deja la pista en el avance `p`. Lo usa el riel del visor. */
export function scrollDePista(pista: HTMLElement, p: number): number {
  const caja = pista.getBoundingClientRect();
  const arriba = caja.top + window.scrollY;
  const recorrido = Math.max(0, caja.height - altoEscena(pista));
  return arriba + recorrido * limitar(p);
}
