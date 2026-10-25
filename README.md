This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Operación de la barbería

Copiá `.env.example` como `.env.local` y configurá `MONGODB_URI`, `ADMIN_SESSION_SECRET`, `ADMIN_INITIAL_EMAIL`, `ADMIN_INITIAL_PASSWORD`, `DEFAULT_TENANT_SLUG` y `NEXT_PUBLIC_SITE_URL`. En una instalación nueva, las credenciales iniciales se usan solo para crear el administrador; después la contraseña queda almacenada como hash.

```bash
npm run dev
npm test
npm run lint
npm run build
```

`npm test` ejecuta un smoke test sin crear turnos. También acepta `BASE_URL` para verificar otro entorno. Después de publicar, comprobá `GET /api/health` y conservá backups de MongoDB con un procedimiento probado de restauración.

Para migrar una instalación single-tenant a multi-tenant, ejecutá primero `npm run migrate:multi-tenant` para revisar el dry-run. Aplicá la migración únicamente contra una base de desarrollo aislada usando `SUPERADMIN_PASSWORD` en el entorno del proceso y `npm run migrate:multi-tenant -- --apply`.

No publiques secretos, cookies, contraseñas ni la URI de MongoDB en commits, logs o mensajes.
