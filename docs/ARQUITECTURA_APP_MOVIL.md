# Margube Intranet — Auditoría y arquitectura WEB + APP

Fecha: 2026-10-06. Estado: Fase 1 (auditoría) y Fase 2 (arquitectura) completas; Fase 5 (push) implementada en código, pendiente de despliegue.

## 1. Arquitectura actual detectada

| Capa | Tecnología | Notas |
|---|---|---|
| Web | React 18 + Vite 5, react-router 7, SCSS modules + Tailwind 4, framer-motion, recharts, PWA | Entrada: `src/main.jsx` → `src/App.tsx` |
| Estado | React Context (`src/context/index.jsx`, ~1300 líneas) | Theme, Auth, Data dividido en 9 contextos. React Query instalado pero sin uso |
| Backend | Supabase (PostgreSQL + Realtime + Storage) | No hay API propia: los clientes consultan tablas directamente con la clave publicable |
| Tiempo real | Supabase Realtime `postgres_changes` en 10 tablas + refetch al volver a la pestaña | Reutilizable tal cual en la app |
| Archivos | Bucket público `documents` en Storage, con fallback a base64 en la fila si falla | Límite 15 MB |
| Notificaciones | Tabla `notifications` (insertada desde el cliente) + toasts + Notification API del navegador | Antes existía un trigger de email con Resend (eliminado del repo en `f7bc85a`) |
| Despliegue | Vercel (SPA con rewrite a `index.html`) | `panel.margube.com` |
| App móvil | Expo SDK 52 / React Native 0.76 en `mobile/`, sin versionar | Comparte `shared/` vía Metro `watchFolders` |

**Tablas:** profiles, rooms, vehicles, reservations (+ vista `reservations_full`), requests, personal_days, hour_compensations, documents, news, notifications. Nueva: push_tokens.

**Roles:** `admin` y `employee` en `profiles.role`. Solo `/admin` está protegido por rol, y solo en el cliente.

## 2. Hallazgos críticos de seguridad (requieren decisión)

1. **La autenticación se hace en el navegador.** El login lee la fila completa de `profiles` (incluido `password_hash`) con la clave pública y compara con bcrypt en el cliente. Cualquiera con la clave publicable puede leer todos los hashes.
2. **Contraseñas maestras activas.** `src/context/index.jsx` acepta `margube2026`, `test123` y `test1234` para cualquier cuenta, incluidos administradores. También acepta contraseñas en texto plano.
3. **Sin sesión de servidor.** No se usa Supabase Auth, así que `auth.uid()` es siempre null y RLS no puede distinguir usuarios ni roles. Los permisos "solo admin" son únicamente visuales.
4. **Secreto en el historial de git.** La API key de Resend está en el commit `762aaa2`. Hay que rotarla.

Consecuencia: el requisito "los permisos deben validarse en backend" no se puede cumplir sin migrar a Supabase Auth. Ver sección 8.

## 3. Matriz de paridad funcional

Leyenda: ✓ completo · ◐ parcial · ✗ falta · — no aplica.

| Funcionalidad | WEB | APP | Compartida | Específica |
|---|---|---|---|---|
| Login / logout | ✓ | ✓ | ✓ | |
| Cambio de contraseña (primer acceso) | ✓ | ✓ | ✓ | |
| Onboarding + aceptación de normas internas (PDFs) | ✓ | ✗ | ✓ | |
| Dashboard con estadísticas | ✓ | ✓ | ✓ | |
| Reservas salas/vehículos: crear, cancelar | ✓ | ✓ | ✓ | |
| Calendario de reservas | ✓ | ◐ | ✓ | |
| Solicitudes remoto/externo/compra | ✓ | ✓ | ✓ | |
| Asuntos propios con justificante | ✓ | ✗ | ✓ | |
| Sincronización automática de modo de trabajo | ✓ | ◐ | ✓ | |
| Tiempo a compensar (ya/debe/bolsa) | ✓ | ✓ | ✓ | |
| Noticias y eventos: lectura | ✓ | ✓ | ✓ | |
| Noticias: crear/editar/borrar (admin) | ✓ | ✗ | ✓ | |
| Equipo / directorio | ✓ | ✓ | ✓ | |
| Perfil y documentos recibidos | ✓ | ◐ | ✓ | |
| Envío de documentos (admin) y subida de archivos | ✓ | ✗ | ✓ | |
| Admin: aprobar/rechazar solicitudes y horas | ✓ | ✓ | ✓ | |
| Admin: aprobar/rechazar reservas y asuntos propios | ✓ | ✗ | ✓ | |
| Admin: CRUD empleados, salas, vehículos | ✓ | ✗ | ✓ | |
| Ajustes: tema claro/oscuro/sistema | ✓ | ◐ | ✓ | |
| Centro de notificaciones (leída/no leída, contador) | ✓ | ✓ | ✓ | |
| Notificaciones en tiempo real (Realtime) | ✓ | ✓ | ✓ | |
| Cierre por inactividad | ✓ 1 min | ◐ 30 min | | |
| Paleta de comandos, densidad, notificaciones de escritorio | ✓ | — | | Web |
| Push con app cerrada, badge, deep links | — | ✓ código | | Móvil |
| Biometría, cámara, QR | — | planificado | | Móvil |

