---
name: barberia-ops
description: Trabaja de forma segura en barberia-web, separando cambios locales, estado del repositorio y producción, con verificaciones proporcionales para Next.js, APIs, MongoDB y el panel de turnos.
---

# Operaciones seguras — Barbería

Usar esta skill para cambios de código, configuración, API, base de datos, despliegue o verificación del proyecto `barberia-web`.

## Reglas operativas

- Leer `AGENTS.md` antes de editar y revisar primero `git status --short --branch`.
- Preservar cambios existentes del usuario; no usar `git reset --hard`, `git checkout --` ni borrar archivos para resolver problemas sin autorización explícita.
- Mantener separadas tres evidencias: resultado local, estado de Git/remoto y resultado en producción.
- No pedir ni imprimir credenciales, tokens, URI de MongoDB, PIN administrativo o secretos de Cloudinary.
- No desplegar, migrar datos, cambiar DNS ni modificar variables de producción salvo pedido explícito.
- No llamar "publicado" o "verificado en producción" a un resultado obtenido solamente en local.

## Cambios en datos y APIs

- Revisar rutas públicas y administrativas antes de modificar modelos o consultas.
- Mantener las validaciones de disponibilidad en el servidor; el cliente solo presenta y solicita acciones.
- Para datos de prueba, usar nombres y teléfonos sintéticos y registrar exactamente qué se creó.
- Nunca limpiar con `deleteMany({})` ni por una colección completa. Eliminar únicamente IDs de prueba previamente identificados.
- Evitar cambios destructivos en turnos, configuraciones, imágenes o fechas bloqueadas sin confirmar el alcance.

## Verificación proporcional

Para cambios de frontend, servidor o modelos:

1. `git diff --check`
2. `npm run lint`
3. `npm run build`
4. Probar las rutas afectadas y el flujo visible correspondiente cuando exista servidor local.

Si MongoDB, Cloudinary o una dependencia externa no está disponible, informar la limitación y no presentarla como prueba superada.

## Reporte final

Informar primero el resultado. Luego indicar:

1. qué se inspeccionó o modificó;
2. qué comandos y pruebas pasaron o fallaron;
3. si la evidencia es local, del repositorio o de producción;
4. qué queda pendiente y cuál es el siguiente paso seguro.

No incluir secretos, cookies, tokens, PIN ni valores completos de variables de entorno.
