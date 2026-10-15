/**
 * Distancia por la ruta, no en línea recta: espejo de `RutaMedible` en
 * ya_viene_core/lib/core/geo/por_ruta.dart (los mismos umbrales y la misma
 * cuenta). Un bus a 400 m en línea recta puede tener 3 km de recorrido por
 * delante antes de pasar por donde espera la persona.
 *
 * Falta a propósito `SeguidorRuta` (proyectar el bus sobre la ruta): el bus
 * de la página es simulado y va sobre el trazo, así que su avance ya se
 * sabe y nunca queda a más de 60 m de la ruta.
 */

export type XY = readonly [number, number];

/** Inicio y fin a menos de esto, en metros: la ruta vuelve a empezar. */
const CIERRE_CIRCULAR = 50;
/** Un bus hasta 30 m pasado el punto sigue ahí: es el error del GPS. */
const RUIDO_ATRAS = 30;
/** Dos tramos a menos de esto en desvío son la misma calle (ida y vuelta). */
const EMPATE = 15;
/** Un punto más lejos de la ruta no espera ese bus en esa calle. */
const DESVIO_PUNTO_MAXIMO = 300;

export interface RutaMedible {
  readonly circular: boolean;
  readonly largo: number;
  /**
   * Los metros que le faltan al bus en `avanceBus` para pasar por `p`: los
   * de ruta hasta el próximo paso más el desvío del punto a la línea. Null
   * si `p` está a más de 300 m de la ruta o, en la abierta, si el bus ya
   * dejó atrás todos los pasos. Nunca dice «ya pasó»: en la circular se
   * cuenta hasta la vuelta siguiente.
   */
  medir(avanceBus: number, p: XY): number | null;
}

const dist = (ax: number, ay: number, bx: number, by: number): number => Math.hypot(ax - bx, ay - by);

/** Null si `puntos` no tiene un solo tramo con largo: eso es no saber. */
export function rutaMedible(puntos: readonly XY[]): RutaMedible | null {
  if (puntos.length < 2) return null;
  const x = puntos.map(p => p[0]);
  const y = puntos.map(p => p[1]);
  const cierre = dist(x[x.length - 1], y[y.length - 1], x[0], y[0]);
  const circular = cierre < CIERRE_CIRCULAR;
  // En la circular, el tramo del final al inicio también es ruta.
  if (circular && cierre > 0) {
    x.push(x[0]);
    y.push(y[0]);
  }
  const acum = [0];
  for (let i = 1; i < x.length; i += 1) acum.push(acum[i - 1] + dist(x[i], y[i], x[i - 1], y[i - 1]));
  const largo = acum[acum.length - 1];
  if (largo <= 0) return null;

  /** Metros hacia adelante de `desde` a `hasta`; null en la abierta si queda atrás. */
  const adelante = (desde: number, hasta: number): number | null => {
    const d = hasta - desde;
    if (circular) {
      const a = ((d % largo) + largo) % largo;
      return largo - a < RUIDO_ATRAS ? 0 : a;
    }
    if (d < 0) return d > -RUIDO_ATRAS ? 0 : null;
    return d;
  };

  /** Cada tramo con la proyección de (px, py) sobre él. */
  const proyecciones = (px: number, py: number): Array<{ avance: number; desvio: number }> => {
    const salida: Array<{ avance: number; desvio: number }> = [];
    for (let i = 0; i + 1 < x.length; i += 1) {
      const largoTramo = acum[i + 1] - acum[i];
      if (largoTramo === 0) continue;
      const dx = x[i + 1] - x[i];
      const dy = y[i + 1] - y[i];
      const t = Math.min(1, Math.max(0, ((px - x[i]) * dx + (py - y[i]) * dy) / (largoTramo * largoTramo)));
      salida.push({
        avance: acum[i] + t * largoTramo,
        desvio: dist(px, py, x[i] + t * dx, y[i] + t * dy),
      });
    }
    return salida;
  };

  /**
   * Cada paso de la ruta cerca de `p`: en una calle de ida y vuelta, el punto
   * cae en las dos. Pasos a menos de EMPATE del más cercano; los tramos
   * seguidos que caen en el mismo sitio (una esquina) son un paso.
   */
  const pasos = (px: number, py: number): Array<{ avance: number; desvio: number }> => {
    const todas = proyecciones(px, py);
    const mejor = Math.min(...todas.map(c => c.desvio));
    const cerca = todas.filter(c => c.desvio <= mejor + EMPATE).sort((a, b) => a.avance - b.avance);
    const mismoPaso = 2 * EMPATE;
    const lista: Array<{ avance: number; desvio: number }> = [];
    for (const c of cerca) {
      const ultimo = lista[lista.length - 1];
      if (ultimo && c.avance - ultimo.avance < mismoPaso) {
        if (c.desvio < ultimo.desvio) lista[lista.length - 1] = c;
      } else {
        lista.push(c);
      }
    }
    // En la circular, el último y el primero pueden ser el mismo paso.
    if (circular && lista.length > 1 && lista[0].avance + largo - lista[lista.length - 1].avance < mismoPaso) {
      const ultimo = lista.pop()!;
      if (ultimo.desvio < lista[0].desvio) lista[0] = ultimo;
    }
    return lista;
  };

  return {
    circular,
    largo,
    medir(avanceBus, p) {
      const todos = pasos(p[0], p[1]);
      if (todos[0].desvio > DESVIO_PUNTO_MAXIMO) return null;
      let faltan: number | null = null;
      for (const paso of todos) {
        const delante = adelante(avanceBus, paso.avance);
        if (delante === null) continue;
        const metros = delante + paso.desvio;
        if (faltan === null || metros < faltan) faltan = metros;
      }
      return faltan;
    },
  };
}
