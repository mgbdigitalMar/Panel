Trabajas en **Margube Intranet**, la intranet corporativa de Margube. Antes de proponer o escribir nada, lee este contexto: describe para qué sirve la web, cómo está construida y su guía de estilo. Todo lo que hagas tiene que encajar con ella.

## 1. Para qué sirve

Intranet de empleados y administradores de Margube. Tiene una web (este repo) y una app móvil (Expo, en `mobile/`) que comparten la misma base de datos Supabase y la misma lógica (`shared/services`). Todos los textos van en español de España, tuteando al usuario, claros y breves.

Secciones:
- **Inicio**: saludo, progreso de la jornada, panel «Hoy», gráficas por semana, mes y año, y noticias fijadas.
- **Reservas**: salas y vehículos de empresa. Muestra qué está libre, tiene calendario y el admin aprueba, rechaza o cancela.
- **Solicitudes**: asuntos propios, trabajo en remoto, trabajo externo y compras. El admin las revisa y queda registrado quién las revisó y cuándo.
- **Tiempo a compensar**: registro de horas y saldo de la bolsa de horas.
- **Noticias y Eventos**: comunicados y próximos eventos.
- **Equipo**: directorio y dónde trabaja cada persona (oficina, remoto o externo), hoy y durante la semana.
- **Mi perfil**: datos, modo de trabajo, contraseña y documentos.
- **Ajustes**: tema y notificaciones.
- **Administración** (solo admins): empleados, salas, vehículos, documentos, bolsa de horas y exportación en CSV de las firmas de normas internas.

Funciones comunes a todas las secciones:
- Notificaciones en tiempo real y push.
- Buscador con Ctrl+K y atajos de teclado con «?».
- La sesión se cierra tras 1 minuto de inactividad, con un aviso 15 s antes.
- Cambio de contraseña obligatorio en el primer acceso.
- Firma de las normas internas.
- La web se puede instalar como PWA.

## 2. Cómo está hecha

- React 18 + Vite y React Router 7. `src/App.tsx` contiene las rutas, con rutas protegidas y de admin.
- **Estilos**: SCSS Modules, un `.module.scss` por componente. Los tokens están en `src/styles/variables.scss` y los mixins compartidos en `src/styles/_patterns.scss` (`@use '../styles/patterns' as p;`). Tailwind está instalado pero no se usa: no lo introduzcas.
- Framer Motion para animar (`MotionConfig reducedMotion="user"`), lucide-react para los iconos, recharts para las gráficas, TanStack Query y clsx.
- El estado y los datos viven en `src/context`. Los componentes de interfaz propios están en `src/components/ui`: Button, Card, Modal, ConfirmModal, Input, Select, Textarea, Badge, Avatar, StatCard, EmptyState, ErrorState, Skeleton, Loader y LeafField. Reutilízalos antes de crear otros.
- **Supabase**: Auth, Postgres con RLS, Realtime, Storage y la Edge Function `send-push`. Los cambios de base de datos van como migraciones en `supabase/migrations`. El cliente solo usa la clave pública (publishable); nunca la service role.
- La lógica de negocio que también usa la app móvil va en `shared/services`, no dentro de una página.
- Tests en `tests/` (`npm test`). Muchos comprueban reglas de diseño y UX, así que ejecútalos después de cada cambio.

## 3. Estructura de pantallas

Hay un único diseño, **«Cristal ahumado»**. Cada página tiene dos composiciones:

- **Escritorio (≥ 1024 px)**, versión «Desk»:
  - A la izquierda, un **menú lateral flotante** (`GlassRail`, 72 px, en cápsula). Arriba lleva la hoja de Margube, que va a Inicio; debajo, una lista de iconos de sección con su nombre en un tooltip, donde la sección abierta es un disco iluminado (blanco en oscuro, azul en claro) y las insignias muestran los pendientes; al pie, Ajustes y los atajos de teclado.
  - Arriba, una **barra** con el logo y la sección abierta en una píldora, una cápsula de búsqueda (Ctrl+K), el botón principal «Nuevo» (nueva reserva, nueva solicitud, registrar horas), el reloj, el tema, la campana y el avatar.
- **Táctil (< 1024 px)**, versión «Touch». Usa su propio kit de componentes:
  - cabecera sobre el fondo, portada con el panel de marca, cifras, accesos y filtros;
  - filas que se despliegan y secciones plegables;
  - las tablas se convierten en fichas con etiquetas y las acciones al pie.

  En el móvil hay un dock inferior con Inicio, Reservas, Solicitudes, Horas, Más y «+»; se encoge mientras se desplaza la pantalla. En el iPad las secciones van arriba y no hay dock. En el móvil el logo es solo la hoja.

