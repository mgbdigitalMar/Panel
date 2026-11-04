# Sistema de notificaciones

Funciona sin ningún ordenador encendido, Docker ni servidor propio: Supabase guarda, procesa y recupera; Expo entrega en Android; Web Push entrega en navegadores y en la PWA de iPhone; Vercel solo aloja la web.

## Cómo funciona

```
Acción en Margube (solicitud, reserva, noticia...)
  └─ trigger de negocio → notif_private.emit()            ┐
       ├─ fila en public.notifications                    │ misma
       ├─ trabajo en la cola notification_jobs (pgmq)     │ transacción
       ├─ Broadcast al canal user:<id>:notifications      │
       └─ net.http_post al worker (sale tras el commit)   ┘
                   │
                   ▼
Edge Function notifications-worker  (también la despierta pg_cron)
  lee trabajos → crea una entrega por dispositivo → Expo / Web Push
  → registra el resultado → archiva el trabajo o lo esconde hasta el próximo reintento
```

- **El aviso inmediato es equivalente a un Database Webhook.** Usa el mismo mecanismo (`pg_net` en un trigger), pero lee el secreto de Vault; el webhook del panel lo dejaría escrito en la definición del trigger.
- **pg_cron es la red de seguridad**, no el motor. Cada minuto (`notifications-recovery`) libera entregas bloqueadas, recrea trabajos perdidos, evalúa alertas y despierta al worker solo si hay algo pendiente. Sin trabajo no gasta invocaciones.
- **Las reglas están solo en la base de datos.** La web y la app ya no pueden insertar en `notifications`.

### Límites que condicionan el diseño

| Límite | Valor | Respuesta |
|---|---|---|
| Duración de una Edge Function | 150 s (Free), 400 s (de pago) | El worker para a los 90 s; lo demás sigue en la cola |
| CPU por petición | 2 s | Lotes de 20 trabajos, 4 a la vez |
| Espera de `pg_net` | 5 s | El worker responde 202 y sigue en segundo plano |
| Expo | 100 mensajes por petición, 1000 recibos | Se trocea |
| Recibos de Expo | Se borran a las 24 h | Se piden a los 15 min y se dan por caducados a las 23 h |

En el plan **Free**, Supabase pausa los proyectos inactivos, y una base pausada no ejecuta cron ni recibe avisos. Con uso diario no debería ocurrir, pero conviene confirmar el plan del proyecto: no se ha podido consultar desde el repositorio.

## Qué genera cada aviso

Todo sale de relaciones reales de Margube. Nadie recibe aviso de su propia acción.

| Módulo | Evento | Destinatario |
|---|---|---|
| Solicitudes (remoto, externo, compra) | Nueva | Administradores |
| | Aprobada / rechazada | Solicitante |
| | Vuelta a la oficina (manual) | Administradores, máximo uno al día por modo |
| Asuntos propios | Nueva; aprobada / rechazada | Administradores; solicitante |
| Bolsa de horas | Nueva (solo `bolsa`); aprobada / rechazada | Administradores; empleado |
| Reservas | Nueva | Administradores |
| | Confirmada / cancelada | Dueño |
| | Borrada antes de su fecha (por un admin, o al borrar la sala) | Dueño |
| | Borrada antes de su fecha por su dueño | Administradores |
| Noticias y eventos | Publicación (no al editar) | Toda la plantilla menos el autor |
| Documentos | Enviado a una persona | Destinatario |
| Sistema | Alerta del propio sistema | Administradores |

**No se han conectado porque no existen en Margube:**

- **Actividades:** no hay tabla (la API de producción responde que `public.activities` no existe), ni pantalla, ni código.
- **Solicitudes, "responsable" y "cierre":** una solicitud solo tiene `pending`, `approved` y `rejected`, y la revisa cualquier administrador.

### Añadir un módulo nuevo

1. Una migración con un trigger `AFTER` que llame a `notif_private.emit(destinatarios, categoría, título, cuerpo, tipo, entity_type, entity_id, clave_única)`.
2. La categoría en el `check` de `notification_preferences` y en `NOTIFICATION_CATEGORIES` (`shared/services/notifications.js`).
3. La ruta en `notif_private.web_path()`, `ENTITY_NAV_MAP` y `mobile/src/navigation/notificationTarget.js`.

## Estados: qué significa cada cosa

No se promete entrega exacta una vez. Se minimizan las repeticiones: una clave única por evento, una entrega por dispositivo y la misma etiqueta en el aviso, que sustituye al anterior en vez de sumarse.

| Dónde | Estado | Significado |
|---|---|---|
| `notifications.dispatch_status` | `processed` | **Trabajo procesado**, no entrega |
| | `skipped_preference`, `no_devices` | Sin nada que enviar |
| | `dead_letter` | En la cola de errores |
| `deliveries.status` | `provider_accepted` | **Expo** (o el servicio Web Push) aceptó la petición |
| | `provider_confirmed` | El recibo de Expo dice que **FCM** aceptó el envío |
| | `retry` | Se reintentará: 30 s, 1, 2, 4 min... hasta 1 h, 12 intentos |
| | `invalid_device` | Token o suscripción muerta, ya desactivada |
| | `failed` | Error permanente o reintentos agotados |
| `deliveries.device_confirmed_at` | fecha | **Llegó al dispositivo.** Lo confirma el service worker al recibirlo, y la app con el aviso en primer plano o al pulsarlo. Con la app Android cerrada y sin pulsar no se puede saber |

