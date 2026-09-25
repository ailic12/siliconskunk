import type { Employee, Office } from "./types";

/**
 * Mirrors db/seed/employees.ts and db/seed/offices.ts (dev-only fixtures,
 * already public in the repository) — same technique TASK-15's original
 * public/index.html used for its "Act as" selector.
 */
export const EMPLOYEES: Employee[] = [
  { displayName: "Alice Petrovic", devToken: "dev-token-alice" },
  { displayName: "Bojan Jovanovic", devToken: "dev-token-bojan" },
  { displayName: "Catalina Nikolic", devToken: "dev-token-catalina" },
  { displayName: "Daniel Tan", devToken: "dev-token-daniel" },
  { displayName: "Eunice Lim", devToken: "dev-token-eunice" },
  { displayName: "Farhan Rahman", devToken: "dev-token-farhan" },
];

export const OFFICES: Office[] = [
  { id: "00000000-0000-4000-8000-000000000001", name: "Belgrade HQ" },
  { id: "00000000-0000-4000-8000-000000000002", name: "Singapore Hub" },
];

export const BELGRADE_OFFICE_ID = OFFICES[0]!.id;

// Scenario 1 (successful check-in) and Scenario 2 (automatic release) use two
// distinct seeded employees (TASK-17 §H) so they can never collide under
// BR-02 (one active booking per employee/resource-type/day).
export const SCENARIO_1_EMPLOYEE = EMPLOYEES[0]!; // Alice
export const SCENARIO_2_EMPLOYEE = EMPLOYEES[1]!; // Bojan
