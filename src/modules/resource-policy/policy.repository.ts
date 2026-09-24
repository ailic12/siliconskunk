import { pool } from "../../shared/db";
import type { ResourceType } from "./resource.repository";

export interface Policy {
  id: string;
  officeId: string;
  resourceType: ResourceType | null;
  bookingWindowDays: number;
}

/**
 * All policy rows for an office that could apply to the given resource type:
 * the office-wide row (resource_type IS NULL) and/or a type-specific row.
 */
export async function findPoliciesForOfficeAndType(
  officeId: string,
  resourceType: ResourceType,
): Promise<Policy[]> {
  const { rows } = await pool.query<{
    id: string;
    office_id: string;
    resource_type: ResourceType | null;
    booking_window_days: number;
  }>(
    `SELECT id, office_id, resource_type, booking_window_days
     FROM policy
     WHERE office_id = $1
       AND (resource_type = $2 OR resource_type IS NULL)`,
    [officeId, resourceType],
  );

  return rows.map((row) => ({
    id: row.id,
    officeId: row.office_id,
    resourceType: row.resource_type,
    bookingWindowDays: row.booking_window_days,
  }));
}
