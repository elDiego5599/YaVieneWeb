import { describe, expect, it } from 'vitest';

/*
  Las páginas enlazan sus hojas desde el <head> (`critico.css` y las demás).
  happy-dom no baja CSS, y por defecto cada <link> fallaba con un error en
  la consola de Vitest: ruido que tapa los avisos de verdad (AUD29-30).
  La configuración le dice que una hoja no bajada cuenta como cargada.
*/
describe('hojas de estilo en las pruebas', () => {
  it('un <link rel="stylesheet"> termina en load, no en error', async () => {
    const enlace = document.createElement('link');
    enlace.rel = 'stylesheet';
    enlace.href = '/src/css/critico.css';
    const evento = new Promise<string>((listo) => {
      enlace.addEventListener('load', () => listo('load'));
      enlace.addEventListener('error', () => listo('error'));
    });
    document.head.append(enlace);
    expect(await evento).toBe('load');
    enlace.remove();
  });
});
