import Fastify, {
  type FastifyInstance,
  type FastifyError,
  type FastifyReply,
  type FastifyRequest,
} from "fastify";
import { SystemClock, type Clock } from "../shared/clock";
import { registerAuth } from "../shared/auth";
import { registerBookingRoutes } from "../modules/booking/booking.routes";
import { registerDemoUiRoutes } from "../demo-ui/demo-ui.routes";
import { registerCheckinIngressRoutes, registerCheckinAdapter } from "../modules/checkin-ingress";
import { appQrAdapter } from "../modules/checkin-ingress/adapters/app-qr.adapter";
import { testHarnessAdapter } from "../modules/checkin-ingress/adapters/test-harness.adapter";

export function buildApp(clock: Clock = new SystemClock()): FastifyInstance {
  const app = Fastify({ logger: false });

  // The demo page and the Check-in Ingress API are registered directly on
  // the root instance so they stay reachable without an employee bearer
  // token. The Ingress uses its own per-provider credential check (HLD
  // §7.1: "never Entra ID") — a separate trust boundary from employee auth,
  // so it must not sit behind the onRequest hook below. Auth and the
  // booking routes are registered inside an encapsulated child context so
  // that hook applies only to them, not to the whole app.
  registerDemoUiRoutes(app);
  registerCheckinAdapter(appQrAdapter);
  registerCheckinAdapter(testHarnessAdapter);
  registerCheckinIngressRoutes(app);
  app.register(async (protectedApp) => {
    registerAuth(protectedApp);
    registerBookingRoutes(protectedApp, clock);
  });

  app.setErrorHandler((err: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    if (err.validation) {
      return reply.status(400).send({ error: "bad_request", message: err.message });
    }
    request.log?.error?.(err);
    return reply.status(500).send({ error: "internal_error", message: "Unexpected server error." });
  });

  return app;
}

if (require.main === module) {
  const port = Number(process.env.PORT ?? 3000);
  buildApp()
    .listen({ port, host: "0.0.0.0" })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
