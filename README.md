# 🏢 Margube Panel Admin

**Panel administrativo moderno para Margube** - Gestión completa de empleados, reservas de salas/vehículos, solicitudes y dashboard realtime.

## Pantalla completa y Liquid Glass

En Ajustes (Más → Preferencias en la app), Liquid Glass permite elegir Sin efecto, Suave, Normal o Intenso. El cambio se aplica al momento y se guarda en el dispositivo. Reducir transparencia del sistema tiene prioridad. En iOS 26 o posterior la app usa el material nativo cuando está disponible; la web lo adapta con transparencias y desenfoque CSS.

Para abrir la web sin las barras de Safari: Compartir → Añadir a pantalla de inicio y abrir Margube desde su icono. El fondo ocupa la pantalla; los controles respetan la cámara y el indicador de inicio. Safari conserva sus barras cuando se visita desde una pestaña. Los cambios de la app requieren distribuir una nueva compilación o actualización compatible.

## Asistente de trámites

La web y la app incluyen un globo con la hoja de Margube abajo a la derecha, sobre el dock en móvil. Abre una mini ventana de chat en esa misma esquina, conservando Liquid Glass y el fondo de oficina. El chat permanece al cerrar la ventana y al navegar; se borra al cerrar sesión o iniciar una nueva conversación. El asistente no aparece en el menú lateral; `/assistant` conserva el acceso desde enlaces antiguos.

Permite consultar trámites y preparar solicitudes, asuntos propios y reservas. Una propuesta no realiza cambios hasta pulsar «Confirmar acción». Se reutilizan los servicios y validaciones de los formularios existentes. La app usa `https://margube.vercel.app/api/assistant`; `EXPO_PUBLIC_WEB_URL` permite cambiar el origen público en otra instalación. Usa la sesión de Supabase de la app, sin incluir claves del proveedor. La API debe estar desplegada y configurada en ese origen.

Los empleados pueden crear trámites y eliminar los suyos pendientes. Las cuentas con rol `admin` también pueden aprobar/rechazar solicitudes y asuntos propios, confirmar/cancelar reservas y eliminar registros del equipo. RR. HH. conserva los permisos de su cuenta: el departamento por sí solo no concede permisos de administración. No se añaden nuevos roles ni se cambian las políticas de la base de datos.

El chat llama a `/api/assistant`, una función Node incluida en el mismo proyecto de Vercel. No hay que desplegar una Edge Function de Supabase. Para activarlo, configura estas variables **privadas de servidor**, nunca con prefijo `VITE_` ni en el navegador:

```text
GROQ_API_KEY=tu_clave_privada
GROQ_MODEL=openai/gpt-oss-20b
```

En local puedes introducir la clave sin mostrarla en pantalla:

```bash
node scripts/configure-groq.mjs
npm run dev
```

El comando guarda la clave en `.env.local`, excluido de Git. `npm run dev` y `npm run preview` incluyen la API local. La clave no se incorpora al JavaScript del navegador.

En Vercel, abre **Settings → Environment Variables**, añade `GROQ_API_KEY` como variable sensible para Production y Preview, y vuelve a desplegar. `GROQ_MODEL` es opcional. Se reutilizan las variables existentes `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`; también se admiten `SUPABASE_URL` y `SUPABASE_ANON_KEY` en el servidor. Los cambios de `api/` y `server/` activan el despliegue y las rutas `/api/` quedan fuera del fallback de la SPA. Los secretos locales no se transfieren automáticamente a Vercel.

Los modelos compatibles usan Structured Outputs estricto. Si Groq rechaza ese formato con 400/422, se intenta una sola generación en modo JSON con el mismo modelo y plazo total de 25 segundos. Otros modelos configurados usan JSON directamente. Las respuestas se validan en el servidor; las propuestas incompletas preguntan por los datos ausentes. Este reintento no ejecuta acciones ni cambia de proveedor; los errores de cuota no se reintentan automáticamente.

