import Fastify, {
  type FastifyInstance,
  type FastifyError,
  type FastifyReply,
  type FastifyRequest,
} from "fastify";
import { SystemClock, type Clock } from "../shared/clock";
import { registerAuth } from "../shared/auth";
import { registerBookingRoutes } from "../modules/booking/booking.routes";

export function buildApp(clock: Clock = new SystemClock()): FastifyInstance {
  const app = Fastify({ logger: false });

  registerAuth(app);
  registerBookingRoutes(app, clock);

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
