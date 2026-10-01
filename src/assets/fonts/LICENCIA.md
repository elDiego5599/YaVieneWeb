# Tipografías

Las dos familias que usa Ya Viene están publicadas bajo la
**SIL Open Font License 1.1**, que permite alojarlas en nuestro propio
servidor, redistribuirlas y usarlas con fines comerciales.

| Familia | Autoría | Origen |
| --- | --- | --- |
| Bricolage Grotesque | Mathieu Triay | https://fonts.google.com/specimen/Bricolage+Grotesque |
| Plus Jakarta Sans | Tokotype | https://fonts.google.com/specimen/Plus+Jakarta+Sans |

Los `.woff2` de esta carpeta salen del subconjunto `latin` de cada
familia, descargado sin modificar desde `fonts.gstatic.com` y guardado tal
cual en `scripts/fuentes-origen/`. `scripts/subconjunto_fuentes.py` les
quita los glifos que el español no usa; los que quedan no cambian (la OFL
permite subconjuntos). Son ficheros variables: un solo fichero cubre los
grosores 200 a 800.

Texto completo de la licencia: https://openfontlicense.org