Un trabajo agotado pasa a `notification_jobs_dlq` y recibe una segunda oportunidad automática durante 24 h. A mano: `select notif_private.requeue_dead_letters(true);`

## Privacidad

Todos los push dicen lo mismo: **Margube** / *Tienes una nueva notificación.* El payload solo lleva identificadores y la ruta del módulo. El detalle se lee dentro, con sesión, y Broadcast solo llega a su dueño por la política de `realtime.messages`.

Esto sustituye a la decisión de octubre de 2026 de enviar el texto real en el push.

## Supervisión

- **En la web:** Ajustes → Notificaciones, solo para administradores.
- **SQL:** `select public.notification_system_health();` (cola, bloqueados, cola de errores, entregas, reintentos, recibos, dispositivos, última ejecución, alertas y errores recientes).
- **Registro:** `notif_private.ops_log`.
- **Alertas:** llegan a la bandeja de los administradores al abrirse y una vez al día mientras sigan abiertas, y se cierran solas. Cubren: secretos ausentes, cola detenida, worker sin actividad, cola de errores, muchos fallos, credenciales rechazadas y avisos que no se pudieron crear.

Si **todo** Supabase cayera, nada dentro de Supabase podría avisar: para eso haría falta un monitor externo, como un comprobador de disponibilidad.

## Despliegue

**Requiere al propietario del proyecto**, porque hacen falta sus credenciales:

```bash
npx supabase login
npx supabase link --project-ref exaggikhxozcfsifwxeq
node scripts/deploy-notifications.mjs
```

El script comprueba el esquema, aplica la migración, configura los secretos (Edge Functions y Vault), despliega el worker y verifica que responde. Se puede repetir.

**El orden importa: primero la base de datos, luego la web.** Con la migración aplicada, la web y el APK actuales siguen funcionando: su inserción de avisos se rechaza sin romper nada y es la base de datos la que los crea. La web nueva, en cambio, necesita la migración.

**Las migraciones antiguas** se ejecutaron a mano en el SQL Editor. Si no constan en el historial, un `supabase db push` directo las repetiría, y alguna reescribe cuentas de `auth.users`. El script las marca como aplicadas tras comprobar el esquema. **No uses `db push` a mano la primera vez.**

### Pasos que solo puede hacer el propietario

| Paso | Dónde | Notas |
|---|---|---|
| Sesión de Supabase y contraseña de la base de datos | CLI | La pide el script |
| `VITE_VAPID_PUBLIC_KEY` | Vercel → Environment Variables | Si no existe, el script genera el par y muestra la clave pública. Si VAPID ya estaba, debe ser la misma pareja. Un cambio obliga a volver a suscribirse: la web lo hace sola al abrirse |
| Publicar la web | `git push` | Después del script |
| Clave FCM V1 en EAS | `cd mobile && npm run eas:credentials` | Ver `mobile/README.md`. Sin ella, Expo responde `InvalidCredentials` y salta la alerta |
| Compilar el APK | `cd mobile && npm run build:apk` | Sin OTA: hay que instalarlo |
| `EXPO_ACCESS_TOKEN` | `supabase secrets set` | Solo si se activa "Enhanced push security" en Expo |
| Retirar `send-push` | `npx supabase functions delete send-push --yes` | Cuando todo funcione; el trigger ya no la llama |

## Pruebas

```bash
npm test                     # lógica y código, sin red
npm run test:notifications   # sistema completo en Docker; no toca producción ni otros proyectos
```

`test:notifications` usa los servicios reales de Supabase (Postgres, pgmq, pg_cron, pg_net, Realtime, Auth, Edge Functions) con Expo y el servicio Web Push simulados.

`tests/notifications/baseline_schema.sql` **deduce** las tablas originales, que no están en las migraciones. Por eso `db push` en producción sigue siendo el primer contacto con el esquema real, y el script comprueba las columnas antes de aplicar nada.

### Pruebas físicas pendientes

Requieren dispositivos y el backend desplegado. **Ninguna de estas se ha ejecutado.**

| # | Prueba | Cómo |
|---|---|---|
| 6 | iPhone con la PWA | Safari → Compartir → Añadir a pantalla de inicio. Ajustes → Alertas. Cerrar la app y crear una solicitud desde otra cuenta. Comprobar el texto en la pantalla bloqueada |
| 7 | Android con la app cerrada | APK instalado y permiso aceptado. Cerrar la app (no solo minimizarla). Crear una solicitud desde otra cuenta |
| 9 | Enlaces en dispositivo | Pulsar el aviso en ambos con la app cerrada: debe abrir el módulo y marcarlo como leído |
| 10 | Leído entre plataformas | Marcar en el móvil y ver bajar el contador en la web, y al revés |
| 16 | Sin ordenador local | Con todo apagado, crear una solicitud desde el móvil de otra persona |

Para confirmar una entrega en producción:

```sql
select channel, status, attempts, http_status, last_error_code, accepted_at, confirmed_at, device_confirmed_at
from notif_private.deliveries order by created_at desc limit 20;
```
