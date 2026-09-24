import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { pool, withTransaction } from "../../../src/shared/db";

const SCRATCH_TABLE = "task01_smoke_scratch";

describe("withTransaction round-trip", () => {
  beforeAll(async () => {
    await pool.query(`CREATE TABLE ${SCRATCH_TABLE} (id SERIAL PRIMARY KEY, label TEXT NOT NULL)`);
  });

  afterAll(async () => {
    await pool.query(`DROP TABLE IF EXISTS ${SCRATCH_TABLE}`);
    await pool.end();
  });

  it("commits a write made inside the callback", async () => {
    await withTransaction(async (client) => {
      await client.query(`INSERT INTO ${SCRATCH_TABLE} (label) VALUES ($1)`, ["committed"]);
    });

    const { rows } = await pool.query(`SELECT label FROM ${SCRATCH_TABLE} WHERE label = $1`, [
      "committed",
    ]);
    expect(rows).toHaveLength(1);
  });

  it("rolls back a write when the callback throws", async () => {
    await expect(
      withTransaction(async (client) => {
        await client.query(`INSERT INTO ${SCRATCH_TABLE} (label) VALUES ($1)`, ["rolled-back"]);
        throw new Error("forced failure");
      }),
    ).rejects.toThrow("forced failure");

    const { rows } = await pool.query(`SELECT label FROM ${SCRATCH_TABLE} WHERE label = $1`, [
      "rolled-back",
    ]);
    expect(rows).toHaveLength(0);
  });
});
