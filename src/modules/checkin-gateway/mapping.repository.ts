import type { PoolClient } from "pg";

export type MappedEntityType = "Resource" | "Employee";

export interface ResolvedMapping {
  entityType: MappedEntityType;
  entityId: string;
  officeId: string;
}

interface MappingRow {
  entity_type: MappedEntityType;
  entity_id: string;
  office_id: string | null;
}

/**
 * external_mapping is unique per (source_system, external_reference), so a
 * subject_reference resolves to exactly one Resource or Employee, never both
 * (HLD §4, §7.1). office_id is joined in from whichever entity was resolved,
 * to let the caller compute the office-local working day.
 */
export async function resolveSubjectReference(
  client: PoolClient,
  sourceSystem: string,
  externalReference: string,
): Promise<ResolvedMapping | null> {
  const { rows } = await client.query<MappingRow>(
    `SELECT
       em.entity_type,
       em.entity_id,
       CASE em.entity_type
         WHEN 'Resource' THEN r.office_id
         WHEN 'Employee' THEN e.home_office_id
         ELSE NULL
       END AS office_id
     FROM external_mapping em
     LEFT JOIN resource r ON em.entity_type = 'Resource' AND r.id = em.entity_id
     LEFT JOIN employee e ON em.entity_type = 'Employee' AND e.id = em.entity_id
     WHERE em.source_system = $1 AND em.external_reference = $2`,
    [sourceSystem, externalReference],
  );

  const row = rows[0];
  if (!row || !row.office_id) return null;

  return { entityType: row.entity_type, entityId: row.entity_id, officeId: row.office_id };
}
