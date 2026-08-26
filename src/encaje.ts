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
 * sigue siendo texto nítido y no una foto reducida—, y como el zoom no
 * toca `offsetHeight` ni las unidades de ventana, medir es una resta:
 * lo que mide la escena contra lo que mide la ventana, sin bucles.
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
    // `offsetHeight` no cuenta el zoom: es el alto que tendría la escena
    // si nadie la hubiera encogido, que es justo con lo que hay que
    // comparar. Por eso esto no se realimenta.
    const natural = dentro.offsetHeight;
    if (natural <= 0) return;
    // El alto libre no es la ventana entera: la escena le reserva arriba
    // la franja de la cabecera, que va flotando toda la página. Ese
    // relleno está en la escena, no en lo que se encoge, así que se lee
    // en píxeles de verdad y se resta antes de dividir.
    const marco = getComputedStyle(escena);
    const reserva =
      (Number.parseFloat(marco.paddingTop) || 0) +
      (Number.parseFloat(marco.paddingBottom) || 0);
    const libre = window.innerHeight - reserva;
    if (libre <= 0) return;
    const k = Math.max(MINIMO, Math.min(1, Math.round((libre / natural) * 1000) / 1000));
    if (k === ultimo) return;
    ultimo = k;
    escena.style.setProperty('--encaje', String(k));
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
  // vuelve a medir cada vez que cambia el alto. No se realimenta:
  // `offsetHeight` ignora el zoom, así que al cambiarlo el número que se
  // mide es el mismo y `ultimo` corta ahí.
  const vigia = new ResizeObserver(pedir);
  vigia.observe(dentro);
  medir();

  return () => {
    if (pedido) cancelAnimationFrame(pedido);
    vigia.disconnect();
    window.removeEventListener('resize', pedir);
  };
}
