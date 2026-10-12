/**
 * Los hilos del escenario de «Qué resuelve», en cuentas puras.
 *
 * Se dibujan con las cajas de verdad y no sobre un lienzo fijo: un trazo
 * de fondo estirado al ancho no toca nada, y lo que se cuenta aquí es que
 * las piezas están unidas. A ciegas, cada hilo sale del canto de una pieza
 * y entra en el de otra (el enredo); con Ya Viene, el árbol de incident.io:
 * un tronco que baja de la píldora, un bus y una bajada al centro de cada
 * aviso. Todo en tramos rectos con los codos redondeados.
 *
 * Aquí no se mide nada: `problema.ts` lee las cajas y pinta los `d`.
 */

export type Punto = [x: number, y: number];
export type Caja = { x: number; y: number; w: number; h: number };
type Lado = 'izq' | 'der' | 'arriba' | 'abajo';
/** Una pieza (0 es la píldora, 1–4 los avisos), su canto y dónde de él, de 0 a 1. */
type Ancla = [pieza: number, lado: Lado, donde: number];

/** El radio de los codos: 24 en el lienzo de 2400 de incident.io, unos 12 en pantalla. */
const RADIO = 12;

/** Lo que entra cada hilo en su pieza: se ve enchufado, no a ras del canto. */
const DENTRO = 4;

/** Lo que baja el árbol de la píldora a los avisos; el bus va a la mitad. */
const BAJADA = 104;

/**
 * El enredo, de la píldora hacia fuera: cada hilo empieza en la pieza más
 * cerca de ella, que es hacia donde se recoge al ordenarse. Va con el
 * reparto de `problema.css` (las cuatro esquinas, la píldora al medio):
 * los cuatro avisos cuelgan de la píldora y tres hilos los cruzan entre
 * ellos, que es lo que hace que se lea como maraña y no como estrella.
 */
const ENREDO: [Ancla, Ancla][] = [
  [[0, 'izq', 0.5], [1, 'abajo', 0.7]],
  [[0, 'der', 0.5], [4, 'izq', 0.4]],
  [[0, 'arriba', 0.36], [2, 'izq', 0.55]],
  [[0, 'abajo', 0.4], [3, 'arriba', 0.62]],
  [[1, 'abajo', 0.3], [3, 'izq', 0.5]],
  [[2, 'der', 0.5], [4, 'arriba', 0.62]],
  [[3, 'der', 0.65], [4, 'izq', 0.8]],
];

const r1 = (n: number): number => Math.round(n * 10) / 10;

/**
 * Un camino de tramos rectos con cada codo redondeado por un arco. Un
 * tramo corto encoge el radio a su mitad —la otra mitad es del codo de
 * enfrente— y tres puntos en línea no hacen codo.
 */
export function rutaOrtogonal(puntos: Punto[], radio: number): string {
  const [x0, y0] = puntos[0];
  let d = `M${r1(x0)} ${r1(y0)}`;
  for (let i = 1; i < puntos.length; i += 1) {
    const [ax, ay] = puntos[i - 1];
    const [px, py] = puntos[i];
    const siguiente = puntos[i + 1];
    const antes = Math.hypot(px - ax, py - ay);
    const luego = siguiente ? Math.hypot(siguiente[0] - px, siguiente[1] - py) : 0;
    // El giro: positivo es a derechas en pantalla (la y crece hacia abajo).
    const giro = siguiente ? (px - ax) * (siguiente[1] - py) - (py - ay) * (siguiente[0] - px) : 0;
    const r = Math.min(radio, antes / 2, luego / 2);
    if (!siguiente || giro === 0 || r === 0) {
      d += `L${r1(px)} ${r1(py)}`;
      continue;
    }
    const [bx, by] = siguiente;
    d +=
      `L${r1(px - ((px - ax) / antes) * r)} ${r1(py - ((py - ay) / antes) * r)}` +
      `A${r1(r)} ${r1(r)} 0 0 ${giro > 0 ? 1 : 0} ` +
      `${r1(px + ((bx - px) / luego) * r)} ${r1(py + ((by - py) / luego) * r)}`;
  }
  return d;
}

/** El punto de un canto, metido `DENTRO` en la pieza. */
function ancla(c: Caja, lado: Lado, donde: number): Punto {
  if (lado === 'izq') return [c.x + DENTRO, c.y + donde * c.h];
  if (lado === 'der') return [c.x + c.w - DENTRO, c.y + donde * c.h];
  if (lado === 'arriba') return [c.x + donde * c.w, c.y + DENTRO];
  return [c.x + donde * c.w, c.y + c.h - DENTRO];
}

/**
 * De un canto a otro: sale perpendicular a su canto y entra perpendicular
 * al suyo. Uno de lado y otro de arriba o abajo es una L; los dos iguales,
 * una Z con el quiebro a la mitad.
 */
function unir([a, ladoA]: [Punto, Lado], [b, ladoB]: [Punto, Lado]): Punto[] {
  const tumbadoA = ladoA === 'izq' || ladoA === 'der';
  const tumbadoB = ladoB === 'izq' || ladoB === 'der';
  if (tumbadoA && !tumbadoB) return [a, [b[0], a[1]], b];
  if (!tumbadoA && tumbadoB) return [a, [a[0], b[1]], b];
  if (tumbadoA) {
    const m = (a[0] + b[0]) / 2;
    return [a, [m, a[1]], [m, b[1]], b];
  }
  const m = (a[1] + b[1]) / 2;
  return [a, [a[0], m], [b[0], m], b];
}

/**
 * Las dos caras del escenario a partir de cómo está a ciegas: la píldora
 * y los avisos donde los deja el CSS. Devuelve dónde van con Ya Viene
 * (la píldora arriba y los avisos en fila, todo centrado en el alto) y
 * los `d` de los dos juegos de hilos.
 */
export function trazar(
  escena: { ancho: number; alto: number },
  pildora: Caja,
  tarjetas: Caja[]
): { pildoraClara: Caja; fila: Caja[]; arbol: string[]; enredo: string[] } {
  const alto = Math.max(...tarjetas.map((t) => t.h));
  const arriba = Math.round((escena.alto - (pildora.h + BAJADA + alto)) / 2);
  const pildoraClara = { ...pildora, y: arriba };
  const paso = (escena.ancho - tarjetas[0].w) / (tarjetas.length - 1);
  const fila = tarjetas.map((t, i) => ({ ...t, x: r1(i * paso), y: arriba + pildora.h + BAJADA }));

  const raiz: [Punto, Lado] = [ancla(pildoraClara, 'abajo', 0.5), 'abajo'];
  const arbol = fila.map((t) =>
    rutaOrtogonal(unir(raiz, [ancla(t, 'arriba', 0.5), 'arriba']), RADIO)
  );

  const piezas = [pildora, ...tarjetas];
  const enredo = ENREDO.map(([[pa, la, da], [pb, lb, db]]) =>
    rutaOrtogonal(unir([ancla(piezas[pa], la, da), la], [ancla(piezas[pb], lb, db), lb]), RADIO)
  );

  return { pildoraClara, fila, arbol, enredo };
}
