import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * La página de empresas la lee el gerente de una flota, no quien escribió
 * el backend. «Cada paquete de ubicación se verifica en servidor para
 * garantizar coherencia en tiempo, velocidad y trayecto» era la frase del
 * backend traducida palabra por palabra: dice que algo se revisa sin decir
 * qué se gana. Lo que de verdad hace `security/physics.ts` del backend
 * —hora del aparato adelantada o muy atrasada, velocidad por encima de
 * 120 km/h, un salto que ningún bus da, una posición fuera de la zona— se
 * cuenta con esas palabras.
 */
const JERGA = [
  'paquete de ubicación',
  'en servidor',
  'coherencia',
  'payload',
  'latencia',
  'websocket',
];

function textoPintado(nombre: string): string {
  const plantilla = document.createElement('template');
  plantilla.innerHTML = readFileSync(resolve(process.cwd(), nombre), 'utf8');
  plantilla.content.querySelectorAll('script, style').forEach((n) => n.remove());
  return (plantilla.content.textContent ?? '').replace(/\s+/g, ' ');
}

describe('las páginas hablan como el que las lee', () => {
  for (const pagina of ['index.html', 'empresas.html']) {
    it(`${pagina} no trae jerga del backend`, () => {
      const texto = textoPintado(pagina).toLowerCase();
      for (const palabra of JERGA) expect(texto).not.toContain(palabra);
    });
  }

  it('empresas cuenta qué se revisa de cada posición', () => {
    const texto = textoPintado('empresas.html');
    expect(texto).toContain(
      'Cada posición que envía el bus se verifica antes de mostrarse: ' +
        'si llega con la hora desfasada, a una velocidad imposible o con un ' +
        'salto que ningún bus puede dar, no aparece en el mapa.',
    );
    // La frase del GPS en el bus es regla del dueño: lo que dice no se
    // toca. Sólo cambió el trato, de tú a usted, con el resto de la página.
    expect(texto).toContain(
      'El GPS va montado en el bus, no en un teléfono: lo instalamos junto ' +
        'con su flota y usted queda conectado sin depender de que alguien ' +
        'recuerde abrir una aplicación.',
    );
  });

  /**
   * Empresas le habla de usted a un gerente (dueño, 2026-10-07); la
   * portada sigue tuteando al pasajero. Se mira lo que se lee y lo que se
   * oye o se ve sin leer la página: metadatos, `placeholder` y
   * `aria-label`. Quedan fuera el panel dibujado, que copia letra por
   * letra los textos de `app_control`, el lema de la marca en el pie y el
   * `alt` de la imagen social, que describe lo que pone la imagen.
   */
  it('empresas trata de usted', () => {
    const plantilla = document.createElement('template');
    plantilla.innerHTML = readFileSync(resolve(process.cwd(), 'empresas.html'), 'utf8');
    const raiz = plantilla.content;
    raiz.querySelectorAll('script, style, .footer-intro, meta[property="og:image:alt"]').forEach((n) => n.remove());
    const panel = raiz.querySelector('.despacho-pantalla')!;
    const etiquetaPanel = panel.getAttribute('aria-label') ?? '';
    panel.replaceChildren();
    const atributos = [...raiz.querySelectorAll('[content], [placeholder], [aria-label]')].map(
      (n) => `${n.getAttribute('content') ?? ''} ${n.getAttribute('placeholder') ?? ''} ${n.getAttribute('aria-label') ?? ''}`,
    );
    const texto = [raiz.textContent ?? '', etiquetaPanel, ...atributos].join(' ').replace(/\s+/g, ' ');
    const TUTEO =
      /(?<![\p{L}])(tú|tu|tus|te|ti|tienes|decides|quedas|autorizas|déjanos|escríbenos|mira|conecta|elige|filtra|ocúltalo|muéstralo|vuelve|dale)(?![\p{L}])/giu;
    expect(texto.match(TUTEO) ?? []).toEqual([]);
  });
});