Una pantalla nueva necesita las dos composiciones, y las dos tienen que funcionar en tema claro y oscuro. El tema por defecto es el oscuro.

## 4. Guía de estilo

**Concepto.** Paneles de **cristal ahumado** suspendidos sobre una sala en penumbra iluminada en azul Margube. En oscuro son de obsidiana densa; en claro, de cristal lechoso sobre una bruma azul pálida. El fondo es fijo: la luz azul entra por arriba a la izquierda, hay un rebote verde azulado abajo a la derecha, las esquinas caen a negro y se ven la hoja Margube tenue y una retícula de puntos. El fondo nunca se anima. Si existe `public/wallpaper.jpg`, se usa como foto de fondo. Los colores siguen siendo los de Margube: no se usa el ámbar de las maquetas de referencia.

**Color.** Usa siempre los tokens (`var(--…)`), nunca valores sueltos.

| Token | Claro | Oscuro |
|---|---|---|
| `--accent` | `#2F5BEA` (hover `#1E40AF`) | `#7AA2FF` |
| `--accent-light` | `#5B7CFF` | `#C3D1FF` |
| `--text` / `--text-sec` / `--text-mut` | `#11141B` / `#4A5263` / `#8D95A3` | `#F5F6F8` / `#B8BEC9` / `#8D95A3` |
| `--success` / `--warning` / `--danger` / `--info` | `#059669` / `#D97706` / `#E11D48` / `#0284C7` | `#34D399` / `#F5B544` / `#FB7185` / `#5EE0D5` |
| Fondo de la página (canvas) | `#DEEBF6` | `#0A1321` |

Acentos analíticos: `--teal` (`#0E9F9A` / `#2DD4BF`) para crecimiento y segunda serie, y `--violet` (`#7C3AED` / `#A78BFA`) para una tercera. Nunca son el color principal de una sección. Cada color semántico tiene su variante `-bg` para fondos suaves.

**Superficies.** Usa los mixins de `_patterns.scss`:
- `p.surface` / `p.glass` para las tarjetas: fondo `var(--lg-sheen), var(--lg-fill)`, un borde iluminado desde arriba (`--lg-edge-top` → `--lg-edge` → `--lg-edge-bottom`), brillo `inset 0 1px 0 var(--lg-rim)`, sombra suave `--lg-shadow`, desenfoque `--lg-card-blur` (26–28 px) y radio de 24 px.
- `p.well` para un módulo dentro de una tarjeta (filas, campos, cifras pequeñas): un hueco hundido, sin desenfoque.
- `p.spotlight` para el destacado de la página (por ejemplo, el saludo del Inicio): cristal con baño de azul Margube y un resplandor (`--lg-spot`, `--lg-spot-edge`, `--lg-spot-glow`). Se adapta a los dos temas.
- `p.brand-panel` / `p.cover`: obsidiana iluminada en azul desde la esquina, con rebote verde azulado y texto blanco en ambos temas. Solo un destacado por página. Su antetítulo es una píldora en mayúsculas.
- `p.glass-chrome` para la cabecera, los popovers y los cajones: el mismo cristal con un desenfoque real de fondo.
- `p.liquid` para la píldora de secciones del iPad y el dock del móvil: desenfoque de 40 px, reflejo arriba, borde brillante y un punto de luz.
- Menús, dock y menú lateral: cristal denso (`--lg-popover`, 94–95 %) para que se lean sobre el contenido. Los modales y los avisos (toasts) son sólidos.

**Tipografía.**
- Inter para el texto: 14 px / 1,6, con `font-feature-settings: 'cv02','cv03','cv04','cv11','ss01'`.
- Poppins (500–700) para los encabezados, con espaciado negativo (−0,02 a −0,03 em).
- Título de sección: `clamp(18px, 1.5vw, 21px)` a 600. Título de portada: `clamp(28px, 4.6vw, 36px)`.
- Las cifras van con `font-variant-numeric: tabular-nums`.

**Forma y espaciado.**
- Botones, pestañas, chips y contadores en píldora (`--radius-full`). Tarjetas con radio de 24 px, módulos interiores de 16–18 px y destacados de 28 px.
- Los avatares de personas usan la forma de hoja Margube (`--shape-leaf: 60% 12% 60% 12%`).
- Los inputs miden 46 px de alto. El espaciado sigue una escala de 4 px (`--space-1` … `--space-20`).

