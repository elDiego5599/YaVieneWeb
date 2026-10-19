/**
 * El color de cada ruta, por su código: espejo de `coloresRuta` en
 * `app_pasajero/lib/core/utils/color_ruta.dart` (dueño, 2026-10-19). Va en
 * el trazo, las terminales y el bus del teléfono, como en la app.
 *
 * Ninguno es rojo, naranja ni ámbar: en la app el coral dice «sin
 * conexión» y el ámbar «cuidado». Los contrastes se miden en la app.
 */
export const coloresRuta: Readonly<Record<string, string>> = {
  B18: '#1E56A8', // azul de botón (--azul-boton)
  C11: '#047857', // esmeralda
  C12: '#7E22CE', // violeta
  C13: '#0F766E', // petróleo
  C14: '#BE185D', // frambuesa
  C16: '#4338CA', // índigo
  A1: '#0E7490', // cian
  A3: '#A21CAF', // fucsia
  A4: '#4D7C0F', // oliva
};

/** El color de la ruta llamada `nombre`: el código es su primera palabra,
 * una letra y hasta tres cifras (`codigoRuta` en `bus_labels.dart`). Sin
 * código, o con uno nuevo, va en el azul de botón. */
export function colorRuta(nombre: string): string {
  const primero = nombre.trim().split(/\s+/)[0] ?? '';
  const codigo = /^[A-Za-z]\d{1,3}$/.test(primero) ? primero.toUpperCase() : '';
  return coloresRuta[codigo] ?? coloresRuta.B18;
}
