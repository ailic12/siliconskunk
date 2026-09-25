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
import { registerCheckinGatewayWorker } from "../modules/checkin-gateway";
import { runReleaseSweep } from "../modules/release-engine";
import { runNotificationWorker, FakeNotificationChannel } from "../modules/notification";

const DEFAULT_RELEASE_SWEEP_INTERVAL_MS = Number(process.env.RELEASE_SWEEP_INTERVAL_MS ?? 5000);
const DEFAULT_NOTIFICATION_WORKER_INTERVAL_MS = Number(
  process.env.NOTIFICATION_WORKER_INTERVAL_MS ?? 5000,
);

export interface StartAppOptions {
  clock?: Clock;
  port?: number;
  sweepIntervalMs?: number;
  notificationWorkerIntervalMs?: number;
  /**
   * Demo-only, boot-time control (TASK-18): forces the mocked notification
   * provider to always fail, letting a test or a locally-restarted process
   * deterministically exercise the retry/backoff and terminal-failure paths.
   * No HTTP exposure — set via NOTIFICATION_DEMO_FORCE_FAIL or this option.
   */
  forceNotificationFailure?: boolean;
}

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

/**
 * Single code path for "the application is running" (TASK-17, human-approved
 * PoC-scoped simplification of the plan's separate api/worker process split,
 * §1 decision 11): builds the app, starts listening, then wires in the two
 * already-implemented, already-tested background consumers that nothing
 * previously invoked outside test files — the Check-in Gateway worker
 * (TASK-08) and a periodic Release Engine sweep (TASK-09). buildApp() alone
 * (used by every existing test) still starts neither, so the 85 pre-existing
 * tests are unaffected; only startApp() — used identically by
 * `npm run start:api` and by the black-box startup integration test — does.
 */
export async function startApp(options: StartAppOptions = {}): Promise<FastifyInstance> {
  const clock = options.clock ?? new SystemClock();
  const port = options.port ?? Number(process.env.PORT ?? 3000);
  const sweepIntervalMs = options.sweepIntervalMs ?? DEFAULT_RELEASE_SWEEP_INTERVAL_MS;
  const notificationWorkerIntervalMs =
    options.notificationWorkerIntervalMs ?? DEFAULT_NOTIFICATION_WORKER_INTERVAL_MS;
  const forceNotificationFailure =
    options.forceNotificationFailure ?? process.env.NOTIFICATION_DEMO_FORCE_FAIL === "true";

  const app = buildApp(clock);
  await app.listen({ port, host: "0.0.0.0" });

  await registerCheckinGatewayWorker();
  // unref: this timer alone must never keep the process (or a test runner)
  // alive — the listening server socket (and pg-boss's own worker loop) are
  // what actually keep a real `npm run start:api` process running.
  setInterval(() => {
    runReleaseSweep(clock).catch((err) => app.log?.error?.(err));
  }, sweepIntervalMs).unref();

  const notificationChannel = new FakeNotificationChannel(
    forceNotificationFailure ? { shouldFail: () => true } : {},
  );
  setInterval(() => {
    runNotificationWorker(clock, notificationChannel).catch((err) => app.log?.error?.(err));
  }, notificationWorkerIntervalMs).unref();

  return app;
}

if (require.main === module) {
  startApp().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
