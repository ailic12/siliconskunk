import { findPoliciesForOfficeAndType, type Policy } from "./policy.repository";
import type { ResourceType } from "./resource.repository";

/**
 * Most-specific-wins: a policy row scoped to the exact resource type
 * overrides the office-wide (resource_type IS NULL) row for that type.
 */
export function resolveEffectivePolicy(policies: Policy[], resourceType: ResourceType): Policy {
  const specific = policies.find((p) => p.resourceType === resourceType);
  if (specific) return specific;

  const generic = policies.find((p) => p.resourceType === null);
  if (generic) return generic;

  throw new Error(`No applicable policy found for resource type "${resourceType}".`);
}

export async function getEffectivePolicy(
  officeId: string,
  resourceType: ResourceType,
): Promise<Policy> {
  const policies = await findPoliciesForOfficeAndType(officeId, resourceType);
  return resolveEffectivePolicy(policies, resourceType);
}
