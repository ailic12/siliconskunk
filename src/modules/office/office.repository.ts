import { pool } from "../../shared/db";

export interface Office {
  id: string;
  ianaTimezone: string;
  active: boolean;
}

export async function findOfficeById(officeId: string): Promise<Office | null> {
  const { rows } = await pool.query<{ id: string; iana_timezone: string; active: boolean }>(
    `SELECT id, iana_timezone, active FROM office WHERE id = $1`,
    [officeId],
  );

  const row = rows[0];
  if (!row) return null;

  return { id: row.id, ianaTimezone: row.iana_timezone, active: row.active };
}

/**
 * Release Engine (TASK-09) sweeps every office in its own per-office pass
 * (HLD §5.4); this feeds that outer loop.
 */
export async function findAllOffices(): Promise<Office[]> {
  const { rows } = await pool.query<{ id: string; iana_timezone: string; active: boolean }>(
    `SELECT id, iana_timezone, active FROM office`,
  );

  return rows.map((row) => ({ id: row.id, ianaTimezone: row.iana_timezone, active: row.active }));
}
