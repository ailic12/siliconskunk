import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pool } from "../../../src/shared/db";
import { runSeed } from "../../../db/seed";
import { offices } from "../../../db/seed/offices";
import { resources } from "../../../db/seed/resources";
import { policies } from "../../../db/seed/policies";
import { employees } from "../../../db/seed/employees";

async function countRows(table: string, where?: string): Promise<number> {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS count FROM ${table}${where ? ` WHERE ${where}` : ""}`,
  );
  return rows[0].count;
}

/**
 * Deletes exactly this seed module's own fixed-id rows (FK-safe order), so
 * the test starts from a known-clean slate without invoking node-pg-migrate
 * itself. Running migrations here would race with other integration test
 * files' own migrate up/down cycles against the same real Postgres instance
 * (node-pg-migrate's advisory lock fails fast rather than queuing) — this
 * test instead assumes migrations have already been applied (TASK-02's own
 * test, or `npm run migrate`, is responsible for that).
 */
async function deleteSeedRows(): Promise<void> {
  const employeeIds = employees.map((e) => e.id);
  const officeIds = offices.map((o) => o.id);
  const resourceIds = resources.map((r) => r.id);
  const policyIds = policies.map((p) => p.id);

  await pool.query("DELETE FROM dev_bearer_token WHERE employee_id = ANY($1::uuid[])", [
    employeeIds,
  ]);
  await pool.query("DELETE FROM external_mapping WHERE source_system = 'app-qr'");
  await pool.query("DELETE FROM employee WHERE id = ANY($1::uuid[])", [employeeIds]);
  await pool.query("DELETE FROM policy WHERE id = ANY($1::uuid[])", [policyIds]);
  await pool.query("DELETE FROM resource WHERE id = ANY($1::uuid[])", [resourceIds]);
  await pool.query("DELETE FROM office WHERE id = ANY($1::uuid[])", [officeIds]);
}

describe("seed data", () => {
  beforeAll(async () => {
    await deleteSeedRows();
  });

  afterAll(async () => {
    await deleteSeedRows();
    await pool.end();
  });

  it("populates all seeded tables with the expected counts and exits cleanly", async () => {
    await expect(runSeed()).resolves.toMatchObject({
      officesInserted: 2,
      resourcesInserted: 32,
      policiesInserted: 3,
      employeesInserted: 6,
      devBearerTokensInserted: 6,
      externalMappingsInserted: 32,
    });

    expect(await countRows("office")).toBe(2);
    expect(await countRows("resource")).toBe(32);
    expect(await countRows("policy")).toBe(3);
    expect(await countRows("employee")).toBe(6);
    expect(await countRows("dev_bearer_token")).toBe(6);
    expect(await countRows("external_mapping", "source_system = 'app-qr'")).toBe(32);
  });

  it("seeds two offices with distinct IANA timezones", async () => {
    const { rows } = await pool.query<{ iana_timezone: string }>(
      "SELECT iana_timezone FROM office ORDER BY iana_timezone",
    );
    expect(rows).toHaveLength(2);
    const timezones = rows.map((r) => r.iana_timezone);
    expect(new Set(timezones).size).toBe(2);
  });

  it("is safely idempotent: re-running produces no duplicate-key errors and leaves counts unchanged", async () => {
    await expect(runSeed()).resolves.toMatchObject({
      officesInserted: 0,
      resourcesInserted: 0,
      policiesInserted: 0,
      employeesInserted: 0,
      devBearerTokensInserted: 0,
      externalMappingsInserted: 0,
    });

    expect(await countRows("office")).toBe(2);
    expect(await countRows("resource")).toBe(32);
    expect(await countRows("policy")).toBe(3);
    expect(await countRows("employee")).toBe(6);
    expect(await countRows("dev_bearer_token")).toBe(6);
    expect(await countRows("external_mapping", "source_system = 'app-qr'")).toBe(32);
  });

  it("seeds one app-qr external_mapping row per resource, keyed by the resource's own id (TASK-17)", async () => {
    const { rows } = await pool.query<{ entity_type: string; entity_id: string }>(
      `SELECT entity_type, entity_id FROM external_mapping
       WHERE source_system = 'app-qr' AND external_reference = $1`,
      [resources[0]!.id],
    );
    expect(rows).toEqual([{ entity_type: "Resource", entity_id: resources[0]!.id }]);
  });

  it("returns a non-empty, sane result for available resources in an office on a given date", async () => {
    const { rows: officeRows } = await pool.query<{ id: string }>(
      "SELECT id FROM office ORDER BY iana_timezone LIMIT 1",
    );
    expect(officeRows.length).toBeGreaterThan(0);
    const officeId = officeRows[0]!.id;

    const { rows } = await pool.query(
      `SELECT r.id, r.type, r.status
       FROM resource r
       WHERE r.office_id = $1
         AND r.status = 'Available'
         AND NOT EXISTS (
           SELECT 1 FROM booking b
           WHERE b.resource_id = r.id
             AND b.booking_date = $2
             AND b.status IN ('Reserved', 'CheckedIn')
         )`,
      [officeId, "2026-10-01"],
    );

    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(["Desk", "ParkingSpace"]).toContain(row.type);
      expect(row.status).toBe("Available");
    }
  });
});
