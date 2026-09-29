// @vitest-environment node
import { resolveConfig } from 'vite';
import { expect, it } from 'vitest';

/**
 * La vista previa (`vite preview`) sólo contesta a localhost.
 *
 * Vite corta con un 403 cualquier petición cuyo `Host` no conozca: es su
 * defensa contra el DNS rebinding. El repo la abría a `*.trycloudflare.com`
 * para demos por túneles de Cloudflare, que el proyecto ya no usa (ngrok es
 * el túnel, y `cloudflared` no se usa: regla 3 de CLAUDE.md). Un comodín
 * así deja entrar a cualquiera que monte un túnel con ese dominio
 * (auditoría, hallazgo 16). Si algún día hace falta un túnel, su host va
 * por la línea de órdenes o en una configuración local, no en el repo.
 */
it('la vista previa no abre hosts de fuera en la configuración del repo', async () => {
  const config = await resolveConfig({ configFile: 'vite.config.ts', logLevel: 'silent' }, 'serve', 'production', 'production', true);
  expect(config.preview.allowedHosts).toEqual([]);
});
