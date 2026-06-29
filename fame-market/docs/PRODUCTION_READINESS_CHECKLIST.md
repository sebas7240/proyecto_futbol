# Fame Plays Production Readiness

Checklist corto antes de promocionar fuerte.

## Jugada completa

- Iniciar sesion con Google.
- Aceptar reglas vigentes.
- Elegir una figura activa.
- Pulsar `Verificar y revisar apoyo` si Turnstile lo pide.
- Confirmar cotizacion antes de que venza.
- Verificar que la posicion aparezca en el equipo y que el ranking se refresque.

## Observabilidad

- `GET https://api.fameplays.com/api/health/ready` debe responder `200`.
- El panel `/admin` debe mostrar usuarios, backups, ciclos y errores frontend.
- Los errores de navegador se guardan en `client_error_reports`.
- El Monitor Worker externo debe consultar la API cada cinco minutos.

## Backups

- El job `database-backup` debe terminar en `success`.
- Cada backup debe tener `restoreVerified=true`.
- Si R2/S3 esta configurado, `offsiteUploaded=true`.
- La retencion local por defecto es de 14 dias.

## Chat

- `https://fame-plays-chat.sebas7240.workers.dev/health` debe responder `ok`.
- Moderacion en `/admin` debe listar sala, reportes y acciones.
- El secreto `CHAT_ADMIN_SECRET` debe coincidir entre Worker y backend.
- Las notas de voz deben mantenerse entre 1 y 10 segundos.

## Publicidad

- `https://www.fameplays.com/ads.txt` debe mostrar el publisher de Google.
- No colocar anuncios dentro del chat ni pegados a contenido reportable.
- Mantener visibles reglas, privacidad, metodologia, derechos y como jugar.
