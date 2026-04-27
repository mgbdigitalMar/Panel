export const MOCK_EMPLOYEES = [
  { id: 1, name: 'Carlos Ruiz',     email: 'carlos.ruiz@margube.com',   password: 'Margube2024!', role: 'admin',    dept: 'Dirección',  phone: '600123456', position: 'Director General', avatar: 'CR', birthdate: '1980-03-15', joinDate: '2010-01-01', firstLogin: false, workMode: 'office' },
  { id: 2, name: 'Laura Gómez',     email: 'laura.gomez@margube.com',   password: 'Pass1234!',    role: 'employee', dept: 'RRHH',       phone: '600234567', position: 'Jefa de RRHH',    avatar: 'LG', birthdate: '1988-07-22', joinDate: '2015-06-01', firstLogin: false, workMode: 'remote' },
  { id: 3, name: 'Miguel Torres',   email: 'miguel.torres@margube.com', password: 'Temp0001!',    role: 'employee', dept: 'Tecnología', phone: '600345678', position: 'Dev Backend',      avatar: 'MT', birthdate: '1992-11-08', joinDate: '2020-03-15', firstLogin: true,  workMode: 'remote' },
  { id: 4, name: 'Ana Fernández',   email: 'ana.fernandez@margube.com', password: 'Temp0002!',    role: 'employee', dept: 'Marketing',  phone: '600456789', position: 'Diseñadora',       avatar: 'AF', birthdate: '1990-04-30', joinDate: '2019-09-01', firstLogin: true,  workMode: 'field'  },
  { id: 5, name: 'Pedro López',     email: 'pedro.lopez@margube.com',   password: 'Temp0003!',    role: 'employee', dept: 'Ventas',     phone: '600567890', position: 'Comercial Sr',     avatar: 'PL', birthdate: '1985-12-03', joinDate: '2017-02-01', firstLogin: false, workMode: 'field'  },
  { id: 6, name: 'Elena Martín',    email: 'elena.martin@margube.com',  password: 'Temp0004!',    role: 'employee', dept: 'Finanzas',   phone: '600678901', position: 'Contable',         avatar: 'EM', birthdate: '1993-08-19', joinDate: '2021-01-10', firstLogin: false, workMode: 'office' },
]

export const MOCK_ROOMS = [
  { id: 1, name: 'Sala Conquista',   capacity: 10, floor: 2, equipment: ['Proyector', 'TV', 'Videoconferencia'] },
  { id: 2, name: 'Sala Atlántico',   capacity: 6,  floor: 1, equipment: ['TV', 'Pizarra'] },
  { id: 3, name: 'Sala Executive',   capacity: 20, floor: 3, equipment: ['Proyector', 'TV', 'Videoconferencia', 'Sistema de audio'] },
  { id: 4, name: 'Sala Innovación',  capacity: 4,  floor: 2, equipment: ['TV', 'Pizarra digital'] },
]

export const MOCK_VEHICLES = [
  { id: 1, plate: '1234-MGB', model: 'SEAT León',        year: 2022, type: 'Turismo'   },
  { id: 2, plate: '5678-MGB', model: 'VW Caddy',         year: 2021, type: 'Furgoneta' },
  { id: 3, plate: '9012-MGB', model: 'Toyota Corolla',   year: 2023, type: 'Turismo'   },
]

