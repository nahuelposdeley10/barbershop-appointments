---
name: experiencia-usuario-final
description: Diseña, revisa y mejora la experiencia de clientes, barberos y administradores en la web de turnos de la barbería. Usar al modificar pantallas, formularios, calendario, panel, mensajes, responsive o accesibilidad.
---

# Experiencia de usuario final — Barbería

Aplicar esta skill cuando se trabaje sobre una pantalla visible o un flujo que complete una persona. El objetivo es que reservar un turno y administrarlo sea claro, rápido y confiable en celular y escritorio.

## Usuarios y tareas principales

- Cliente: conocer la barbería, elegir servicio, consultar disponibilidad y reservar sin perder los datos.
- Barbero o administrador: ver los turnos del día, confirmar, cancelar, marcar como realizado y actualizar la información del local.
- Visitante: entender qué ofrece el local, dónde está y cómo contactarlo.

## Principios

1. Mostrar siempre dónde está el usuario, qué puede hacer y qué ocurre después.
2. Usar lenguaje claro de Argentina: "Reservar turno", "Guardar cambios", "Cancelar turno".
3. Mantener una acción principal por contexto y diferenciar acciones destructivas.
4. Mostrar estados reales de carga, vacío, error y éxito; no confirmar antes de la respuesta del servidor.
5. Conservar los datos ingresados si una petición falla y prevenir doble envío.
6. Usar etiquetas visibles, foco de teclado, contraste suficiente y objetivos táctiles cómodos.
7. Priorizar móvil: calendario, horarios, formularios y botones deben funcionar sin scroll horizontal.
8. No cambiar reglas de disponibilidad ni estados de turnos desde la interfaz sin respetar la API.

## Criterios por flujo

### Reserva

- Indicar claramente el servicio, duración, precio, fecha y horario elegido.
- Diferenciar horarios libres, ocupados, no disponibles y fechas bloqueadas.
- Validar nombre, teléfono, servicio, fecha y horario junto al campo correspondiente.
- Deshabilitar el envío mientras se procesa y mostrar una confirmación con los datos del turno.
- Si el horario deja de estar disponible, explicar el conflicto y permitir elegir otro.

### Panel administrativo

- Mostrar el día y el estado de cada turno sin exigir memoria al usuario.
- Hacer visibles las acciones frecuentes: confirmar, cancelar y marcar realizado.
- Separar configuración del local, servicios, horarios, imágenes y turnos.
- Confirmar eliminaciones y explicar sus consecuencias.
- Mantener feedback después de guardar y no perder cambios ante un error.

### Sitio público

- Hacer evidentes nombre, servicios, ubicación, WhatsApp/redes y llamada a reservar.
- Mantener coherencia entre el nombre mostrado, el título del documento y la configuración guardada.
- Evitar contenido decorativo que compita con la reserva o dificulte la lectura.

## Validación antes de cerrar un cambio

- Probar escritorio y móvil cuando el entorno lo permita.
- Revisar carga, vacío, error, éxito, datos inválidos y doble clic.
- Verificar navegación por teclado y etiquetas de formularios.
- Ejecutar `git diff --check` y `npm run build`.
- Informar qué se verificó localmente y qué no pudo probarse.

## Límites

- No introducir multi-tenant, roles complejos, pagos ni dependencias nuevas por una mejora visual.
- No reemplazar la validación del servidor por validación solamente en React.
- No afirmar que un turno se creó, modificó o canceló hasta recibir confirmación de la API.
