import { withTransaction } from "../../src/shared/db";
import { seedOffices } from "./offices";
import { seedResources } from "./resources";
import { seedPolicies } from "./policies";
import { seedEmployees, seedDevBearerTokens } from "./employees";
import { seedExternalMappings } from "./external-mappings";

export interface SeedSummary {
  officesInserted: number;
  resourcesInserted: number;
  policiesInserted: number;
  employeesInserted: number;
  devBearerTokensInserted: number;
  externalMappingsInserted: number;
}

/**
 * Idempotent: every row uses a fixed id (or, for dev_bearer_token, a fixed
 * token as its own primary key) and every insert is ON CONFLICT DO NOTHING,
 * so re-running against a non-empty DB is safe and produces no duplicate-key
 * errors.
 */
export async function runSeed(): Promise<SeedSummary> {
  return withTransaction(async (client) => {
    const officesInserted = await seedOffices(client);
    const resourcesInserted = await seedResources(client);
    const policiesInserted = await seedPolicies(client);
    const employeesInserted = await seedEmployees(client);
    const devBearerTokensInserted = await seedDevBearerTokens(client);
    const externalMappingsInserted = await seedExternalMappings(client);

    return {
      officesInserted,
      resourcesInserted,
      policiesInserted,
      employeesInserted,
      devBearerTokensInserted,
      externalMappingsInserted,
    };
  });
}
