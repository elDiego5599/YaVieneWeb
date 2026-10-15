/**
 * El backend de Ya Viene, el mismo que usa la app (ngrok primario). Solo un
 * origen: la CSP de `vercel.json` lo abre en `connect-src` y
 * `tests/csp-contacto.test.ts` ata los dos. Si algún día se pasa al
 * respaldo de Fly, cambian juntos.
 */
export const BACKEND = 'https://occupy-shed-squatter.ngrok-free.dev';
