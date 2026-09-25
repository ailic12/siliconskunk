import type { PoolClient } from "pg";
import { resources } from "./resources";

const SOURCE_SYSTEM_APP_QR = "app-qr";

/**
 * Demo-only fixture (TASK-17): lets a real check-in submitted through the
 * app-qr Ingress adapter resolve to a real seeded resource. One row per
 * seeded resource, keyed by the resource's own id as its external_reference
 * — the browser demo UI already knows a booking's resourceId from its own
 * POST /bookings response, so it can construct a matching bookingReference
 * itself without any new lookup.
 */
export async function seedExternalMappings(client: PoolClient): Promise<number> {
  let inserted = 0;
  for (const resource of resources) {
    const { rowCount } = await client.query(
      `INSERT INTO external_mapping (entity_type, entity_id, source_system, external_reference)
       VALUES ('Resource', $1, $2, $3)
       ON CONFLICT (source_system, external_reference) DO NOTHING`,
      [resource.id, SOURCE_SYSTEM_APP_QR, resource.id],
    );
    inserted += rowCount ?? 0;
  }
  return inserted;
}
