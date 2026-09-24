import { pool } from "../../shared/db";

export type ResourceType = "Desk" | "ParkingSpace";
export type ResourceStatus = "Available" | "Unavailable" | "UnderMaintenance";

export interface Resource {
  id: string;
  officeId: string;
  type: ResourceType;
  name: string;
  status: ResourceStatus;
}

export async function findResourceById(resourceId: string): Promise<Resource | null> {
  const { rows } = await pool.query<{
    id: string;
    office_id: string;
    type: ResourceType;
    name: string;
    status: ResourceStatus;
  }>(`SELECT id, office_id, type, name, status FROM resource WHERE id = $1`, [resourceId]);

  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    officeId: row.office_id,
    type: row.type,
    name: row.name,
    status: row.status,
  };
}

/**
 * Active resources of a type in an office minus resources with an active
 * (Reserved/CheckedIn) booking on the given date (FR-01).
 */
export async function findAvailableResources(
  officeId: string,
  resourceType: ResourceType,
  bookingDate: string,
): Promise<Resource[]> {
  const { rows } = await pool.query<{
    id: string;
    office_id: string;
    type: ResourceType;
    name: string;
    status: ResourceStatus;
  }>(
    `SELECT r.id, r.office_id, r.type, r.name, r.status
     FROM resource r
     WHERE r.office_id = $1
       AND r.type = $2
       AND r.status = 'Available'
       AND NOT EXISTS (
         SELECT 1 FROM booking b
         WHERE b.resource_id = r.id
           AND b.booking_date = $3
           AND b.status IN ('Reserved', 'CheckedIn')
       )
     ORDER BY r.name`,
    [officeId, resourceType, bookingDate],
  );

  return rows.map((row) => ({
    id: row.id,
    officeId: row.office_id,
    type: row.type,
    name: row.name,
    status: row.status,
  }));
}
