/**
 * The office-local wall-clock instant a UTC instant displays as in
 * ianaTimezone, read back through Intl (there is no direct JS API for "UTC
 * offset of a zone at instant X" — this is the standard workaround).
 */
function wallClockAsUtcMillis(instant: Date, ianaTimezone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ianaTimezone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);

  const get = (type: string): number => Number(parts.find((p) => p.type === type)?.value);

  return Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
}

/**
 * Release Engine (TASK-09, HLD §10): the effective release-deadline instant
 * for booking_date + policy.release_deadline_local, interpreted in the
 * office's IANA timezone, computed at evaluation time (never pre-baked, so
 * timezone-rule/DST changes are always handled correctly).
 *
 * Converts a local wall-clock time to its UTC instant by offset-correcting
 * an initial guess against what that guess actually displays as in the
 * target zone, then repeating once more — two passes converge even when the
 * first guess's naive offset differs from the target date's true offset
 * (e.g. a booking date that has since crossed a DST boundary).
 */
export function computeEffectiveDeadline(
  bookingDate: string,
  releaseDeadlineLocal: string,
  ianaTimezone: string,
): Date {
  const [year, month, day] = bookingDate.split("-").map(Number);
  const [hour, minute, second] = releaseDeadlineLocal.split(":").map(Number);

  const desiredWallMillis = Date.UTC(year!, month! - 1, day!, hour!, minute!, second ?? 0);

  let guessMillis = desiredWallMillis;
  for (let i = 0; i < 2; i++) {
    const offsetMillis = wallClockAsUtcMillis(new Date(guessMillis), ianaTimezone) - guessMillis;
    guessMillis = desiredWallMillis - offsetMillis;
  }

  return new Date(guessMillis);
}
