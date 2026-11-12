# Margube en móvil

La dirección combina las dos referencias aportadas: reservas en tarjetas horizontales,
resumen en dos columnas y navegación compacta de la primera; superficies de cristal
ahumado y capas discretas de la segunda. Se conserva el azul Margube, el logotipo,
los temas y la configuración de transparencia.

En la web, la nueva composición de Inicio solo aparece por debajo de 768 px.
Las pantallas de escritorio y tablet conservan su composición. La app usa los mismos
criterios con controles nativos, áreas seguras y desplazamiento horizontal de reservas.

- Una reserva destacada en azul; las demás se leen en superficies neutras.
- Nombres visibles en las cinco pestañas, además de los iconos y contadores.
- Fondos suaves en claro y cristal ahumado en oscuro para facilitar la lectura.
- Reservas, saldo, solicitudes y jornada usan los datos y servicios existentes.
- Estados vacíos con una acción real; no se añaden datos de demostración al producto.
- Radios de 20–22 px y separaciones de 10–22 px, siguiendo las referencias.

La revisión visual web utiliza contextos locales de prueba, con y sin reservas, en
320, 390, 430, 768 y 1440 px, con ambos temas. También se revisan las pantallas de
reservas, solicitudes y horas. La exportación Android y las comprobaciones de código
no sustituyen una revisión visual y táctil en un dispositivo iOS o Android.

El liquid glass se conserva como material: reservas destacadas y barra inferior
translúcidas con desenfoque, bordes de luz y el fondo visible a través de las capas.
En iOS compatible se reutiliza el material nativo. Sin efecto y Reducir transparencia
continúan mostrando superficies opacas.

La web y la app mantienen la misma fotografía de oficina como fondo, visible
a través de las superficies liquid glass. La capa de contraste se adapta a cada tema.

El material web reproduce los valores de la app: opacidad por intensidad y tema,
reflejo hasta el 55 % de la superficie, borde fino con luz superior y tarjetas sin
sombra exterior añadida. Reservas y navegación usan el mismo tinte variable que
la app. El navegador lo representa con CSS y `backdrop-filter`; iOS conserva su
implementación nativa cuando está disponible.

## Deslizar por el dock

En web y app, mantener pulsada una pestaña durante 250 ms permite deslizar el
indicador por la barra. La sección señalada se abre al soltar. Alejar el dedo más
de 32 px de la barra o una interrupción cancela la selección. En web también se
puede cancelar con Escape. Se conservan los toques normales, el teclado, los
contadores y el botón independiente de nueva solicitud.

La app usa Gesture Handler y Reanimated para seguir el dedo en el hilo de interfaz;
solo la confirmación de navegación pasa a JavaScript. Estas dependencias nativas
requieren una nueva compilación de la app, no únicamente una actualización OTA.

Intenso conserva la familia de material `regular` en iOS: antes cambiaba a `clear`,
lo que alteraba el aspecto respecto a los otros niveles y la web. La refracción
nativa puede seguir variando respecto a la representación CSS del navegador.

La geometría y los colores del dock se definen una sola vez en `shared/config/dock.js`:
barra de 64 px/pt, botón azul de 48 px/pt, margen lateral de 16, separación inferior
de 12 más el área segura, iconos de 20 y el mismo indicador de selección y arrastre.
La web y la app consumen estos valores compartidos.