La función valida la sesión con Supabase Auth y consulta con el JWT del usuario y las políticas RLS; no usa una clave de servicio para acceder a datos. Las consultas se procesan con Groq y están sujetas a sus condiciones de privacidad. El historial se conserva solo en memoria de la sesión. No se utiliza la API de pago de OpenAI; el identificador `openai/gpt-oss-20b` corresponde al modelo abierto alojado en Groq.

La función reduce el contexto de datos a unos 4000 caracteres y el historial a 3000 para moderar el consumo del plan gratuito. Conserva los totales y avisa al modelo cuando una lista se acorta. Estos límites de caracteres no garantizan una cuota de tokens: Groq aplica sus límites por cuenta y puede devolver 429. No hay cambio automático a un proveedor de pago.

Si Groq rechaza una petición, la interfaz distingue entre clave inválida, modelo no disponible, límite gratuito, exceso de tamaño y respuesta no válida. En local, tras cambiar `GROQ_API_KEY` o `GROQ_MODEL`, reinicia `npm run dev`. La interfaz ofrece acceso directo a los formularios de solicitudes y reservas cuando el proveedor no responde.

Para comprobar la generación real de acciones con datos ficticios, sin escribir en la base de datos: `node scripts/check-assistant.mjs`. Esta prueba usa la clave privada local y llama al proveedor; recorre la propuesta y la confirmación con servicios de escritura simulados.

Las consultas están acotadas a 60 solicitudes, 60 asuntos propios, 100 reservas futuras, 100 recursos de cada tipo y 200 horarios ocupados sin identificar a sus solicitantes; la respuesta recibe los totales para reconocer listas incompletas. El límite de seis mensajes por minuto es por usuario e instancia de la función: para un límite global o de gasto, configura también el presupuesto del proveedor o una pasarela de cuotas. No se envían nóminas, archivos, contraseñas ni correos del directorio.

Las pruebas del asistente usan servicios simulados y verifican permisos, fechas, solapamientos, identidad del actor y errores; no demuestran una conversación real con el proveedor. Tras configurar la clave, verifica en un entorno de prueba una consulta, una creación confirmada y un rechazo de permisos con cuentas de empleado y administrador.

## RR. HH.: documentos privados, departamentos e historial

Migraciones (aplicar en orden, primero en staging, y publicar a la vez la web y una versión nueva de la app):

1. `supabase/migrations/20261123120000_private_documents.sql`: el bucket `documents` (nóminas, contratos, justificantes, normas) pasa a **privado**. La base de datos guarda una referencia (`/object/authenticated/…`) y la web y la app muestran URLs firmadas que caducan en una hora y se renuevan solas (`shared/services/storageFiles.js`). Un archivo solo se puede leer desde una fila que lo referencia si quien la creó es también quien lo subió, o un admin. Las versiones anteriores de la web y la app dejan de poder abrir archivos.
2. `supabase/migrations/20261123130000_hr_foundations.sql`: tabla `departments` (Administración → Departamentos) y `hr_audit_logs`, el historial de cambios de fichas, DNI, departamentos, documentos, solicitudes, asuntos propios y bolsa de horas (Administración → Historial). Solo lo leen los admins y nadie lo puede modificar desde la API. El valor del DNI nunca se guarda en el historial. `purge_hr_audit_logs(días)` aplica el plazo de conservación (mínimo 365 días).

3. `supabase/migrations/20261124120000_time_tracking.sql`: **fichaje** (registro diario de jornada, art. 34.9 ET). Entrada, descansos y salida con la hora del servidor (`clock_event`), que también comprueba el orden. Nadie puede editar ni borrar un fichaje: un olvido o un error se corrige con una solicitud (`request_time_correction`) que RR. HH. aprueba; la corrección añade un fichaje nuevo y deja el original anulado, no borrado. Incluye horarios (`work_schedules`, con «Jornada general»: L-J 08:00-17:00 con 1 h de pausa y V 08:00-14:30, **a revisar por RR. HH.**). Una ficha con fichajes ya no se puede eliminar, porque hay que conservarlos cuatro años.

