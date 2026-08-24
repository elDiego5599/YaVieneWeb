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
