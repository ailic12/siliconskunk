import type { PoolClient } from "pg";
import { OFFICE_BELGRADE_ID, OFFICE_SINGAPORE_ID } from "./offices";

export interface EmployeeSeed {
  id: string;
  entraObjectId: string;
  homeOfficeId: string;
  displayName: string;
  email: string;
  roleScope: "Employee";
  devToken: string;
}

/**
 * Dev-only identity fixtures. No real Entra ID integration (mocked identity,
 * plan decision 7). All seeded at role_scope "Employee" — no downstream PoC
 * task (TASK-04..TASK-14) requires a seeded Admin identity, and no admin UI
 * is built in this PoC, so Admin role scopes are intentionally not seeded.
 */
export const employees: EmployeeSeed[] = [
  {
    id: "00000000-0000-4000-9000-000000000001",
    entraObjectId: "dev-entra-oid-alice",
    homeOfficeId: OFFICE_BELGRADE_ID,
    displayName: "Alice Petrovic",
    email: "alice.petrovic@example.com",
    roleScope: "Employee",
    devToken: "dev-token-alice",
  },
  {
    id: "00000000-0000-4000-9000-000000000002",
    entraObjectId: "dev-entra-oid-bojan",
    homeOfficeId: OFFICE_BELGRADE_ID,
    displayName: "Bojan Jovanovic",
    email: "bojan.jovanovic@example.com",
    roleScope: "Employee",
    devToken: "dev-token-bojan",
  },
  {
    id: "00000000-0000-4000-9000-000000000003",
    entraObjectId: "dev-entra-oid-catalina",
    homeOfficeId: OFFICE_BELGRADE_ID,
    displayName: "Catalina Nikolic",
    email: "catalina.nikolic@example.com",
    roleScope: "Employee",
    devToken: "dev-token-catalina",
  },
  {
    id: "00000000-0000-4000-9000-000000000004",
    entraObjectId: "dev-entra-oid-daniel",
    homeOfficeId: OFFICE_SINGAPORE_ID,
    displayName: "Daniel Tan",
    email: "daniel.tan@example.com",
    roleScope: "Employee",
    devToken: "dev-token-daniel",
  },
  {
    id: "00000000-0000-4000-9000-000000000005",
    entraObjectId: "dev-entra-oid-eunice",
    homeOfficeId: OFFICE_SINGAPORE_ID,
    displayName: "Eunice Lim",
    email: "eunice.lim@example.com",
    roleScope: "Employee",
    devToken: "dev-token-eunice",
  },
  {
    id: "00000000-0000-4000-9000-000000000006",
    entraObjectId: "dev-entra-oid-farhan",
    homeOfficeId: OFFICE_SINGAPORE_ID,
    displayName: "Farhan Rahman",
    email: "farhan.rahman@example.com",
    roleScope: "Employee",
    devToken: "dev-token-farhan",
  },
];

export async function seedEmployees(client: PoolClient): Promise<number> {
  let inserted = 0;
  for (const employee of employees) {
    const { rowCount } = await client.query(
      `INSERT INTO employee (id, entra_object_id, home_office_id, display_name, email, role_scope)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO NOTHING`,
      [
        employee.id,
        employee.entraObjectId,
        employee.homeOfficeId,
        employee.displayName,
        employee.email,
        employee.roleScope,
      ],
    );
    inserted += rowCount ?? 0;
  }
  return inserted;
}

export async function seedDevBearerTokens(client: PoolClient): Promise<number> {
  let inserted = 0;
  for (const employee of employees) {
    const { rowCount } = await client.query(
      `INSERT INTO dev_bearer_token (token, employee_id)
       VALUES ($1, $2)
       ON CONFLICT (token) DO NOTHING`,
      [employee.devToken, employee.id],
    );
    inserted += rowCount ?? 0;
  }
  return inserted;
}
