# 🏢 Margube Panel Admin

**Panel administrativo moderno para Margube** - Gestión completa de empleados, reservas de salas/vehículos, solicitudes y dashboard realtime.

## Pantalla completa y Liquid Glass

En Ajustes (Más → Preferencias en la app), Liquid Glass permite elegir Sin efecto, Suave, Normal o Intenso. El cambio se aplica al momento y se guarda en el dispositivo. Reducir transparencia del sistema tiene prioridad. En iOS 26 o posterior la app usa el material nativo cuando está disponible; la web lo adapta con transparencias y desenfoque CSS.

Para abrir la web sin las barras de Safari: Compartir → Añadir a pantalla de inicio y abrir Margube desde su icono. El fondo ocupa la pantalla; los controles respetan la cámara y el indicador de inicio. Safari conserva sus barras cuando se visita desde una pestaña. Los cambios de la app requieren distribuir una nueva compilación o actualización compatible.

## Asistente de trámites

La web incluye `/assistant`, disponible desde el menú, el buscador y «Más» en móvil. Permite conversar por escrito, consultar trámites y preparar solicitudes, asuntos propios y reservas. Una propuesta no realiza cambios hasta que la persona pulsa «Confirmar acción». Se reutilizan los servicios y validaciones de los formularios existentes.

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

El modelo debe admitir Structured Outputs en modo estricto de Groq. La función valida la sesión con Supabase Auth y consulta con el JWT del usuario y las políticas RLS; no usa una clave de servicio para acceder a datos. Las consultas se procesan con Groq y están sujetas a sus condiciones de privacidad. El historial se conserva solo en memoria de la página. No se utiliza la API de pago de OpenAI; el identificador `openai/gpt-oss-20b` corresponde al modelo abierto alojado en Groq.

La función reduce el contexto de datos a unos 4000 caracteres y el historial a 3000 para moderar el consumo del plan gratuito. Conserva los totales y avisa al modelo cuando una lista se acorta. Estos límites de caracteres no garantizan una cuota de tokens: Groq aplica sus límites por cuenta y puede devolver 429. No hay cambio automático a un proveedor de pago.

Si Groq rechaza una petición, la interfaz distingue entre clave inválida, modelo no disponible, límite gratuito, exceso de tamaño y respuesta no válida. En local, tras cambiar `GROQ_API_KEY` o `GROQ_MODEL`, reinicia `npm run dev`. La interfaz ofrece acceso directo a los formularios de solicitudes y reservas cuando el proveedor no responde.

Para comprobar la generación real de acciones con datos ficticios, sin escribir en la base de datos: `node scripts/check-assistant.mjs`. Esta prueba usa la clave privada local y llama al proveedor; recorre la propuesta y la confirmación con servicios de escritura simulados.

Las consultas están acotadas a 60 solicitudes, 60 asuntos propios, 100 reservas futuras, 100 recursos de cada tipo y 200 horarios ocupados sin identificar a sus solicitantes; la respuesta recibe los totales para reconocer listas incompletas. El límite de seis mensajes por minuto es por usuario e instancia de la función: para un límite global o de gasto, configura también el presupuesto del proveedor o una pasarela de cuotas. No se envían nóminas, archivos, contraseñas ni correos del directorio.

Las pruebas del asistente usan servicios simulados y verifican permisos, fechas, solapamientos, identidad del actor y errores; no demuestran una conversación real con el proveedor. Tras configurar la clave, verifica en un entorno de prueba una consulta, una creación confirmada y un rechazo de permisos con cuentas de empleado y administrador.

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
