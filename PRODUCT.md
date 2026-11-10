# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

La web (React + Vite, instalable como PWA) y la app nativa (Expo / React Native, en `mobile/`) son el mismo producto, con la misma base de datos y los mismos servicios (`shared/services`).

## Users

Empleados y empleadas de Margube y su equipo de RR. HH./administración. Conviven dos situaciones con el mismo peso: en la oficina, con ordenador, y fuera de ella, con el móvil. Entran para hacer un trámite concreto y breve: reservar una sala o un vehículo, pedir un día, registrar horas, ver quién está y dónde. RR. HH. además revisa y aprueba lo que piden los demás.

Hay personas con poca soltura digital o de más edad: nadie debería tener que adivinar qué hace un icono.

## Product Purpose

La intranet corporativa de Margube: un único sitio para los trámites internos del día a día y para que la empresa se comunique con su plantilla. Tiene éxito cuando un trámite se termina en segundos, sin preguntar a nadie y sin dudar de que ha quedado hecho.

## Positioning

Está hecha para Margube y no es un producto genérico de RR. HH.: sus propias salas y vehículos con disponibilidad en directo, su bolsa de horas, sus normas internas firmadas y su equipo.

## Operating Context

- Sesiones cortas y repetidas durante la jornada, a menudo entre otras tareas o de pie, con el móvil.
- La sesión se cierra tras 1 minuto de inactividad, con un aviso 15 s antes.
- RR. HH. trabaja por lotes: revisa colas de pendientes y exporta datos.
- Hay push y notificaciones en tiempo real que llevan directamente a una pantalla.

## Capabilities and Constraints

Toda esta funcionalidad debe conservarse en cualquier cambio de interfaz:

- **Acceso:** login con correo y contraseña, recordarme, cambio de contraseña obligatorio en el primer acceso, biometría y bloqueo en la app, aviso de inactividad.
- **Inicio:** saludo, progreso de la jornada, panel «Hoy», gráficas por semana, mes y año, indicadores, noticias fijadas, cumpleaños, fuera de la oficina hoy.
- **Reservas:** salas y vehículos, disponibilidad en directo, agenda, calendario, añadir al calendario (.ics), exportar; el admin aprueba, rechaza o cancela.
- **Solicitudes:** asuntos propios, trabajo en remoto, trabajo externo y compras, con justificante; registro de quién revisó y cuándo.
- **Tiempo a compensar:** registro de horas y saldo de la bolsa de horas.
- **Noticias y eventos:** comunicados, fijadas, editor para admins.
- **Equipo:** directorio y dónde trabaja cada persona, hoy y durante la semana.
- **Mi perfil:** datos, modo de trabajo, contraseña, documentos.
- **Ajustes:** tema y notificaciones.
- **Asistente web:** chat escrito para consultar y preparar solicitudes, asuntos propios y reservas, con confirmación antes de ejecutar. Las cuentas admin también revisan y gestionan trámites del equipo. La función `/api/assistant` se despliega con la web en Vercel; necesita una clave de Groq en las variables privadas del servidor.
- **Administración:** empleados (incluido restablecer la contraseña), salas, vehículos, documentos, bolsa de horas, exportación CSV de firmas de normas.
- **Transversal:** notificaciones en tiempo real y push, buscador (Ctrl+K), atajos («?»), firma de las normas internas, PWA, tema claro y oscuro, cuatro estados en cada vista (carga, vacío, error, contenido).

Restricciones técnicas: SCSS Modules en la web (Tailwind instalado pero sin usar); Expo SDK 58 en la app; la lógica de negocio vive en `shared/services` y no se toca para cambiar la interfaz; `npm test` comprueba reglas de funcionamiento y UX.

Sin decidir: a qué se dedica Margube no está documentado en el repositorio; no hay que afirmarlo en la interfaz.

## Brand Commitments

- Nombre: Margube.
- Se conservan el logotipo y la hoja (`src/assets/logos/`, `mobile/assets/`) y el azul Margube `#2F5BEA`. Todo lo demás de la identidad visual es reemplazable.
- Voz: español de España, tuteando, claro y breve.

## Evidence on Hand

- Reglas de producto y UX: este documento y la implementación existente.
- Sin datos inventados en la interfaz final.

## Product Principles

1. **El trámite primero.** Lo más frecuente está a un paso; lo demás no estorba.
2. **Nada que adivinar.** Etiquetas visibles, estados en palabras y resultado siempre confirmado.
3. **Una sola Margube.** Web y app se reconocen como el mismo producto, respetando cómo se usa cada dispositivo.
4. **Ninguna función se pierde.** Cambiar la interfaz nunca quita capacidad a nadie.
5. **Quien revisa ve por qué.** Cada aprobación tiene su contexto y deja rastro.

## Accessibility & Inclusion

WCAG 2.2 AA como mínimo, en web y app, en los dos temas. Debe poder usarse con poca soltura digital y a cualquier edad: etiquetas visibles en vez de solo iconos, texto legible, objetivos táctiles amplios, teclado y lector de pantalla completos, respeto a «reducir movimiento» y al tamaño de texto del sistema.
