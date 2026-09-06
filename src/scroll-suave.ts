/**
 * El scroll suave, encendido cuando la página ya está montada.
 *
 * Mientras se monta, el alto del documento todavía cambia, y el navegador
 * puede tener que corregir la posición que restauró al recargar: sin esta
 * espera esa corrección se veía como un viaje al fondo y una subida de un
 * segundo entero. El porqué largo está en base.css, junto a la regla.
 *
 * Vive aquí y no dentro de main.ts porque las páginas con anclas propias
 * —la portada y la de empresas— lo necesitan igual, y dos copias de esto
 * es una copia que se queda atrás el día que la regla cambie.
 *
 * El plan del rediseño dejaba esta pieza en revisión, porque el scroll
 * suave es lo primero que hace que una página se sienta pegajosa en un
 * teléfono y porque pelea con las animaciones guiadas por scroll. Revisado:
 * se queda. Lo que estorba es el scroll suave *por JavaScript* —Lenis y
 * compañía—, que secuestra la rueda, interpola la posición cuadro a cuadro
 * y deja a las líneas de tiempo nativas leyendo un desplazamiento que va
 * por detrás del real. Esto no es eso: es `scroll-behavior: smooth`, una
 * línea de CSS que sólo afecta a los saltos programados —pulsar un enlace
 * del menú— y no toca el scroll del dedo ni el de la rueda. Las
 * `animation-timeline` nativas y esta regla conviven sin rozarse.
 */
export function encenderScrollSuave(): void {
  const encender = (): void => {
    requestAnimationFrame(() => {
      document.documentElement.classList.add('scroll-suave');
    });
  };

  if (document.readyState === 'complete') encender();
  else window.addEventListener('load', encender, { once: true });
}