La app **no está todavía en paridad**. Faltan sobre todo asuntos propios, documentos, onboarding y la administración avanzada.

## 4. Qué se reutiliza y qué se crea

**Se reutiliza sin cambios:** base de datos y tablas, Realtime, Storage, la tabla `notifications` como fuente de verdad, constantes y servicios de `shared/`.

**Creado en esta fase:**
- `supabase/migrations/20261006120000_push_notifications.sql`: tabla `push_tokens`, funciones RPC `register_push_token` / `unregister_push_token`, trigger en `notifications`.
- Edge Function de envío, hoy `supabase/functions/notifications-worker` (ver NOTIFICACIONES.md).
- App: servicio push reescrito, deep links desde push, navegación desde notificaciones corregida, bundle de Metro reparado.

**La web no se ha modificado.**

## 5. Arquitectura propuesta

```
WEB (Vite/React) ─┐                         ┌─ APP (Expo/React Native)
                  ├─ shared/ (constantes, servicios, validación) ─┤
                  └──────────── Supabase (PostgreSQL + RLS + Realtime + Storage + Edge Functions) ──────────┘
```

- La lógica de negocio sensible (notificar a admins, cambios de estado, permisos) debe migrar progresivamente de los clientes a la base de datos: triggers, funciones RPC y políticas RLS. Así web y app la comparten sin duplicarla.
- `shared/services` recibe el cliente Supabase como parámetro y no depende de DOM ni de React Native.
- La UI es específica por plataforma; las reglas no.
- Nuevas funciones: la regla en backend y la UI en el cliente que corresponda.

## 6. Estrategia de notificaciones push

Ver [NOTIFICACIONES.md](NOTIFICACIONES.md): las crea la base de datos, las procesa la Edge Function `notifications-worker` desde una cola y todos los push llevan un texto genérico.

## 7. Estrategia de sincronización y conectividad

- Realtime `postgres_changes` como mecanismo principal, igual que la web. Sin polling.
- Al volver a primer plano (`AppState`), refetch completo, equivalente al `visibilitychange` de la web.
- Datos en caché: solo lectura, siempre con indicador "sin conexión / actualizado a las HH:MM". Las escrituras sin conexión se bloquean con mensaje claro, no se encolan.

## 8. Estrategia de autenticación (recomendada)

Migrar a **Supabase Auth** manteniendo emails y contraseñas actuales:
1. Crear usuarios en `auth.users` con el mismo `id` que `profiles` y el hash bcrypt existente. Supabase Auth acepta hashes bcrypt, así que nadie tiene que cambiar contraseña.
2. Web y app usan `supabase.auth.signInWithPassword`. La sesión se guarda en `sessionStorage` en la web y en SecureStore en la app.
3. Revocar el acceso de `anon` a `password_hash` y activar RLS por tabla con `auth.uid()` y una función `is_admin()`.
4. Eliminar las contraseñas maestras y la comparación en texto plano.
5. Mantener el cierre por inactividad de la web y la redirección de primer acceso.

Este cambio afecta a la web y a producción, por eso no se ha aplicado sin aprobación.

## 9. Estrategia de diseño Liquid Glass

- Partir de los tokens de la web (acento `#2251ff`, fondo oscuro `#0b0f19`, tipografía y radios del sistema de estilos SCSS) y evolucionarlos, no sustituirlos.
- Blur real (`expo-blur`) solo en superficies fijas: barra inferior, cabeceras y hojas modales. Las tarjetas de listas usan translucidez simulada con color semitransparente y borde iluminado, sin blur, para mantener 60 fps.
- Respetar "Reducir movimiento" y "Reducir transparencia" del sistema, con fondo sólido como alternativa.
- Claro, oscuro y sistema, compartiendo la clave de preferencia con la lógica de la web.

## 10. Riesgos de compatibilidad

| Riesgo | Mitigación |
|---|---|
| Migración de auth rompe el acceso | Mismo id y mismo hash; desplegar web y app a la vez; plan de vuelta atrás |
| Activar RLS rompe consultas de la web | Activar tabla por tabla y ejecutar `npm test` tras cada una |
| Notificaciones duplicadas (toast + push) | El push solo se muestra fuera de la app; dentro se usa Realtime |
| Builders de Supabase sin `await` no se ejecutan | Corregido en el registro de tokens; revisar el mismo patrón en el resto |
| `mobile/` y `shared/` sin versionar | Hacer commit antes de seguir |

## 11. Plan por fases

| Fase | Estado |
|---|---|
| 1. Auditoría | Hecho |
| 2. Arquitectura | Hecho (este documento) |
| 3. App base | Existía; bundle reparado |
| 4. Paridad funcional | Pendiente: asuntos propios, documentos y subida de archivos, onboarding, CRUD admin, gestión de reservas admin, noticias admin |
| 5. Push | Código hecho; despliegue pendiente (sección 6) |
| 6. Diseño Liquid Glass | Pendiente |
| 7. Optimización | Pendiente |
| 8. Testing | Web: `npm run build` OK. App: bundles iOS y Android OK. Pruebas en dispositivo pendientes |
| 0. Seguridad (auth + RLS) | Requiere aprobación; bloquea la validación de permisos en backend |
