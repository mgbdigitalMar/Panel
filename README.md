# 🏢 Margube Panel Admin

![Screenshot](https://via.placeholder.com/1200x600/1e293b/ffffff?text=Margube+Panel)

**Panel administrativo moderno para Margube** - Gestión completa de empleados, reservas de salas/vehículos, solicitudes y dashboard realtime.

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
