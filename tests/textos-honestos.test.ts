import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Textos honestos (dueño, 2026-10-11): la app aún no está en las tiendas,
 * el cierre de la portada es para el pasajero y la portada responde lo que
 * pregunta quien llega: precio, cuenta, de dónde sale el bus, qué rutas,
 * cuándo sale la app y qué pasa con sus datos.
 */
function pagina(nombre: string): ParentNode {
  const plantilla = document.createElement('template');
  plantilla.innerHTML = readFileSync(resolve(process.cwd(), nombre), 'utf8');
  plantilla.content.querySelectorAll('script, link, style').forEach((n) => n.remove());
  return plantilla.content;
}
const texto = (el: Element | null | undefined) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

describe('portada', () => {
  const doc = pagina('index.html');

  it('el hero no dice «disponible en» mientras la app no esté publicada', () => {
    const hero = texto(doc.querySelector('.hero-subtext'));
    expect(hero).toMatch(/Pronto en\s*iOS\s*y\s*Android/);
    expect(hero).not.toMatch(/disponible/i);
    expect(doc.querySelectorAll('.hero-subtext .tienda-chip')).toHaveLength(2);
    expect(doc.querySelectorAll('.hero-subtext a')).toHaveLength(0);
  });

  it('el botón lleno del pie es para el pasajero y la flota va de segundo', () => {
    const [primero, segundo] = Array.from(doc.querySelectorAll('.footer-actions a'));
    expect(texto(primero)).toContain('Ver el mapa en vivo');
    expect(primero.getAttribute('href')).toBe('#mapa');
    expect(primero.classList.contains('btn-green')).toBe(true);
    expect(texto(segundo)).toContain('Conecta tu flota');
    expect(segundo.getAttribute('href')).toBe('/empresas.html');
    expect(segundo.classList.contains('btn-outline')).toBe(true);
  });

  it('el pie no exagera: dice qué rutas están en la app', () => {
    const cta = texto(doc.querySelector('.footer-cta > p'));
    expect(cta).not.toMatch(/convierte cada ruta/i);
    expect(cta).toContain('Sobusa y Coolitoral');
  });

  it('hay una FAQ con <details> antes del pie', () => {
    const faq = doc.querySelector('#preguntas')!;
    expect(faq).not.toBeNull();
    expect(faq.closest('main')).not.toBeNull();
    const preguntas = Array.from(faq.querySelectorAll('details > summary'), texto);
    expect(preguntas).toEqual([
      '¿Cuesta algo?',
      '¿Necesito una cuenta?',
      '¿De dónde sale la ubicación del bus?',
      '¿Qué rutas hay?',
      '¿Cuándo sale la app?',
      '¿Qué pasa con mis datos?',
    ]);
    expect(texto(faq.querySelectorAll('details')[1])).toContain('No');
    expect(texto(faq.querySelectorAll('details')[2])).toContain('GPS');
  });

  it('el bloque de confianza enlaza a la política de privacidad', () => {
    const caja = doc.querySelector('#preguntas .faq-confianza')!;
    const t = texto(caja);
    expect(t).toContain('Sin cuenta');
    expect(t).toContain('en tu teléfono');
    expect(t).toContain('No vendemos tus datos');
    expect(caja.querySelector('a[href="/privacidad.html"]')).not.toBeNull();
  });
});

describe('empresas', () => {
  it('hay un botón a #solicitar en la primera pantalla, visible en móvil', () => {
    const doc = pagina('empresas.html');
    const cta = doc.querySelector('#panel .seccion-cabecera a[href="#solicitar"]')!;
    expect(cta).not.toBeNull();
    expect(texto(cta)).toContain('Conecte su flota');
    expect(cta.classList.contains('btn-green')).toBe(true);
  });
});
