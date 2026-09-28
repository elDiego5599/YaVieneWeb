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
      'Cada posición que manda el bus se revisa antes de mostrarse: ' +
        'si llega con la hora corrida, a una velocidad imposible o con un ' +
        'salto que ningún bus da, no aparece en el mapa.',
    );
    // La frase del GPS en el bus es regla del dueño y no se toca.
    expect(texto).toContain(
      'El GPS va montado en el bus, no en un teléfono: lo instalamos junto ' +
        'con tu flota y quedas conectado sin depender de que alguien ' +
        'recuerde abrir una app.',
    );
  });
});
