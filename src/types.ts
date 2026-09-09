/**
 * Los tipos del material que muestra la landing.
 *
 * Todo esto sale de app_pasajero/assets/data/rutas.json a través de
 * scripts/gen_mapa_landing.py: aquí no se inventa ninguna ruta ni ningún
 * kilometraje, sólo se le pone nombre a la forma que ya tienen los datos.
 */

/** Una ruta real de Sobusa, proyectada sobre el mosaico. */
export interface RutaLanding {
  /** Identificador de rutas.json: R-101 … R-106. */
  id: string;
  nombre: string;
  terminalA: string;
  terminalB: string;
  /** Longitud del recorrido en kilómetros, medida sobre los waypoints. */
  km: number;
  /** Atributo `d` de la polilínea, en píxeles del mosaico. */
  d: string;
  /** Los dos extremos del recorrido, para dibujar las terminales. */
  extremos: Array<[number, number]>;
}

/** El mosaico de fondo: Barranquilla en CARTO Voyager, z13. */
export interface MapaBase {
  /** URL resuelta por el empaquetador. */
  src: string;
  ancho: number;
  alto: number;
  /** Atribución obligatoria por la licencia de OSM y CARTO. */
  atribucion: string;
}

export interface DatosLanding {
  /** `[x, y, ancho, alto]` en píxeles del mosaico. */
  viewBox: [number, number, number, number];
  mapa: MapaBase;
  rutas: RutaLanding[];
}

/** Un punto en el espacio de usuario del SVG. */
export interface Punto {
  x: number;
  y: number;
}
