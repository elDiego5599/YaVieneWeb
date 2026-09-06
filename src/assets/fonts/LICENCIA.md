# Tipografías

Las tres familias que usa Ya Viene están publicadas bajo la
**SIL Open Font License 1.1**, que permite alojarlas en nuestro propio
servidor, redistribuirlas y usarlas con fines comerciales.

| Familia | Papel | Autoría | Origen |
| --- | --- | --- | --- |
| Bricolage Grotesque | Titulares | Mathieu Triay | https://fonts.google.com/specimen/Bricolage+Grotesque |
| Plus Jakarta Sans | Texto corrido | Tokotype | https://fonts.google.com/specimen/Plus+Jakarta+Sans |
| Geist Mono | Datos y rótulos | Vercel | https://fonts.google.com/specimen/Geist+Mono |

Los `.woff2` de Plus Jakarta Sans y Geist Mono son los subconjuntos
`latin` y `latin-ext` descargados sin modificar desde `fonts.gstatic.com`.

Los de Bricolage Grotesque sí están modificados, y conviene dejar dicho
cómo para poder rehacerlos. El fichero que sirve Google con los tres ejes
(`opsz`, `wght`, `wdth`) pesa 128 KB, porque cada eje multiplica los datos
de variación. Nosotros usamos esta familia sólo para titulares, así que se
fijó el tamaño óptico en 96 y se recortó el rango de grosores al que la
hoja de estilos pide de verdad:

```sh
fonttools varLib.instancer bricolage-grotesque-latin.woff2 \
  opsz=96 wght=400:800 -o bri.ttf
fonttools ttLib.woff2 compress bri.ttf -o bricolage-grotesque-latin.woff2
```

Quedan 72,8 KB con el eje de ancho completo (75% a 100%), frente a los
75,1 KB que pesaba antes el fichero de un solo ancho. La licencia permite
expresamente esta clase de modificación mientras no se use el nombre
reservado de la fuente para redistribuirla como otra distinta, cosa que
no hacemos: sigue llamándose Bricolage Grotesque y sigue siendo la de
Mathieu Triay.

Texto completo de la licencia: https://openfontlicense.org
