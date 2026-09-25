import type { CheckInEvent } from "../checkin-contract";
import { withTransaction } from "../../shared/db";
import { findOfficeById } from "../office/office.repository";
import {
  applyCheckIn,
  findReservedBookingsForEmployee,
  findReservedBookingsForResource,
} from "../booking/booking.repository";
import { insertPendingEvidence, markEvidenceApplied } from "./evidence.repository";
import { resolveSubjectReference } from "./mapping.repository";

/**
 * Office-local calendar date (YYYY-MM-DD) of a specific instant. Matching
 * uses the event's occurredAt (when the physical check-in happened) rather
 * than wall-clock processing time, so a delayed/retried delivery is matched
 * against the day it actually occurred, not whatever day it happens to be
 * reprocessed on. Deliberately duplicates booking/domain-rules.ts's
 * officeLocalToday technique rather than importing it, since that helper is
 * clock-bound ("now") and this needs an arbitrary instant.
 */
function officeLocalDateOf(instant: Date, ianaTimezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ianaTimezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

/**
 * Consumes one canonical CheckInEvent (TASK-08). The whole sequence — evidence
 * insert, mapping resolution, candidate lookup, conditional apply, evidence
 * finalize — runs in a single transaction, so a crash mid-processing rolls
 * back the evidence insert too: a retried delivery then sees a genuine first
 * delivery again instead of being stuck at the default 'Unmatched' outcome.
 *
 * Zero or more than one plausible Reserved booking is never guessed — it is
 * left recorded as 'Unmatched' (HLD §7.1, BR-08).
 */
export async function processCheckInEvent(event: CheckInEvent): Promise<void> {
  await withTransaction(async (client) => {
    const evidenceId = await insertPendingEvidence(client, event);
    if (!evidenceId) return; // duplicate delivery: already recorded, no-op

    const mapping = await resolveSubjectReference(
      client,
      event.sourceSystem,
      event.subjectReference,
    );
    if (!mapping) return; // no mapping match: stays Unmatched

    const office = await findOfficeById(mapping.officeId);
    if (!office) return; // dangling mapping: stays Unmatched

    const bookingDate = officeLocalDateOf(new Date(event.occurredAt), office.ianaTimezone);

    const candidates =
      mapping.entityType === "Resource"
        ? await findReservedBookingsForResource(client, mapping.entityId, bookingDate)
        : await findReservedBookingsForEmployee(client, mapping.entityId, bookingDate);

    if (candidates.length !== 1) return; // zero or ambiguous: stays Unmatched

    const checkedIn = await applyCheckIn(client, candidates[0]!.id);
    if (!checkedIn) return; // raced with a concurrent state change: stays Unmatched

    await markEvidenceApplied(client, evidenceId, checkedIn.id);
  });
}
