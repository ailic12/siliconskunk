import dotenv from "dotenv";
dotenv.config();

import { pool } from "../../src/shared/db";
import { runSeed } from "../../db/seed";

async function main(): Promise<void> {
  const summary = await runSeed();
  console.log("Seed complete:");
  console.log(`  offices inserted:            ${summary.officesInserted}`);
  console.log(`  resources inserted:          ${summary.resourcesInserted}`);
  console.log(`  policies inserted:           ${summary.policiesInserted}`);
  console.log(`  employees inserted:          ${summary.employeesInserted}`);
  console.log(`  dev bearer tokens inserted:  ${summary.devBearerTokensInserted}`);
  console.log(`  external mappings inserted:  ${summary.externalMappingsInserted}`);
}

main()
  .then(() => pool.end())
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    pool.end().finally(() => process.exit(1));
  });
