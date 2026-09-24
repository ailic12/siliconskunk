import type { PoolClient } from "pg";
import { OFFICE_BELGRADE_ID, OFFICE_SINGAPORE_ID } from "./offices";

export type ResourceType = "Desk" | "ParkingSpace";
export type ResourceStatus = "Available" | "Unavailable" | "UnderMaintenance";

export interface ResourceSeed {
  id: string;
  officeId: string;
  type: ResourceType;
  name: string;
  status: ResourceStatus;
  characteristics: Record<string, unknown>;
}

/** Deterministic fixed UUID, unique per (office, resource type, index) — not derived from randomness. */
function resourceId(officeSlot: number, typeSlot: number, index: number): string {
  const group = String(officeSlot).padStart(1, "0") + String(typeSlot).padStart(1, "0");
  return `000000${group}-0000-4000-a000-${String(index).padStart(12, "0")}`;
}

function buildDesks(officeId: string, officeSlot: number, count: number): ResourceSeed[] {
  return Array.from({ length: count }, (_, i) => {
    const seatNumber = i + 1;
    const characteristics: Record<string, unknown> = {};
    if (seatNumber % 3 === 0) characteristics.monitor = true;
    if (seatNumber === 1) characteristics.accessibility = true;
    return {
      id: resourceId(officeSlot, 1, seatNumber),
      officeId,
      type: "Desk" as const,
      name: `Desk ${seatNumber}`,
      status: "Available" as const,
      characteristics,
    };
  });
}

function buildParkingSpaces(officeId: string, officeSlot: number, count: number): ResourceSeed[] {
  return Array.from({ length: count }, (_, i) => {
    const spaceNumber = i + 1;
    const characteristics: Record<string, unknown> = {};
    if (spaceNumber % 2 === 0) characteristics.evCharging = true;
    return {
      id: resourceId(officeSlot, 2, spaceNumber),
      officeId,
      type: "ParkingSpace" as const,
      name: `Parking ${spaceNumber}`,
      status: "Available" as const,
      characteristics,
    };
  });
}

export const resources: ResourceSeed[] = [
  ...buildDesks(OFFICE_BELGRADE_ID, 1, 12),
  ...buildParkingSpaces(OFFICE_BELGRADE_ID, 1, 4),
  ...buildDesks(OFFICE_SINGAPORE_ID, 2, 12),
  ...buildParkingSpaces(OFFICE_SINGAPORE_ID, 2, 4),
];

export async function seedResources(client: PoolClient): Promise<number> {
  let inserted = 0;
  for (const resource of resources) {
    const { rowCount } = await client.query(
      `INSERT INTO resource (id, office_id, type, name, status, characteristics)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO NOTHING`,
      [
        resource.id,
        resource.officeId,
        resource.type,
        resource.name,
        resource.status,
        JSON.stringify(resource.characteristics),
      ],
    );
    inserted += rowCount ?? 0;
  }
  return inserted;
}
