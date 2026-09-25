import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import supertest from "supertest";
import { buildApp } from "../../../src/api/server";
import { pool } from "../../../src/shared/db";
import { stopQueue, CHECKIN_EVENTS_QUEUE } from "../../../src/shared/queue";
import {
  registerCheckinAdapter,
  unregisterCheckinAdapter,
  type CheckinAdapter,
} from "../../../src/modules/checkin-ingress";
import { InvalidCheckInEventError, type CheckInEvent } from "../../../src/modules/checkin-contract";

const STUB_PROVIDER = "task06-stub";
const STUB_SECRET = "task06-stub-secret";

interface StubPayload {
  eventId?: string;
  reference?: string;
  scannedAt?: string;
}

const stubAdapter: CheckinAdapter = {
  provider: STUB_PROVIDER,
  validateCredential(credential) {
    return credential === STUB_SECRET;
  },
  translate(payload): CheckInEvent {
    const body = (payload ?? {}) as StubPayload;
    if (!body.eventId || !body.reference || !body.scannedAt) {
      throw new InvalidCheckInEventError(
        "<stub-payload>",
        "must include eventId, reference, scannedAt",
      );
    }
    return {
      sourceSystem: STUB_PROVIDER,
      externalEventId: body.eventId,
      subjectReference: body.reference,
      occurredAt: body.scannedAt,
      receivedAt: new Date().toISOString(),
    };
  },
};

const VALID_PAYLOAD: StubPayload = {
  eventId: "stub-evt-1",
  reference: "stub-ref-1",
  scannedAt: "2026-01-10T08:00:00.000Z",
};

const UNDEFINED_TABLE = "42P01";

function isUndefinedTable(err: unknown): boolean {
  return (
    typeof err === "object" && err !== null && (err as { code?: unknown }).code === UNDEFINED_TABLE
  );
}

async function deleteStubJobs(): Promise<void> {
  try {
    await pool.query(`DELETE FROM pgboss.job WHERE name = $1 AND data->>'externalEventId' = $2`, [
      CHECKIN_EVENTS_QUEUE,
      VALID_PAYLOAD.eventId,
    ]);
  } catch (err) {
    // pg-boss creates its schema/table lazily on first enqueue; nothing to
    // clean up if this is the very first run against a fresh database.
    if (!isUndefinedTable(err)) throw err;
  }
}

describe("Check-in Ingress API", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    registerCheckinAdapter(stubAdapter);
    app = buildApp();
    await app.ready();
    // Clean slate: a prior run of this same suite may have left a queued
    // job with this fixed eventId behind (pg-boss has no content-based
    // dedup), which would otherwise make the enqueue assertion below flaky.
    await deleteStubJobs();
  });

  afterAll(async () => {
    unregisterCheckinAdapter(STUB_PROVIDER);
    await deleteStubJobs();
    await app.close();
    await stopQueue();
    await pool.end();
  });

  describe("unknown provider", () => {
    it("returns 404 for a provider with no registered adapter", async () => {
      const res = await supertest(app.server)
        .post("/integrations/checkin/not-a-real-provider")
        .send(VALID_PAYLOAD);

      expect(res.status).toBe(404);
    });
  });

  describe("provider credential check (AC-2)", () => {
    it("rejects a request with no credential header", async () => {
      const res = await supertest(app.server)
        .post(`/integrations/checkin/${STUB_PROVIDER}`)
        .send(VALID_PAYLOAD);

      expect(res.status).toBe(401);
    });

    it("rejects a request with an invalid credential", async () => {
      const res = await supertest(app.server)
        .post(`/integrations/checkin/${STUB_PROVIDER}`)
        .set("x-provider-api-key", "wrong-secret")
        .send(VALID_PAYLOAD);

      expect(res.status).toBe(401);
    });
  });

  describe("payload validation", () => {
    it("returns 400 when the adapter rejects the payload shape", async () => {
      const res = await supertest(app.server)
        .post(`/integrations/checkin/${STUB_PROVIDER}`)
        .set("x-provider-api-key", STUB_SECRET)
        .send({});

      expect(res.status).toBe(400);
    });
  });

  describe("enqueue and 202 (AC-3)", () => {
    it("enqueues a canonical CheckInEvent and returns 202 for a valid stub submission", async () => {
      const res = await supertest(app.server)
        .post(`/integrations/checkin/${STUB_PROVIDER}`)
        .set("x-provider-api-key", STUB_SECRET)
        .send(VALID_PAYLOAD);

      expect(res.status).toBe(202);

      const { rows } = await pool.query<{ data: CheckInEvent }>(
        `SELECT data FROM pgboss.job WHERE name = $1 AND data->>'externalEventId' = $2`,
        [CHECKIN_EVENTS_QUEUE, VALID_PAYLOAD.eventId],
      );

      expect(rows).toHaveLength(1);
      expect(rows[0]!.data).toMatchObject({
        sourceSystem: STUB_PROVIDER,
        externalEventId: VALID_PAYLOAD.eventId,
        subjectReference: VALID_PAYLOAD.reference,
        occurredAt: VALID_PAYLOAD.scannedAt,
      });
    });
  });
});
