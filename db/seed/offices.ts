import type { PoolClient } from "pg";

export const OFFICE_BELGRADE_ID = "00000000-0000-4000-8000-000000000001";
export const OFFICE_SINGAPORE_ID = "00000000-0000-4000-8000-000000000002";

export interface OfficeSeed {
  id: string;
  name: string;
  ianaTimezone: string;
  country: string;
  active: boolean;
}

export const offices: OfficeSeed[] = [
  {
    id: OFFICE_BELGRADE_ID,
    name: "Belgrade HQ",
    ianaTimezone: "Europe/Belgrade",
    country: "RS",
    active: true,
  },
  {
    id: OFFICE_SINGAPORE_ID,
    name: "Singapore Hub",
    ianaTimezone: "Asia/Singapore",
    country: "SG",
    active: true,
  },
];

export async function seedOffices(client: PoolClient): Promise<number> {
  let inserted = 0;
  for (const office of offices) {
    const { rowCount } = await client.query(
      `INSERT INTO office (id, name, iana_timezone, country, active)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO NOTHING`,
      [office.id, office.name, office.ianaTimezone, office.country, office.active],
    );
    inserted += rowCount ?? 0;
  }
  return inserted;
}
