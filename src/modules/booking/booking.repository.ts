import type { PoolClient } from "pg";
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

interface BookingRow {
  id: string;
  resource_id: string;
  employee_id: string;
  booking_date: string;
  resource_type: ResourceType;
  status: BookingStatus;
  created_at: string;
}

function mapBookingRow(row: BookingRow): Booking {
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

/**
 * Check-in Gateway (TASK-08) matching candidates: a resource has at most one
 * active booking per day (booking_resource_active_unique), so this returns 0
 * or 1 rows.
 */
export async function findReservedBookingsForResource(
  client: PoolClient,
  resourceId: string,
  bookingDate: string,
): Promise<Booking[]> {
  const { rows } = await client.query<BookingRow>(
    `SELECT id, resource_id, employee_id, booking_date, resource_type, status, created_at
     FROM booking
     WHERE resource_id = $1 AND booking_date = $2 AND status = 'Reserved'`,
    [resourceId, bookingDate],
  );
  return rows.map(mapBookingRow);
}

/**
 * Check-in Gateway (TASK-08) matching candidates: an employee can have up to
 * two active bookings per day (one per resource_type), so this can return 0,
 * 1, or 2 rows — more than 1 is treated as ambiguous by the caller.
 */
export async function findReservedBookingsForEmployee(
  client: PoolClient,
  employeeId: string,
  bookingDate: string,
): Promise<Booking[]> {
  const { rows } = await client.query<BookingRow>(
    `SELECT id, resource_id, employee_id, booking_date, resource_type, status, created_at
     FROM booking
     WHERE employee_id = $1 AND booking_date = $2 AND status = 'Reserved'`,
    [employeeId, bookingDate],
  );
  return rows.map(mapBookingRow);
}

/**
 * Conditional transition guards against a race with anything else that may
 * have changed this booking's status between the candidate read and this
 * write (e.g. TASK-09's release sweep) — 0 rows affected means the booking is
 * no longer a valid match "now", per BR-08 (Check-in Gateway, TASK-08).
 */
export async function applyCheckIn(client: PoolClient, bookingId: string): Promise<Booking | null> {
  const { rows } = await client.query<BookingRow>(
    `UPDATE booking
     SET status = 'CheckedIn', updated_at = now()
     WHERE id = $1 AND status = 'Reserved'
     RETURNING id, resource_id, employee_id, booking_date, resource_type, status, created_at`,
    [bookingId],
  );
  const row = rows[0];
  return row ? mapBookingRow(row) : null;
}

export interface ReleaseCandidate {
  id: string;
  bookingDate: string;
  resourceType: ResourceType;
}

/**
 * Release Engine (TASK-09) candidates for one office: every still-`Reserved`
 * booking on one of that office's resources. The sweep groups these by
 * (resourceType, bookingDate) to resolve one effective deadline per group
 * rather than recomputing per booking row.
 */
export async function findReservedBookingCandidatesForOffice(
  officeId: string,
): Promise<ReleaseCandidate[]> {
  const { rows } = await pool.query<{
    id: string;
    booking_date: string;
    resource_type: ResourceType;
  }>(
    `SELECT b.id, b.booking_date, b.resource_type
     FROM booking b
     JOIN resource r ON r.id = b.resource_id
     WHERE r.office_id = $1 AND b.status = 'Reserved'`,
    [officeId],
  );

  return rows.map((row) => ({
    id: row.id,
    bookingDate: row.booking_date,
    resourceType: row.resource_type,
  }));
}

/**
 * Conditional transition mirrors applyCheckIn: guards against a race with
 * any other status change since the candidate read (BR-07/R-05), and 0 rows
 * affected on a re-run is the sweep's retry-safety guarantee (HLD §5.4).
 * Takes a PoolClient (not the pool) so TASK-11 can extend this same
 * transaction to also insert a ReleaseNotice row, per its own scope.
 */
export async function applyRelease(client: PoolClient, bookingId: string): Promise<Booking | null> {
  const { rows } = await client.query<BookingRow>(
    `UPDATE booking
     SET status = 'Released', updated_at = now()
     WHERE id = $1 AND status = 'Reserved'
     RETURNING id, resource_id, employee_id, booking_date, resource_type, status, created_at`,
    [bookingId],
  );
  const row = rows[0];
  return row ? mapBookingRow(row) : null;
}
