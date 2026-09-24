import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { resolveIdentityFromToken, type Identity } from "./identity";

declare module "fastify" {
  interface FastifyRequest {
    identity: Identity;
  }
}

const BEARER_PREFIX = "Bearer ";

function extractToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (!header || !header.startsWith(BEARER_PREFIX)) return null;
  const token = header.slice(BEARER_PREFIX.length).trim();
  return token.length > 0 ? token : null;
}

export function registerAuth(app: FastifyInstance): void {
  app.addHook("onRequest", async (request: FastifyRequest, reply: FastifyReply) => {
    const token = extractToken(request);
    const identity = token ? await resolveIdentityFromToken(token) : null;

    if (!identity) {
      await reply.status(401).send({
        error: "unauthorized",
        message: "A valid dev bearer token is required.",
      });
      return;
    }

    request.identity = identity;
  });
}
