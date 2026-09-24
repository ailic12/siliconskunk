# siliconskunk test

Smart Office Camp PoC.

## Local development

1. Copy `.env.example` to `.env`.
2. Start Postgres: `docker compose up -d`
3. Install dependencies: `npm install`
4. Run migrations: `npm run migrate`
5. Run tests: `npm test`
6. Lint and format check: `npm run lint && npm run format:check`
