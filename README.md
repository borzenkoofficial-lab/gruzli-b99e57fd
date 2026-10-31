# GRUZLI

GRUZLI — mobile-first marketplace for the workflow «Заказчик → Диспетчер → Грузчик».

## Migration branch

This branch migrates the application from Supabase to an Amvera-hosted Node.js API and PostgreSQL database. The migration is a clean start: legacy Supabase users and records are not imported. Existing product screens and business flows must be preserved while their data access is moved to the new API.

The frontend still contains legacy Supabase call sites at this stage. Do not deploy this branch as the public production version until the frontend migration and end-to-end acceptance tests are complete.

## Local development

Install dependencies and run Vite:

    npm install
    npm run dev

Run the API separately:

    npm run dev:server

The API listens on port 3000 by default. The Vite frontend listens on port 8080. Configure a local PostgreSQL instance and set DATABASE_URL for database-backed tests.

## Amvera

Amvera builds the Dockerfile, compiles the Vite frontend, and starts the Node.js API server. The server serves the frontend and API from one origin.

Required Amvera variable for database-backed operation: DATABASE_URL (PostgreSQL connection string). Alternatively use PGHOST, PGPORT, PGDATABASE, PGUSER, and PGPASSWORD.

The persistent Amvera mount is /data for future uploaded files and generated documents. PostgreSQL is a separate managed service and is not stored in the application container.

## API foundation

- GET /api/health — application health.
- GET /api/health/db — database readiness.
- POST /api/auth/register — account creation.
- POST /api/auth/login — sign in.
- GET /api/auth/me — current cookie session.
- POST /api/auth/logout — revoke current session.

Session tokens are random opaque values; only SHA-256 hashes are stored in PostgreSQL. Session cookies are HttpOnly. Passwords are hashed with Node.js scrypt. Never expose database credentials to Vite or commit production secrets.

## Validation

    npm run lint
    npm test
    npm run build
    npm run typecheck
