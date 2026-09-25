import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { parseCheckInEvent, InvalidCheckInEventError } from "../checkin-contract";
import { sendCheckinEvent } from "../../shared/queue";
import { getCheckinAdapter } from "./registry";
import { UnknownProviderError, InvalidProviderCredentialError } from "./errors";

const CREDENTIAL_HEADER = "x-provider-api-key";

interface ProviderParams {
  provider: string;
}

export function registerCheckinIngressRoutes(app: FastifyInstance): void {
  app.post(
    "/integrations/checkin/:provider",
    async (request: FastifyRequest<{ Params: ProviderParams }>, reply: FastifyReply) => {
      const { provider } = request.params;

      const adapter = getCheckinAdapter(provider);
      if (!adapter) {
        const err = new UnknownProviderError(provider);
        return reply.status(404).send({ error: "not_found", message: err.message });
      }

      const credential = request.headers[CREDENTIAL_HEADER];
      const credentialValue = Array.isArray(credential) ? credential[0] : credential;
      if (!adapter.validateCredential(credentialValue)) {
        const err = new InvalidProviderCredentialError(provider);
        return reply.status(401).send({ error: "unauthorized", message: err.message });
      }

      let event;
      try {
        event = adapter.translate(request.body);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Invalid payload.";
        return reply.status(400).send({ error: "bad_request", message });
      }

      try {
        event = parseCheckInEvent(event);
      } catch (err) {
        if (err instanceof InvalidCheckInEventError) {
          request.log?.error?.(err);
          return reply.status(500).send({
            error: "internal_error",
            message: "Adapter produced a malformed canonical event.",
          });
        }
        throw err;
      }

      await sendCheckinEvent(event);

      return reply.status(202).send({ status: "accepted" });
    },
  );
}
