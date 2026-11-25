# Ya Viene — landing

> **Note:** This project targets Barranquilla, Colombia, so its docs and earlier commit history are in Spanish. New commits are in English.

La página de [Ya Viene](https://github.com/elDiego5599/YaViene): el bus en
vivo en Barranquilla. Vite, TypeScript y CSS a mano. Sin framework de
interfaz y sin dependencias en producción — lo que se descarga es HTML,
CSS, JavaScript propio y cuatro tipografías alojadas aquí mismo.

## Arrancar

```bash
npm install
npm run dev
```

## Comandos

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo con recarga en caliente. |
| `npm run build` | Comprueba tipos y construye a `dist/`. |
| `npm run preview` | Sirve `dist/` tal cual lo verá la gente. |
| `npm run typecheck` | TypeScript sobre `src/` y, aparte, sobre las pruebas. |
| `npm test` | Pruebas de unidad (Vitest, entorno de navegador simulado). |
| `npm run test:e2e` | Abre las cuatro páginas en Chromium, móvil y escritorio. |
| `npm run presupuesto` | Falla si la build se pasa de los topes de peso. |
| `npm run mapa` | Regenera `src/data/rutas-landing.ts` desde los datos reales. |

Las cuatro últimas son las que corre la integración continua en cada
`push`. `npm run test:e2e` construye la página él solo antes de empezar.

## Antes de publicar

De `VITE_SITE_URL` salen la etiqueta canónica, las de Open Graph, los
datos estructurados, el `robots.txt` y el `sitemap.xml`. Si está vacía —o
si no está— las rutas quedan relativas y no se generan esos dos ficheros;
la build lo avisa por consola.

En Vercel la variable está puesta en el proyecto, así que lo publicado sí
lleva URL absoluta, `robots.txt` y `sitemap.xml`. Para trabajar en local,
`cp .env.example .env` y se deja vacía, o se rellena para ver cómo queda
lo que se comparte. Ese `.env` no viaja en el repositorio —sólo la
plantilla—: una clave escrita ahí por descuido no se va con un `push`, y
lo que Vercel tenga puesto le gana igual al fichero.

## Cabeceras

`vercel.json` es lo único que hay ahí: las cabeceras de seguridad que
Vercel manda con cada respuesta. La importante es la política de
contenido, y es estricta —`default-src 'none'` y todo lo demás a
`'self'`— porque la landing se lo puede permitir: no hay un solo
`<script>` ni `<style>` en línea, ni un `data:`, ni una petición a
terceros. Eso lo comprueba la prueba «no pide nada a servidores ajenos».

Si algún día hace falta traer algo de fuera —una fuente de Google, un
endpoint de formulario en `VITE_CONTACT_ENDPOINT`—, hay que añadir su
origen a la directiva que toque o el navegador lo bloqueará en
producción y en ningún otro sitio. Para que no pase en silencio, la
prueba «aguanta la política de contenido de producción» carga las cinco
páginas con la cabecera de `vercel.json` puesta encima y falla si el
navegador bloquea algo.

## Cómo está montado

```
index.html  privacidad.html  terminos.html  404.html
src/
  main.ts        la portada
  hoja.ts        las otras tres páginas
  css/
    fonts.css          las dos familias, servidas desde aquí
    variables.css      colores, tipos y medidas
    base.css  layout.css
    components.css     índice: importa src/css/componentes/*
    phone-simulator.css  animations.css
    accesibilidad.css  se carga la última, a propósito
  data/rutas-landing.ts  generado, no se edita a mano
e2e/           pruebas de navegador
scripts/       generador del mapa y presupuesto de peso
```

**El orden de carga del CSS es la cascada**, y hay reglas de secciones
distintas que se pisan a propósito. Antes de mover un `@import` de sitio
o de añadir una regla que «no se aplica», mira si más abajo hay otra con
la misma especificidad. Es el fallo que más veces ha aparecido aquí.

## Topes de peso

Están en `scripts/presupuesto.mjs` y salen de lo que pesa la build de hoy
más un margen. No están para que quepa lo que venga: están para que
engordar la página sea una decisión y no un descuido. Si hay que subir
uno, se sube y se explica en el commit.
