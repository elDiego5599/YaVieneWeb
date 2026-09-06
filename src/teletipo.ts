import { YV_RUTAS } from './data/rutas-landing';

/*
  El teletipo que cierra el hero.

  Es la franja de una estación: las seis rutas conectadas pasando de largo,
  con su nombre, sus dos terminales y su kilometraje. Se escribe aquí y no
  a mano en el HTML porque los mismos números ya están escritos en dos
  sitios —la cabecera del mapa y la tabla de cobertura— y una tercera copia
  a mano es una tercera copia que se queda vieja. Estos salen de
  `rutas.json`, que es de donde salen los otros dos.

  La tira lleva el grupo de rutas dos veces seguidas. El bucle recorre la
  mitad del ancho y vuelve a cero, y como la segunda mitad es idéntica a la
  primera el salto cae en un fotograma que ya se estaba viendo: no hay
  costura. Cualquier otra forma de hacerlo —medir el ancho, reordenar los
  nodos al pasar— pide trabajo en cada cuadro y el hilo principal aquí está
  ocupado con la demo del teléfono.
*/

/** Coma decimal, que es como se escriben los números por aquí. */
const cifra = (n: number): string => String(n).replace('.', ',');

const grupo = (renglones: string[]): HTMLElement => {
  const caja = document.createElement('div');
  caja.className = 'hero-teletipo-grupo';
  for (const texto of renglones) {
    const pieza = document.createElement('span');
    pieza.className = 'hero-teletipo-pieza';
    pieza.textContent = texto;
    caja.append(pieza);
  }
  return caja;
};

export function encenderTeletipo(raiz: ParentNode = document): void {
  const caja = raiz.querySelector<HTMLElement>('[data-teletipo]');
  if (!caja) return;

  const renglones = YV_RUTAS.rutas.map(
    (r) => `${r.nombre} · ${r.terminalA} → ${r.terminalB} · ${cifra(r.km)} km`
  );
  if (renglones.length === 0) return;

  const pista = document.createElement('div');
  pista.className = 'hero-teletipo-pista';
  pista.append(grupo(renglones), grupo(renglones));
  caja.append(pista);
}
