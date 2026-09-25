import type { CheckInEvent } from "./checkin-event";

const REQUIRED_STRING_FIELDS = [
  "sourceSystem",
  "externalEventId",
  "subjectReference",
  "occurredAt",
  "receivedAt",
] as const;

export class InvalidCheckInEventError extends Error {
  constructor(field: string, reason: string) {
    super(`CheckInEvent field "${field}" ${reason}.`);
    this.name = "InvalidCheckInEventError";
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isIsoTimestamp(value: unknown): value is string {
  return isNonEmptyString(value) && !Number.isNaN(Date.parse(value));
}

/**
 * Validates and narrows an unknown payload to the canonical CheckInEvent
 * shape. Throws InvalidCheckInEventError on the first missing/invalid field
 * rather than returning a boolean, so callers get a precise reason.
 */
export function parseCheckInEvent(input: unknown): CheckInEvent {
  if (typeof input !== "object" || input === null) {
    throw new InvalidCheckInEventError("<root>", "must be an object");
  }

  const candidate = input as Record<string, unknown>;

  for (const field of REQUIRED_STRING_FIELDS) {
    if (!isNonEmptyString(candidate[field])) {
      throw new InvalidCheckInEventError(field, "must be a non-empty string");
    }
  }

  if (!isIsoTimestamp(candidate.occurredAt)) {
    throw new InvalidCheckInEventError("occurredAt", "must be a valid timestamp");
  }
  if (!isIsoTimestamp(candidate.receivedAt)) {
    throw new InvalidCheckInEventError("receivedAt", "must be a valid timestamp");
  }

  return {
    sourceSystem: candidate.sourceSystem as string,
    externalEventId: candidate.externalEventId as string,
    subjectReference: candidate.subjectReference as string,
    occurredAt: candidate.occurredAt as string,
    receivedAt: candidate.receivedAt as string,
  };
}

export function isValidCheckInEvent(input: unknown): input is CheckInEvent {
  try {
    parseCheckInEvent(input);
    return true;
  } catch {
    return false;
  }
}
