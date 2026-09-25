import { join } from "node:path";
import fastifyStatic from "@fastify/static";
import type { FastifyInstance } from "fastify";

const PUBLIC_DIR = join(__dirname, "../../public");

/**
 * Serves the built React SPA (TASK-17; replaces TASK-15's single
 * readFileSync'd static HTML file with a real Vite build output) from the
 * same public/ directory, at the same unauthenticated same-origin root the
 * demo page has always been served from (server.ts registers this route
 * outside the employee-auth child context, unchanged).
 */
export function registerDemoUiRoutes(app: FastifyInstance): void {
  app.register(fastifyStatic, {
    root: PUBLIC_DIR,
    index: ["index.html"],
  });
}
