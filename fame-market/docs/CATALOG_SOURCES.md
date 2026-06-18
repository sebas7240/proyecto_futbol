# Catalogo inicial y fuentes

Estado: implementado como migracion `013_mixed_public_figures_catalog.sql`.

Validacion tecnica: las fuentes Wikimedia listadas abajo respondieron con HTTP
200 al endpoint publico de Pageviews durante la verificacion del 2026-06-18
UTC. Esto confirma disponibilidad tecnica de datos agregados, no autorizacion
de marca, imagen o afiliacion.

Politica de imagen: todas las figuras se publican sin imagen personal mientras
no exista licencia, permiso o fuente autorizada registrada en administracion.

## Figuras iniciales

| Figura | Categoria | Subcategoria | Fuente de atencion |
| --- | --- | --- | --- |
| Karol G | musica | urbano-latino | es.wikipedia.org:Karol_G |
| Bad Bunny | musica | trap-latino | es.wikipedia.org:Bad_Bunny |
| Shakira | musica | pop-latino | es.wikipedia.org:Shakira |
| Feid | musica | urbano-latino | en.wikipedia.org:Feid |
| J Balvin | musica | urbano-latino | en.wikipedia.org:J_Balvin |
| Rauw Alejandro | musica | urbano-latino | en.wikipedia.org:Rauw_Alejandro |
| Peso Pluma | musica | regional-mexicano | en.wikipedia.org:Peso_Pluma |
| Anitta | musica | pop-global | en.wikipedia.org:Anitta_(singer) |
| Dua Lipa | musica | pop-global | en.wikipedia.org:Dua_Lipa |
| Taylor Swift | musica | pop-global | en.wikipedia.org:Taylor_Swift |
| Drake | musica | hip-hop | en.wikipedia.org:Drake_(musician) |
| MrBeast | creadores | youtube-global | en.wikipedia.org:MrBeast |
| Ibai Llanos | creadores | streaming | en.wikipedia.org:Ibai_Llanos |
| AuronPlay | creadores | streaming | en.wikipedia.org:AuronPlay |
| TheGrefg | creadores | gaming | en.wikipedia.org:TheGrefg |
| Luisito Comunica | creadores | viajes | en.wikipedia.org:Luisito_Comunica |
| El Rubius | creadores | gaming | en.wikipedia.org:El_Rubius |
| Zendaya | cine-tv | actuacion | en.wikipedia.org:Zendaya |
| Pedro Pascal | cine-tv | actuacion | en.wikipedia.org:Pedro_Pascal |
| Jenna Ortega | cine-tv | actuacion | en.wikipedia.org:Jenna_Ortega |
| Salma Hayek | cine-tv | actuacion | en.wikipedia.org:Salma_Hayek |
| Dwayne Johnson | cine-tv | actuacion | en.wikipedia.org:Dwayne_Johnson |
| Selena Gomez | cine-tv | musica-actuacion | en.wikipedia.org:Selena_Gomez |
| Lionel Messi | deportes | futbol | en.wikipedia.org:Lionel_Messi |
| Cristiano Ronaldo | deportes | futbol | en.wikipedia.org:Cristiano_Ronaldo |
| Neymar | deportes | futbol | en.wikipedia.org:Neymar |
| LeBron James | deportes | baloncesto | en.wikipedia.org:LeBron_James |
| Carlos Alcaraz | deportes | tenis | en.wikipedia.org:Carlos_Alcaraz |
| Simone Biles | deportes | gimnasia | en.wikipedia.org:Simone_Biles |

## Reglas de mantenimiento

1. Una figura nueva debe tener al menos una fuente publica agregada y
   verificable antes de quedar activa.
2. Si la fuente falla mas de 48 horas, la senal externa queda en espera y no
   puede aplicarse a precio.
3. Los nombres se usan de forma informativa dentro de un juego ficticio; no se
   debe insinuar afiliacion, patrocinio ni aprobacion.
4. Cualquier imagen real requiere revision en `/admin` con URL de fuente,
   licencia, atribucion y nota interna.
5. YouTube puede mostrarse como contenido oficial cuando se registre un canal,
   pero sus metricas derivadas no mueven precio sin aprobacion escrita.
