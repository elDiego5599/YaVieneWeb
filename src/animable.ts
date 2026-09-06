/**
 * La marca que dice que el guion está vivo.
 *
 * Las apariciones de la página —lo que entra al bajar con `.reveal`, y la
 * escena del hero con `.escena-entra`— empezaban escondidas en el CSS y
 * sólo se destapaban cuando `IntersectionObserver` las tocaba. Eso deja la
 * página entera dependiendo de que el JavaScript llegue: si el archivo se
 * cae, si el navegador lo bloquea o si tarda de más, lo que se ve es una
 * hoja en blanco con el fondo puesto y nada encima.
 *
 * Así que la lógica va al revés. El contenido nace visible, y el estado de
 * partida escondido sólo existe si esta clase está en el documento. Nadie
 * la pone más que este archivo, y este archivo sólo corre si el guion se
 * ha cargado: sin guion no hay clase, sin clase no hay nada escondido, y
 * la página se lee entera aunque no se anime.
 *
 * Se llama lo primero de todo, antes de esperar a `DOMContentLoaded`. El
 * módulo va aplazado, así que corre con el HTML ya analizado y antes de
 * que el navegador pinte el primer fotograma; poner la clase más tarde
 * —dentro del arranque, después de montar el mapa— sí se vería, como un
 * parpadeo de lo que ya estaba puesto y se esconde para volver a entrar.
 */
export function marcarAnimable(): void {
  document.documentElement.classList.add('animable');
}