export const MOCK_RESERVATIONS = [
  { id: 1, type: 'room',    resourceId: 1, resourceName: 'Sala Conquista',         employeeId: 2, employeeName: 'Laura Gómez',   date: '2025-01-20', timeStart: '10:00', timeEnd: '12:00', purpose: 'Reunión trimestral',    status: 'confirmed' },
  { id: 2, type: 'vehicle', resourceId: 1, resourceName: 'SEAT León 1234-MGB',     employeeId: 5, employeeName: 'Pedro López',   date: '2025-01-21', timeStart: '09:00', timeEnd: '18:00', purpose: 'Visita cliente',         status: 'confirmed' },
  { id: 3, type: 'room',    resourceId: 3, resourceName: 'Sala Executive',         employeeId: 1, employeeName: 'Carlos Ruiz',   date: '2025-01-22', timeStart: '14:00', timeEnd: '16:00', purpose: 'Presentación anual',    status: 'pending'   },
  { id: 4, type: 'vehicle', resourceId: 3, resourceName: 'Toyota Corolla 9012-MGB',employeeId: 3, employeeName: 'Miguel Torres', date: '2025-01-23', timeStart: '08:00', timeEnd: '14:00', purpose: 'Asistencia técnica',    status: 'pending'   },
  { id: 5, type: 'room',    resourceId: 2, resourceName: 'Sala Atlántico',         employeeId: 6, employeeName: 'Elena Martín',  date: '2025-01-24', timeStart: '11:00', timeEnd: '13:00', purpose: 'Reunión equipo',        status: 'confirmed' },
  { id: 6, type: 'room',    resourceId: 1, resourceName: 'Sala Conquista',         employeeId: 2, employeeName: 'Laura Gómez',   date: '2025-01-27', timeStart: '09:00', timeEnd: '10:00', purpose: 'Onboarding Miguel',     status: 'confirmed' },
]

export const MOCK_REQUESTS = [
  { id: 1, type: 'vacation', employeeId: 2, employeeName: 'Laura Gómez',   startDate: '2025-02-10', endDate: '2025-02-17', days: 5,   reason: 'Vacaciones familiares',          status: 'approved', createdAt: '2025-01-15' },
  { id: 2, type: 'purchase', employeeId: 3, employeeName: 'Miguel Torres', item: 'Licencia IntelliJ IDEA',      amount: 599, reason: 'Herramienta de desarrollo',      status: 'pending',  createdAt: '2025-01-18' },
  { id: 3, type: 'vacation', employeeId: 4, employeeName: 'Ana Fernández', startDate: '2025-03-03', endDate: '2025-03-07', days: 5,   reason: 'Asuntos personales',            status: 'pending',  createdAt: '2025-01-19' },
  { id: 4, type: 'purchase', employeeId: 5, employeeName: 'Pedro López',   item: 'Material de presentación',   amount: 120, reason: 'Demo cliente importante',         status: 'approved', createdAt: '2025-01-10' },
  { id: 5, type: 'purchase', employeeId: 6, employeeName: 'Elena Martín',  item: 'Software contabilidad',      amount: 890, reason: 'Renovación licencia anual',       status: 'rejected', createdAt: '2025-01-12' },
  { id: 6, type: 'vacation', employeeId: 5, employeeName: 'Pedro López',   startDate: '2025-02-24', endDate: '2025-02-28', days: 5,   reason: 'Viaje de negocios',             status: 'pending',  createdAt: '2025-01-20' },
]

export const MOCK_DOCUMENTS = [
  { id: 'd1', title: 'Contrato de trabajo 2025', description: 'Revisa y firma tu contrato actualizado para el ejercicio 2025.', file_url: null, sender_id: 1, senderName: 'Carlos Ruiz', recipient_id: 2, recipientName: 'Laura Gómez', status: 'pending', created_at: '2025-01-20T09:00:00Z' },
  { id: 'd2', title: 'Política de Teletrabajo', description: 'Documento con las nuevas normas de teletrabajo aprobadas en Enero 2025.', file_url: null, sender_id: 1, senderName: 'Carlos Ruiz', recipient_id: 3, recipientName: 'Miguel Torres', status: 'signed', created_at: '2025-01-15T11:30:00Z' },
  { id: 'd3', title: 'NDA — Proyecto Atlántida', description: 'Acuerdo de confidencialidad para el proyecto Atlántida. Requiere firma antes del 31/01.', file_url: null, sender_id: 1, senderName: 'Carlos Ruiz', recipient_id: 4, recipientName: 'Ana Fernández', status: 'completed', created_at: '2025-01-10T08:00:00Z' },
]