Fichaje en la web: `/fichaje` (menú lateral, Inicio, «Más» en el móvil y atajo G F). RR. HH. tiene además las vistas Equipo (quién trabaja, quién no ha fichado, incidencias, correcciones e informe mensual en CSV) y Horarios. En la app: botón «Fichaje» en la tarjeta «Tu jornada» de Inicio y el enlace `margube://fichaje`.

Los roles no cambian: `admin` es RR. HH./administración y `employee` el resto.

Permisos reales en staging (suite 24): con `RUN_LIVE_DB_TESTS=1` y las variables `STAGING_SUPABASE_URL`, `STAGING_SUPABASE_PUBLISHABLE_KEY`, `STAGING_ADMIN_EMAIL/PASSWORD`, `STAGING_EMPLOYEE_A_EMAIL/PASSWORD` y `STAGING_EMPLOYEE_B_EMAIL/PASSWORD`, `npm test` entra con tres cuentas reales y comprueba que un empleado no puede leer los archivos, documentos, asuntos propios ni el DNI de otro, ni el historial de RR. HH. La suite se niega a ejecutarse contra el proyecto de producción.

[![Vite](https://img.shields.io/badge/Vite-646cff?style=flat&logo=vite)](https://vite.dev/)
[![React](https://img.shields.io/badge/React-61DAFB?style=flat&logo=react)](https://react.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat&logo=supabase)](https://supabase.com/)
[![Responsive](https://img.shields.io/badge/Responsive-007ACC?style=flat&logo=tailwind)](https://tailwindcss.com/)

## ✨ Características Principales

### Empleados & Auth

- Login con email/password (hash bcrypt)
- Roles: admin/employee
- Admin: CRUD empleados, salas, vehículos
- First-login password change

### Reservas (Salas/Vehículos)

- Lista/tabs (Todas/Salas/Vehículos/Calendario)
- Form nueva reserva (fecha/horas/propósito)
- Admin approve/reject/delete
- Calendario mes/semana visual

### Solicitudes

- Vacaciones/Compras
- Form nueva solicitud
- Admin approve/reject
- Stats pendientes/aprobadas/rechazadas

### Dashboard/Admin

- Noticias/events realtime
- Stats resúmenes
- Responsive design (mobile-first)

### Seguridad & UX

- **Auto-logout 1min inactividad** (mousemove/keydown reset)
- Realtime Supabase (notifs/actualizaciones)
- Dark/light theme
- Responsive completo (grids/tables/calendar/modals)
- Density toggle (compact/normal)

## 🛠️ Stack Tecnológico

- **Frontend**: React + Vite + SCSS modules + Framer Motion
- **Backend/DB**: Supabase (PostgreSQL + Realtime + Auth)
- **UI**: Custom components (Card, Modal, Select...)
- **State**: React Context

## 🚀 Inicio Rápido

```bash
# 1. Clonar & instalar
git clone <repo> && cd Panel
npm install

# 2. Configurar Supabase
cp .env.example .env
# Edit .env con tus SUPABASE_URL y SUPABASE_KEY

# 3. Desarrollo local
npm run dev

# 4. Build producción
npm run build
```

## 🗄️ Schema Supabase

```
profiles: id, name, email, password_hash, role, department...
rooms: id, name, capacity, floor, equipment text[] DEFAULT '{}'
vehicles: id, model, plate, year, type
requests: id, type(vacation/purchase), status, employee_id...
reservations: id, type(room/vehicle), resource_id, employee_id, date, time_start/end...
```

## 📱 Responsive

- Mobile: Sidebar collapse, grids 1col, tables scrollX, calendar touch
- Desktop: Full layouts

## 🔐 Features Especiales

- Equipment rooms: Comma-input → array tags
- Edit rooms/vehicles full CRUD
- Idle timeout security

Desplegado con Vercel. ¡Listo para producción!
