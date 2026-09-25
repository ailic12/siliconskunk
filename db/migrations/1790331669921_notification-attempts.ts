import { MigrationBuilder, ColumnDefinitions } from "node-pg-migrate";

export const shorthands: ColumnDefinitions | undefined = undefined;

/**
 * TASK-11: additive column supporting the outbox worker's max-attempts cap
 * (Pending/Sending -> Failed once attempts is exhausted) and backoff
 * (lease_expires_at is reused as a "not eligible before" gate even while
 * status='Pending', so no second timestamp column is needed).
 */
export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.addColumn("notification", {
    attempts: { type: "integer", notNull: true, default: 0 },
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropColumn("notification", "attempts");
}
