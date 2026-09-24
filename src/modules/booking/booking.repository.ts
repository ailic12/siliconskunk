import { pool } from "../../shared/db";
import type { ResourceType } from "../resource-policy/resource.repository";

export type BookingStatus = "Reserved" | "CheckedIn" | "Released" | "Cancelled";

export interface Booking {
  id: string;
  resourceId: string;
  employeeId: string;
  bookingDate: string;
  resourceType: ResourceType;
  status: BookingStatus;
  createdAt: string;
}

/**
 * Relies entirely on the two partial unique indexes from TASK-02 for
 * conflict prevention (HLD §5.2) — no application-level check-then-insert.
 * A unique-violation (23505) is left to propagate to the caller, which maps
 * it via `err.constraint`.
 */
export async function insertBooking(params: {
  resourceId: string;
  employeeId: string;
  bookingDate: string;
  resourceType: ResourceType;
}): Promise<Booking> {
  const { rows } = await pool.query<{
    id: string;
    resource_id: string;
    employee_id: string;
    booking_date: string;
    resource_type: ResourceType;
    status: BookingStatus;
    created_at: string;
  }>(
    `INSERT INTO booking (resource_id, employee_id, booking_date, resource_type, status)
     VALUES ($1, $2, $3, $4, 'Reserved')
     RETURNING id, resource_id, employee_id, booking_date, resource_type, status, created_at`,
    [params.resourceId, params.employeeId, params.bookingDate, params.resourceType],
  );

  const row = rows[0]!;
  return {
    id: row.id,
    resourceId: row.resource_id,
    employeeId: row.employee_id,
    bookingDate: row.booking_date,
    resourceType: row.resource_type,
    status: row.status,
    createdAt: row.created_at,
  };
}
