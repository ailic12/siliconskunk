import type { PoolClient } from "pg";
import { OFFICE_BELGRADE_ID, OFFICE_SINGAPORE_ID } from "./offices";

export const POLICY_BELGRADE_DEFAULT_ID = "00000000-0000-4000-b000-000000000001";
export const POLICY_SINGAPORE_DEFAULT_ID = "00000000-0000-4000-b000-000000000002";
/** Demo-only: deliberately short/early release deadline so a live demo can show
 * "no check-in -> release" without waiting for the normal 10:00 cutover. Paired
 * at demo time (TASK-13) with the injected Clock, not with a real-time wait. */
export const POLICY_BELGRADE_DEMO_OVERRIDE_ID = "00000000-0000-4000-b000-000000000003";

export interface PolicySeed {
  id: string;
  officeId: string;
  resourceType: "Desk" | "ParkingSpace" | null;
  bookingWindowDays: number;
  releaseDeadlineLocal: string;
  acceptedEvidenceMethods: string[];
  employeeDailyLimit: number;
}

export const policies: PolicySeed[] = [
  {
    id: POLICY_BELGRADE_DEFAULT_ID,
    officeId: OFFICE_BELGRADE_ID,
    resourceType: null,
    bookingWindowDays: 14,
    releaseDeadlineLocal: "10:00:00",
    acceptedEvidenceMethods: ["app-qr", "access-card"],
    employeeDailyLimit: 1,
  },
  {
    id: POLICY_SINGAPORE_DEFAULT_ID,
    officeId: OFFICE_SINGAPORE_ID,
    resourceType: null,
    bookingWindowDays: 14,
    releaseDeadlineLocal: "10:00:00",
    acceptedEvidenceMethods: ["app-qr", "access-card"],
    employeeDailyLimit: 1,
  },
  {
    id: POLICY_BELGRADE_DEMO_OVERRIDE_ID,
    officeId: OFFICE_BELGRADE_ID,
    resourceType: "Desk",
    bookingWindowDays: 14,
    releaseDeadlineLocal: "00:05:00",
    acceptedEvidenceMethods: ["app-qr", "access-card"],
    employeeDailyLimit: 1,
  },
];

export async function seedPolicies(client: PoolClient): Promise<number> {
  let inserted = 0;
  for (const policy of policies) {
    const { rowCount } = await client.query(
      `INSERT INTO policy (
         id, office_id, resource_type, booking_window_days,
         release_deadline_local, accepted_evidence_methods, employee_daily_limit
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO NOTHING`,
      [
        policy.id,
        policy.officeId,
        policy.resourceType,
        policy.bookingWindowDays,
        policy.releaseDeadlineLocal,
        JSON.stringify(policy.acceptedEvidenceMethods),
        policy.employeeDailyLimit,
      ],
    );
    inserted += rowCount ?? 0;
  }
  return inserted;
}