export const MOCK_HOUR_COMPENSATIONS = [
  { id: 'hc1', employee_id: 2, employeeName: 'Laura Gómez',   date: '2025-01-10', reason: 'Reunión de urgencia fuera de horario', hours: 2,   type: 'ya',    status: 'approved',  created_at: '2025-01-10T22:00:00Z' },
  { id: 'hc2', employee_id: 3, employeeName: 'Miguel Torres', date: '2025-01-15', reason: 'Despliegue en producción nocturno',   hours: 4,   type: 'bolsa', status: 'approved',  created_at: '2025-01-15T23:00:00Z' },
  { id: 'hc3', employee_id: 3, employeeName: 'Miguel Torres', date: '2025-01-22', reason: 'Guardia de soporte fin de semana',    hours: 8,   type: 'bolsa', status: 'pending',   created_at: '2025-01-22T09:00:00Z' },
  { id: 'hc4', employee_id: 5, employeeName: 'Pedro López',   date: '2025-01-18', reason: 'Visita cliente en festivo',          hours: 3.5, type: 'bolsa', status: 'rejected',  created_at: '2025-01-18T18:00:00Z' },
  { id: 'hc5', employee_id: 2, employeeName: 'Laura Gómez',   date: '2025-01-25', reason: 'Cobertura baja compañera',           hours: 1.5, type: 'bolsa', status: 'pending',   created_at: '2025-01-25T17:00:00Z' },
  { id: 'hc6', employee_id: 2, employeeName: 'Laura Gómez',   date: '2025-01-08', reason: 'Llegada tarde por cita médica',      hours: 1,   type: 'debe',  status: 'approved',  created_at: '2025-01-08T09:00:00Z' },
  { id: 'hc7', employee_id: 3, employeeName: 'Miguel Torres', date: '2025-01-20', reason: 'Salida anticipada (asuntos personales)', hours: 2, type: 'debe',  status: 'pending',   created_at: '2025-01-20T17:00:00Z' },
  { id: 'hc8', employee_id: 5, employeeName: 'Pedro López',   date: '2025-01-12', reason: 'Ausencia no justificada media jornada', hours: 4, type: 'debe', status: 'approved',  created_at: '2025-01-12T14:00:00Z' },
]

export const MOCK_NEWS = [
  { id: 1, type: 'news',  title: 'Margube alcanza récord de ventas en Q4 2024',  content: 'Cerramos el trimestre con un incremento del 34% respecto al año anterior. Gracias a todo el equipo por su dedicación y esfuerzo continuo durante este periodo.', author: 'Carlos Ruiz',  authorAvatar: 'CR', date: '2025-01-18', pinned: true,  category: 'Empresa'   },
  { id: 2, type: 'event', title: 'Formación en Liderazgo — 28 Enero',            content: 'Taller intensivo de liderazgo y gestión de equipos. Obligatorio para mandos intermedios. Lugar: Sala Executive. Traed bloc de notas.',                              author: 'Laura Gómez', authorAvatar: 'LG', date: '2025-01-20', pinned: false, category: 'Formación' },
  { id: 3, type: 'news',  title: 'Nuevas políticas de trabajo remoto 2025',      content: 'A partir de febrero, los empleados podrán teletrabajar hasta 3 días a la semana previa autorización del responsable de área. Más detalles en RRHH.',                author: 'Laura Gómez', authorAvatar: 'LG', date: '2025-01-15', pinned: false, category: 'RRHH'      },
  { id: 4, type: 'event', title: 'Celebración 15º Aniversario Margube — 15 Feb', content: 'Gran celebración por los 15 años de Margube. Cena de gala en el Hotel NH. Confirma asistencia antes del 10 de febrero con Laura.',                                  author: 'Carlos Ruiz', authorAvatar: 'CR', date: '2025-02-15', pinned: true,  category: 'Empresa'   },
  { id: 5, type: 'news',  title: 'Bienvenida a nuevos incorporados',             content: 'Damos la bienvenida a Miguel Torres (Tecnología) y Ana Fernández (Marketing). ¡Esperamos que se integren pronto en el equipo Margube!',                            author: 'Laura Gómez', authorAvatar: 'LG', date: '2025-01-08', pinned: false, category: 'RRHH'      },
]
