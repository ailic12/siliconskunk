import type { Clock } from "../../shared/clock";
import type { ResourceStatus } from "../resource-policy/resource.repository";

const DATE_FORMAT = /^\d{4}-\d{2}-\d{2}$/;

/**
 * BR-01: bookings are for exactly one working day — a single calendar date,
 * not a range or a list. Validates wire-format shape only; the value itself
 * is checked against the booking window separately (BR-03).
 */
export function isValidBookingDate(value: unknown): value is string {
  return typeof value === "string" && DATE_FORMAT.test(value) && !Number.isNaN(Date.parse(value));
}

/**
 * BR-04: resources marked Unavailable or UnderMaintenance cannot be booked.
 */
export function isBookableResourceStatus(status: ResourceStatus): boolean {
  return status === "Available";
}

/**
 * Office-local calendar date (YYYY-MM-DD) for the Clock's current instant,
 * per BR-01's "office-local working day" framing.
 */
export function officeLocalToday(clock: Clock, ianaTimezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ianaTimezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(clock.now());
}

function addDays(dateStr: string, days: number): string {
  const parts = dateStr.split("-");
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (parts.length !== 3 || Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
    throw new Error(`"${dateStr}" is not a valid ISO calendar date.`);
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * BR-03: bookings can be created up to `windowDays` calendar days in advance,
 * inclusive of today and the final day of the window.
 */
export function isWithinBookingWindow(
  bookingDate: string,
  officeToday: string,
  windowDays: number,
): boolean {
  const latestAllowed = addDays(officeToday, windowDays);
  return bookingDate >= officeToday && bookingDate <= latestAllowed;
}
