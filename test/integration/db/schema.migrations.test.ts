import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { pool } from "../../../src/shared/db";

const execFileAsync = promisify(execFile);

/**
 * `count` is only relevant to "down": node-pg-migrate's default is to revert
 * just the single most recent migration, but this suite's reversibility
 * check (below) needs every migration reverted, regardless of how many exist
 * (TASK-11 added a second migration file) — a fixed large number is more
 * robust to future migrations than hard-coding the current count.
 */
async function migrate(direction: "up" | "down", count?: number) {
  const args = [
    "node-pg-migrate",
    direction,
    "--migrations-dir",
    "db/migrations",
    "--tsconfig",
    "tsconfig.base.json",
    "--envPath",
    ".env",
  ];
  if (direction === "down" && count !== undefined) {
    args.push(String(count));
  }
  await execFileAsync("npx", args);
}

describe("core domain schema migrations", () => {
  beforeAll(async () => {
    await migrate("up");
  });

  afterAll(async () => {
    await migrate("up");
    await pool.end();
  });

  it("creates the booking resource-level partial unique index", async () => {
    const { rows } = await pool.query(
      `SELECT indexdef FROM pg_indexes WHERE tablename = 'booking' AND indexname = $1`,
      ["booking_resource_active_unique"],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].indexdef).toContain("UNIQUE INDEX");
    expect(rows[0].indexdef).toContain("(resource_id, booking_date)");
    expect(rows[0].indexdef).toMatch(/WHERE .*status/);
  });

  it("creates the booking employee-level partial unique index", async () => {
    const { rows } = await pool.query(
      `SELECT indexdef FROM pg_indexes WHERE tablename = 'booking' AND indexname = $1`,
      ["booking_employee_daily_active_unique"],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].indexdef).toContain("UNIQUE INDEX");
    expect(rows[0].indexdef).toContain("(employee_id, booking_date, resource_type)");
    expect(rows[0].indexdef).toMatch(/WHERE .*status/);
  });

  it("creates the checkin_evidence idempotency unique constraint", async () => {
    const { rows } = await pool.query(
      `SELECT tc.constraint_name, array_agg(kcu.column_name::text ORDER BY kcu.ordinal_position) AS columns
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
       WHERE tc.table_name = 'checkin_evidence' AND tc.constraint_type = 'UNIQUE'
       GROUP BY tc.constraint_name`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].columns).toEqual(["source_system", "external_event_id"]);
  });

  it("creates the notification dedup unique constraint", async () => {
    const { rows } = await pool.query(
      `SELECT tc.constraint_name, array_agg(kcu.column_name::text ORDER BY kcu.ordinal_position) AS columns
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
       WHERE tc.table_name = 'notification' AND tc.constraint_type = 'UNIQUE'
       GROUP BY tc.constraint_name`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].columns).toEqual(["dedup_key"]);
  });

  it("is reversible: down removes all core domain tables, up restores them", async () => {
    await migrate("down", 1000);

    const { rows: afterDown } = await pool.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
      [
        [
          "office",
          "resource",
          "policy",
          "employee",
          "dev_bearer_token",
          "booking",
          "checkin_evidence",
          "external_mapping",
          "notification",
        ],
      ],
    );
    expect(afterDown).toHaveLength(0);

    await migrate("up");

    const { rows: afterUp } = await pool.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
      [
        [
          "office",
          "resource",
          "policy",
          "employee",
          "dev_bearer_token",
          "booking",
          "checkin_evidence",
          "external_mapping",
          "notification",
        ],
      ],
    );
    expect(afterUp).toHaveLength(9);
  });
});
