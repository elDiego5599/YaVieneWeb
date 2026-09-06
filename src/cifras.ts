/**
 * La entrada `cuenta`: las cifras suben desde cero.
 *
 * Es la única de las cinco entradas que no puede ser CSS. Una animación
 * de CSS interpola propiedades, y el contenido de un elemento no es una
 * propiedad: para que un número pase de 0 a 326,8 hay que reescribir el
 * texto en cada cuadro.
 *
 * Lo que sí es CSS es que no baile: `font-variant-numeric: tabular-nums`
 * en `.entra-cuenta` obliga a que todos los dígitos midan lo mismo, así
 * que el número crece sin cambiar de anchura y sin empujar lo que tiene
 * al lado. Sin eso, contar hasta 326,8 mueve la línea entera doce veces.
 *
 * La cifra final está escrita en el HTML, no aquí. Sin guion se lee el
 * dato correcto; con guion, lo mismo pero contando.
 */

/** Cómo se escribe un número en la página: coma decimal y punto de millar. */
const formato = (valor: number, decimales: number): string =>
  valor.toLocaleString('es-CO', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  });

/**
 * Leer el destino del propio texto del elemento.
 *
 * Así no hay que repetir la cifra en un atributo y arriesgarse a que las
 * dos versiones se separen: la que manda es la que se ve. Se admite el
 * formato de la página —`326,8`, `1.240`— y se conserva lo que envuelva
 * al número, que suele ser una unidad: `56,9 km` cuenta el número y deja
 * el «km» quieto.
 */
const leer = (el: HTMLElement): { destino: number; decimales: number; antes: string; despues: string } | null => {
  const texto = el.textContent ?? '';
  const encontrado = texto.match(/-?\d{1,3}(?:\.\d{3})*(?:,\d+)?|-?\d+(?:,\d+)?/);
  if (!encontrado) return null;

  const crudo = encontrado[0];
  const destino = Number(crudo.replace(/\./g, '').replace(',', '.'));
  if (!Number.isFinite(destino)) return null;

  const coma = crudo.indexOf(',');
  return {
    destino,
    decimales: coma === -1 ? 0 : crudo.length - coma - 1,
    antes: texto.slice(0, encontrado.index),
    despues: texto.slice((encontrado.index ?? 0) + crudo.length),
  };
};

const contar = (el: HTMLElement): void => {
  const dato = leer(el);
  if (!dato) return;

  const escribir = (valor: number): void => {
    el.textContent = `${dato.antes}${formato(valor, dato.decimales)}${dato.despues}`;
  };

  const arranque = performance.now();
  const duracion = 900;

  const paso = (ahora: number): void => {
    const avance = Math.min(1, (ahora - arranque) / duracion);
    // La misma curva que --salida: sale disparada y frena larguísimo.
    escribir(dato.destino * (1 - Math.pow(1 - avance, 3)));
    if (avance < 1) requestAnimationFrame(paso);
    else escribir(dato.destino);
  };

  requestAnimationFrame(paso);
};

/**
 * Poner a contar lo que lleve `.entra-cuenta`, una sola vez cada uno.
 *
 * Con el movimiento desactivado no se toca nada: la cifra ya está
 * escrita y contar es exactamente el tipo de adorno que se pidió apagar.
 */
export function encenderCifras(raiz: ParentNode = document): void {
  const cifras = Array.from(raiz.querySelectorAll<HTMLElement>('.entra-cuenta'));
  if (cifras.length === 0) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!('IntersectionObserver' in window)) return;

  const ojo = new IntersectionObserver(
    (entradas, observador) => {
      for (const entrada of entradas) {
        if (!entrada.isIntersecting) continue;
        observador.unobserve(entrada.target);
        contar(entrada.target as HTMLElement);
      }
    },
    { threshold: 0.4 }
  );

  for (const cifra of cifras) ojo.observe(cifra);
}
