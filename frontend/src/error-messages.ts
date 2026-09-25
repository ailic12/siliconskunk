/** Preserved verbatim from TASK-15's original public/index.html (AC-1). */
const ERROR_MESSAGES: Record<string, string> = {
  resource_not_bookable: "This resource cannot be booked right now (not in a bookable state).",
  outside_booking_window: "That date is outside the allowed booking window.",
  resource_already_booked: "Someone already booked that resource for this date.",
  employee_daily_limit_reached:
    "This employee already has a booking of this resource type for this date.",
};

export function describeApiError(status: number, body: {
  error?: string;
  reason?: string;
  message?: string;
}): string {
  if (status === 401 || body.error === "unauthorized") {
    return "Unauthorized: no valid bearer token was accepted (401).";
  }
  if (status === 404 || body.error === "not_found") {
    return body.message ?? "Not found (404).";
  }
  if (body.reason && ERROR_MESSAGES[body.reason]) {
    return `${ERROR_MESSAGES[body.reason]} (${body.message ?? ""})`;
  }
  if (body.message) {
    return body.message;
  }
  return "Request failed.";
}
