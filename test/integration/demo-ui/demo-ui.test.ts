import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import supertest from "supertest";
import { buildApp } from "../../../src/api/server";
import { pool } from "../../../src/shared/db";

describe("Demo UI static page (TASK-15)", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  it("serves the demo page with 200 and HTML content-type, with no Authorization header", async () => {
    const res = await supertest(app.server).get("/");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/html/);
    expect(res.text).toContain("<title>Smart Office — Booking Demo</title>");
  });

  it("still requires a bearer token on GET /availability after the route reordering", async () => {
    const res = await supertest(app.server).get("/availability").query({
      officeId: "00000000-0000-4000-8000-000000000001",
      resourceType: "Desk",
      date: "2026-01-10",
    });

    expect(res.status).toBe(401);
  });

  it("still requires a bearer token on POST /bookings after the route reordering", async () => {
    const res = await supertest(app.server)
      .post("/bookings")
      .send({ resourceId: "00000000-0000-4000-a000-000000000001", bookingDate: "2026-01-10" });

    expect(res.status).toBe(401);
  });
});
