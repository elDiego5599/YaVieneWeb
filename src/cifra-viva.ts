/**
 * Espejo de `cifra_viva.dart`: la distancia de la hoja gira solo en las
 * cifras que cambian, con una estela vertical. Si el bus se acerca, lo
 * nuevo entra desde arriba (`cifra-baja`); si se aleja, desde abajo. Las
 * cifras se casan por la derecha —unidades con unidades—, así «1,0» →
 * «990» mueve las dos primeras y deja quieto el cero.
 *
 * De palabra a número no hay cifras que casar y cambia en seco. Con
 * movimiento reducido el CSS quita la animación y queda el cambio en seco.
 */
const NUMERO = /^[\d.,]+$/;

export function cifraViva(el: HTMLElement, texto: string, valor: number): void {
  const antes = el.textContent ?? '';
  const previo = Number(el.dataset.valor);
  el.dataset.valor = String(valor);
  if (antes === texto) return;
  if (!NUMERO.test(antes) || !NUMERO.test(texto)) {
    el.textContent = texto;
    return;
  }
  const clase = valor < previo ? 'cifra-baja' : 'cifra-sube';
  const corrimiento = antes.length - texto.length;
  el.replaceChildren(
    ...Array.from(texto, (cifra, i) => {
      const span = document.createElement('span');
      span.textContent = cifra;
      if (cifra !== antes[i + corrimiento]) span.className = clase;
      return span;
    })
  );
}

/**
 * `_metricParts` de eta_bottom_sheet.dart: la cifra grande y su unidad.
 * Bajo el kilómetro en metros; por encima en kilómetros con un decimal y
 * coma, como la escribe la app.
 */
export function metrica(metros: number): [string, string] {
  if (metros < 1000) return [String(Math.round(metros)), 'm de ti'];
  return [(metros / 1000).toFixed(1).replace('.', ','), 'km de ti'];
}
