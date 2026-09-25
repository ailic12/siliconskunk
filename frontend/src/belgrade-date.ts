const BELGRADE_TZ = "Europe/Belgrade";

/** Office-local calendar date (YYYY-MM-DD) in Europe/Belgrade, offset by `dayOffset`
 * days from the real current instant. Used only to choose a demo booking date to try —
 * the backend (booking-window/policy checks) remains the sole source of truth for
 * whether that date is actually valid. */
export function belgradeLocalDate(dayOffset: number): string {
  const instant = new Date(Date.now() + dayOffset * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BELGRADE_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}
