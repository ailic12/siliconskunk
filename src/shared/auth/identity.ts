import { pool } from "../db";

export interface Identity {
  employeeId: string;
  roleScope: string;
  homeOfficeId: string;
}

export async function resolveIdentityFromToken(token: string): Promise<Identity | null> {
  const { rows } = await pool.query<{
    employee_id: string;
    role_scope: string;
    home_office_id: string;
  }>(
    `SELECT e.id AS employee_id, e.role_scope, e.home_office_id
     FROM dev_bearer_token t
     JOIN employee e ON e.id = t.employee_id
     WHERE t.token = $1`,
    [token],
  );

  const row = rows[0];
  if (!row) return null;

  return {
    employeeId: row.employee_id,
    roleScope: row.role_scope,
    homeOfficeId: row.home_office_id,
  };
}
