---
version: 1
slug: "src-app-tsx"
primary_target: "src/App.tsx"
related_targets: ["src/components/Layout.jsx"]
---

# Intranet web · todas las pantallas

Scope: toda la web (React + Vite), no la app Expo. Mode: Operate.
Audience: plantilla de Margube y RR. HH.; trámites breves en oficina y en el móvil. Job: reservar, pedir, registrar, ver quién está, revisar.
Constraints: PRODUCT.md (etiquetas visibles, cuatro estados, WCAG 2.2 AA en ambos temas, logo/hoja y azul #2F5BEA). Lógica en shared/services intacta.
User pin: la persona pidió en palabras inspirarse en un reel de dashboard (fondo claro con lavado suave, paneles blancos flotantes, raíl oscuro redondeado, tarjeta de bienvenida oscura con palabra en cursiva serif, cifras que cuentan, entradas escalonadas con desenfoque, revelado circular). Supera a la tirada. Traducción: el verde bosque del reel pasa a tinta azul Margube; el melocotón queda como acento cálido.
Unresolved: ninguno.

## Direction contract

THESIS: Una intranet que se siente como un estudio luminoso: paneles blancos que flotan sobre un lavado de luz azul y albaricoque, anclados por un raíl de tinta. Rechaza el cristal ahumado sobre foto y la retícula gris de tarjetas iguales.

OWN-WORLD: Suelo con lavado radial (azul hielo #E6ECFB a melocotón #FBEADF) sobre #F4F6FA; paneles blancos opacos radio 20, borde 1px rgba tinta 6%, sombra suave con desplazamiento. Tinta #0E1838 para el raíl flotante y la tarjeta de bienvenida; azul Margube #2F5BEA para acciones; albaricoque #F2A07B para series y realces. Geist para la interfaz, cifras tabulares; Instrument Serif cursiva solo en una palabra del saludo y del acceso. Tema oscuro: suelo #0A0F1E, paneles #121A2E.

STORY: Al entrar, la persona ve su día (saludo, jornada, agenda) y la acción más frecuente a un toque; sabe quién está y qué está libre sin buscar; cada trámite confirma su estado en palabras.

FIRST VIEWPORT: Raíl de tinta flotante a la izquierda con secciones con nombre. Cabecera clara con buscador y «Nuevo». Inicio: tarjeta de tinta ancha con «Buenas tardes, *Nombre*», jornada y avatares de quién está en la oficina, CTA albaricoque «Nueva reserva»; a la derecha, tira de la semana con hoy marcado. Debajo, fila de cifras (reservas hoy, pendientes, bolsa de horas, equipo) y gráfica de barras albaricoque con la barra actual en tinta.

FORM: Pin del usuario (reel de referencia) sobre la tirada; seed:9b045a44308c7bf2. Firma: revelado circular desde la hoja al entrar en la app y paneles que llegan escalonados de desenfoque a nítido; cifras que cuentan.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
