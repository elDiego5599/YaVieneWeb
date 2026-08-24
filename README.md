# Ya Viene — landing

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

`VITE_SITE_URL` está **vacía** en `.env`. De esa única variable salen la
etiqueta canónica, las de Open Graph, los datos estructurados, el
`robots.txt` y el `sitemap.xml`. Mientras siga vacía, las rutas quedan
relativas y no se generan los dos ficheros — la build lo avisa por
consola. El día que haya dominio se rellena esa línea y ya.

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
