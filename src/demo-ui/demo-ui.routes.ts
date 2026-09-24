import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";

const DEMO_PAGE_PATH = join(__dirname, "../../public/index.html");

export function registerDemoUiRoutes(app: FastifyInstance): void {
  const html = readFileSync(DEMO_PAGE_PATH, "utf-8");

  app.get("/", async (_request, reply) => {
    return reply.type("text/html").send(html);
  });
}
