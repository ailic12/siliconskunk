import type { Clock } from "../../shared/clock";
import { withTransaction } from "../../shared/db";
import { findAllOffices } from "../office/office.repository";
import { getEffectivePolicy } from "../resource-policy/policy.service";
import {
  applyRelease,
  findReservedBookingCandidatesForOffice,
  type Booking,
  type ReleaseCandidate,
} from "../booking/booking.repository";
import { computeEffectiveDeadline } from "./deadline";

function groupByTypeAndDate(candidates: ReleaseCandidate[]): Map<string, ReleaseCandidate[]> {
  const groups = new Map<string, ReleaseCandidate[]>();
  for (const candidate of candidates) {
    const key = `${candidate.resourceType}|${candidate.bookingDate}`;
    const group = groups.get(key);
    if (group) {
      group.push(candidate);
    } else {
      groups.set(key, [candidate]);
    }
  }
  return groups;
}

/**
 * Release Engine (TASK-09, HLD §5.4/§10, FR-09, BR-05/06/07): one sweep pass
 * over every office. Candidates sharing a (resourceType, bookingDate) share
 * one effective policy and deadline, resolved once per group rather than
 * once per booking. Each release is its own conditional-UPDATE transaction
 * (applyRelease) — idempotent and retry-safe on its own, and the exact unit
 * TASK-11 extends to add a same-transaction ReleaseNotice row.
 */
export async function runReleaseSweep(clock: Clock): Promise<Booking[]> {
  const now = clock.now();
  const released: Booking[] = [];

  const offices = await findAllOffices();
  for (const office of offices) {
    const candidates = await findReservedBookingCandidatesForOffice(office.id);
    if (candidates.length === 0) continue;

    for (const group of groupByTypeAndDate(candidates).values()) {
      const { resourceType, bookingDate } = group[0]!;
      const policy = await getEffectivePolicy(office.id, resourceType);
      const deadline = computeEffectiveDeadline(
        bookingDate,
        policy.releaseDeadlineLocal,
        office.ianaTimezone,
      );
      if (now < deadline) continue;

      for (const candidate of group) {
        const result = await withTransaction((client) => applyRelease(client, candidate.id));
        if (result) released.push(result);
      }
    }
  }

  return released;
}
