import type { Clock } from "../../shared/clock";
import { findOfficeById } from "../office/office.repository";
import {
  findResourceById,
  findAvailableResources,
  type Resource,
  type ResourceType,
} from "../resource-policy/resource.repository";
import { getEffectivePolicy } from "../resource-policy/policy.service";
import { computeEffectiveDeadline } from "../release-engine/deadline";
import { findBookingById, insertBooking, type Booking } from "./booking.repository";
import {
  isBookableResourceStatus,
  isValidBookingDate,
  isWithinBookingWindow,
  officeLocalToday,
} from "./domain-rules";
import {
  BookingNotFoundError,
  EmployeeConflictError,
  InvalidBookingDateError,
  OutsideBookingWindowError,
  ResourceConflictError,
  ResourceNotBookableError,
  ResourceNotFoundError,
} from "./errors";

const RESOURCE_CONSTRAINT = "booking_resource_active_unique";
const EMPLOYEE_CONSTRAINT = "booking_employee_daily_active_unique";

interface PgUniqueViolation {
  code: string;
  constraint?: string;
}

function isPgUniqueViolation(err: unknown): err is PgUniqueViolation {
  return typeof err === "object" && err !== null && (err as { code?: unknown }).code === "23505";
}

export async function createBooking(
  clock: Clock,
  employeeId: string,
  resourceId: string,
  bookingDate: unknown,
): Promise<Booking> {
  if (!isValidBookingDate(bookingDate)) {
    throw new InvalidBookingDateError(bookingDate);
  }

  const resource = await findResourceById(resourceId);
  if (!resource) {
    throw new ResourceNotFoundError(resourceId);
  }

  if (!isBookableResourceStatus(resource.status)) {
    throw new ResourceNotBookableError(resourceId);
  }

  const office = await findOfficeById(resource.officeId);
  if (!office) {
    throw new ResourceNotFoundError(resourceId);
  }

  const policy = await getEffectivePolicy(resource.officeId, resource.type);
  const today = officeLocalToday(clock, office.ianaTimezone);

  if (!isWithinBookingWindow(bookingDate, today, policy.bookingWindowDays)) {
    throw new OutsideBookingWindowError(bookingDate);
  }

  try {
    return await insertBooking({
      resourceId: resource.id,
      employeeId,
      bookingDate,
      resourceType: resource.type,
    });
  } catch (err) {
    if (isPgUniqueViolation(err)) {
      if (err.constraint === RESOURCE_CONSTRAINT) throw new ResourceConflictError();
      if (err.constraint === EMPLOYEE_CONSTRAINT) throw new EmployeeConflictError();
    }
    throw err;
  }
}

export async function getAvailability(
  officeId: string,
  resourceType: ResourceType,
  bookingDate: string,
): Promise<Resource[]> {
  return findAvailableResources(officeId, resourceType, bookingDate);
}

export interface BookingWithDeadline extends Booking {
  checkInDeadline: string;
}

/**
 * Booking status read (TASK-17, GET /bookings/:id). Scoped to the requesting
 * identity's own employeeId — a booking that exists but belongs to someone
 * else is indistinguishable from a nonexistent one (BookingNotFoundError),
 * mirroring the existing no-cross-employee-enumeration boundary (TASK-15/PoC
 * Selection C4). checkInDeadline reuses the Release Engine's own deadline
 * computation (TASK-09) rather than duplicating it.
 */
export async function getBookingForEmployee(
  bookingId: string,
  employeeId: string,
): Promise<BookingWithDeadline> {
  const booking = await findBookingById(bookingId);
  if (!booking || booking.employeeId !== employeeId) {
    throw new BookingNotFoundError(bookingId);
  }

  const resource = await findResourceById(booking.resourceId);
  if (!resource) {
    throw new BookingNotFoundError(bookingId);
  }

  const office = await findOfficeById(resource.officeId);
  if (!office) {
    throw new BookingNotFoundError(bookingId);
  }

  const policy = await getEffectivePolicy(resource.officeId, booking.resourceType);
  const checkInDeadline = computeEffectiveDeadline(
    booking.bookingDate,
    policy.releaseDeadlineLocal,
    office.ianaTimezone,
  ).toISOString();

  return { ...booking, checkInDeadline };
}