**Componentes recurrentes.**
- Pestañas segmentadas (`p.tabs-row`, `p.tab-btn`, `p.tab-btn-active`): una pista de cristal en la que la pestaña activa es una píldora sólida del color de acento con sombra azul, y cada pestaña lleva su contador.
- Antetítulo en píldora (`p.eyebrow-pill`): mayúsculas a 11 px con espaciado de 0,08 em y un punto luminoso. Abre cada cabecera de página.
- KPIs (`StatCard`, `DeskMetrics`): etiqueta en mayúsculas, cifra grande y una pista. Si la tarjeta navega, lleva un ↗ en un círculo en la esquina; la línea de tendencia tiene un área suave debajo, y una barra corta y luminosa del color del dato va en el borde inferior.
- Rejilla de KPIs (`p.stat-grid`): 3 columnas en escritorio y 2 en el móvil; si queda una tarjeta suelta, ocupa toda la fila.
- Kit de escritorio (`components/Desk.jsx`): `DeskHeader` con `kicker` (antetítulo de contexto: «Portal del empleado · Trámites»), `DeskTabs` (pestañas o secciones en píldoras con contador y punto de aviso; sustituyen a la antigua columna lateral), `DeskGauge` (KPI con barra de progreso y chip de icono, que puede filtrar), `DeskChips` (filtros de estado) y `DeskMetrics`. Composición de cada página: cabecera, pestañas, una fila de destacado y cifras, y el panel principal a todo el ancho.
- Gráficas de barras en cápsula: las barras normales en marfil translúcido y la destacada (hoy, esta semana) en degradado azul, con su cifra en una pastilla flotante.
- Tablas: cabeceras en mayúsculas apagadas, sin líneas gruesas, y un baño azul suave al pasar el ratón por una fila.
- Botón principal con `--gradient-cta` (90°, de `#2F5BEA` a `#5B7CFF`) y `--shadow-cta`.

**Movimiento.**
- Curva `--ease-out` (`cubic-bezier(0.16, 1, 0.3, 1)`) con duraciones de 120–280 ms. Al pulsar, `scale(0.97)`.
- Muelles (springs) con Framer Motion. Respeta `prefers-reduced-motion`.
- El hover va solo dentro de `@media (hover: hover) and (pointer: fine)`.
- Anima solo transform y opacity. Nada se mueve de forma decorativa.

**Iconos.** lucide-react, con un trazo coherente con el resto de la interfaz.

**Accesibilidad.**
- Foco visible con `--accent-glow`.
- Etiquetas asociadas a cada campo y `aria-required` en los obligatorios.
- Los modales capturan el foco, se cierran con Escape y devuelven el foco a quien los abrió.
- Enlace «Saltar al contenido principal».
- El contraste se comprueba en los dos temas.

**Móvil y Safari.**
- `viewport-fit=cover` y márgenes `safe-area-inset-*`.
- Alturas mínimas en `svh`.
- El tema se aplica antes del primer pintado, para que no haya destello.
- Sin `-webkit-tap-highlight-color` y con `touch-action: manipulation`.

## 5. Reglas de UX

- Toda vista tiene cuatro estados: carga (Skeleton), vacío (EmptyState con un mensaje útil), error (ErrorState con el motivo real, no un genérico «revisa tu conexión») y contenido.
- Rechazar, cancelar o borrar pide confirmación (ConfirmModal), muestra estado de carga y no admite doble clic. Un formulario con error se queda abierto y muestra el error.
- Cuando un admin cambia algo, la persona afectada recibe un aviso que dice qué cambió, cuándo y el resultado. Nadie se avisa a sí mismo.
- No uses datos inventados en la interfaz final.

## 6. Cómo trabajar

1. Reutiliza los tokens, los mixins y los componentes de `ui/` antes de crear nada nuevo.
2. Diseña las versiones de escritorio y táctil, en tema claro y oscuro.
3. Pon la lógica de datos en `shared/services` si la app móvil también la va a necesitar.
4. Toda tabla nueva en Supabase lleva RLS activado y políticas que filtren por dueño o rol, en una migración.
5. Al terminar, ejecuta `npm run build` y `npm test`.

## Tarea

[Describe aquí lo que quieres que haga]
