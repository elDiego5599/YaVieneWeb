/**
 * Que la escena quepa en la ventana, sí o sí.
 *
 * Las dos secciones que se recorren —el problema y la solución— llevan
 * una escena pegada arriba. Mientras quepa en la pantalla no hay
 * problema; en cuanto es más alta que la ventana, el pegado deja fuera
 * todo lo que sobra por abajo y ese trozo no se puede alcanzar de
 * ninguna forma: ni bajando ni subiendo. Pasa con el zoom del navegador
 * —que encoge la ventana en píxeles de CSS pero no el texto— y con
 * cualquier portátil de pantalla baja.
 *
 * La solución es la que tomaría cualquiera: si no cabe, se encoge hasta
 * que quepa. `zoom` sirve justo para eso y no es lo mismo que un
 * `transform: scale()` —vuelve a maquetar en pequeño, así que el texto
 * sigue siendo texto nítido y no una foto reducida—. Medir es una regla
 * de tres: lo que ocupa la escena en pantalla, deshecho el factor que ya
 * lleva puesto, contra el hueco que le deja la ventana.
 *
 * Todo lo que hay dentro hereda el factor en `--encaje`, y de ahí lo lee
 * el poco código que mezcla píxeles de pantalla con píxeles del elemento
 * —el dedo de la demo, el tamaño de los marcadores del mapa.
 */

/** Hasta dónde se deja encoger. Por debajo de esto ya no se lee. */
const MINIMO = 0.5;

/**
 * El factor de encogido que arrastra un elemento.
 *
 * `--encaje` se hereda, así que cualquier hijo de la escena lo puede
 * preguntar sin saber quién lo puso. Fuera de una escena no hay nada
 * puesto y la respuesta es 1.
 */
export function encajeDe(el: Element): number {
  const valor = Number.parseFloat(getComputedStyle(el).getPropertyValue('--encaje'));
  return Number.isFinite(valor) && valor > 0 ? valor : 1;
}

/** Mide la escena y le pone el factor. Devuelve cómo soltarla. */
export function encajarEscena(escena: HTMLElement): () => void {
  const dentro = escena.firstElementChild as HTMLElement | null;
  if (!dentro) return () => {};

  let pedido = 0;
  let ultimo = -1;

  const medir = (): void => {
    pedido = 0;
    const marco = getComputedStyle(escena);
    // Sin pegado no hay nada que encajar: es lo que pasa con movimiento
    // reducido, donde la sección se lee de arriba abajo y nada se corta.
    if (marco.position !== 'sticky') return;

    const puesto = ultimo > 0 ? ultimo : 1;
    // El alto natural se saca de lo que se ve dividido por el factor que
    // ya está puesto, no de `offsetHeight`. Los dos navegadores no cuentan
    // igual: Chrome deja `offsetHeight` sin tocar por el zoom y el WebKit
    // del iPhone lo devuelve ya encogido. Con el segundo, medir dos veces
    // daba 1 a la segunda, el factor se caía y el reloj volvía a salirse
    // por abajo —cortado en iPhone y en ningún otro sitio—. Lo que se ve
    // en pantalla, en cambio, lo dicen los dos igual.
    const natural = dentro.getBoundingClientRect().height / puesto;
    if (natural <= 0) return;

    // El alto libre no es la caja entera: arriba se reserva la franja de
    // la cabecera y abajo la de la barra de direcciones. Los dos son
    // relleno de la escena, así que se leen en píxeles de verdad y se
    // restan antes de dividir.
    const reserva =
      (Number.parseFloat(marco.paddingTop) || 0) +
      (Number.parseFloat(marco.paddingBottom) || 0);
    // Y se compara contra el alto que le dio el CSS, no contra
    // `window.innerHeight`: el CSS ya sabe de barras y el navegador no
    // siempre dice lo mismo. Si no lo resuelve, la ventana sirve.
    const declarado = Number.parseFloat(marco.minHeight);
    const pantalla =
      Number.isFinite(declarado) && declarado > 0 ? declarado : window.innerHeight;
    const libre = pantalla - reserva;
    if (libre <= 0) return;

    const k = Math.max(MINIMO, Math.min(1, libre / natural));
    // Zona muerta: media centésima de factor no mueve un píxel, y sin ella
    // el redondeo de una medida a otra podría dejarlo oscilando.
    if (Math.abs(k - puesto) < 0.005) return;
    ultimo = k;
    escena.style.setProperty('--encaje', k.toFixed(3));
  };

  const pedir = (): void => {
    if (pedido) return;
    pedido = requestAnimationFrame(medir);
  };

  window.addEventListener('resize', pedir);
  // Las fuentes cambian el alto del texto al llegar, y llegan tarde.
  void document.fonts?.ready.then(pedir);

  // Y no sólo las fuentes: la escena crece después de la primera medida
  // por todo lo que llega tarde —el mosaico del mapa, una imagen, un
  // bloque que se despliega—. Con una medida sola el factor se quedaba
  // corto y lo que había crecido se salía por abajo sin forma de
  // alcanzarlo: así se cortaba el reloj en un teléfono. El observador
  // vuelve a medir cada vez que cambia el alto. No se realimenta: la
  // medida se divide por el factor ya puesto, así que al aplicarlo el alto
  // natural que sale es el mismo y la zona muerta corta ahí.
  const vigia = new ResizeObserver(pedir);
  vigia.observe(dentro);
  medir();

  return () => {
    if (pedido) cancelAnimationFrame(pedido);
    vigia.disconnect();
    window.removeEventListener('resize', pedir);
  };
}
