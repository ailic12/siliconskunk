import { MigrationBuilder, ColumnDefinitions } from "node-pg-migrate";

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable("office", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    name: { type: "text", notNull: true },
    iana_timezone: { type: "text", notNull: true },
    country: { type: "text", notNull: true },
    active: { type: "boolean", notNull: true },
  });

  pgm.createTable("resource", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    office_id: { type: "uuid", notNull: true, references: "office", onDelete: "NO ACTION" },
    type: { type: "text", notNull: true },
    name: { type: "text", notNull: true },
    status: { type: "text", notNull: true },
    characteristics: { type: "jsonb", notNull: true, default: pgm.func("'{}'::jsonb") },
  });

  pgm.createTable("policy", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    office_id: { type: "uuid", notNull: true, references: "office", onDelete: "NO ACTION" },
    resource_type: { type: "text", notNull: false },
    booking_window_days: { type: "integer", notNull: true },
    release_deadline_local: { type: "time", notNull: true },
    accepted_evidence_methods: { type: "jsonb", notNull: true },
    employee_daily_limit: { type: "integer", notNull: true },
  });

  pgm.createTable("employee", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    entra_object_id: { type: "text", notNull: true, unique: true },
    home_office_id: { type: "uuid", notNull: true, references: "office", onDelete: "NO ACTION" },
    display_name: { type: "text", notNull: true },
    email: { type: "text", notNull: true },
    role_scope: { type: "text", notNull: true },
  });

  pgm.createTable("dev_bearer_token", {
    token: { type: "text", primaryKey: true },
    employee_id: { type: "uuid", notNull: true, references: "employee", onDelete: "NO ACTION" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });

  pgm.createTable("booking", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    resource_id: { type: "uuid", notNull: true, references: "resource", onDelete: "NO ACTION" },
    employee_id: { type: "uuid", notNull: true, references: "employee", onDelete: "NO ACTION" },
    booking_date: { type: "date", notNull: true },
    resource_type: { type: "text", notNull: true },
    status: { type: "text", notNull: true },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    updated_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });

  pgm.createIndex("booking", ["resource_id", "booking_date"], {
    name: "booking_resource_active_unique",
    unique: true,
    where: "status IN ('Reserved','CheckedIn')",
  });

  pgm.createIndex("booking", ["employee_id", "booking_date", "resource_type"], {
    name: "booking_employee_daily_active_unique",
    unique: true,
    where: "status IN ('Reserved','CheckedIn')",
  });

  pgm.createTable("checkin_evidence", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    booking_id: { type: "uuid", notNull: false, references: "booking", onDelete: "NO ACTION" },
    source_system: { type: "text", notNull: true },
    external_event_id: { type: "text", notNull: true },
    occurred_at: { type: "timestamptz", notNull: true },
    received_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    outcome: { type: "text", notNull: true },
  });

  pgm.addConstraint("checkin_evidence", "checkin_evidence_source_event_unique", {
    unique: ["source_system", "external_event_id"],
  });

  pgm.createTable("external_mapping", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    entity_type: { type: "text", notNull: true },
    entity_id: { type: "uuid", notNull: true },
    source_system: { type: "text", notNull: true },
    external_reference: { type: "text", notNull: true },
  });

  pgm.addConstraint("external_mapping", "external_mapping_source_reference_unique", {
    unique: ["source_system", "external_reference"],
  });

  pgm.createTable("notification", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    booking_id: { type: "uuid", notNull: true, references: "booking", onDelete: "NO ACTION" },
    type: { type: "text", notNull: true },
    channel: { type: "text", notNull: true },
    dedup_key: { type: "text", notNull: true, unique: true },
    status: { type: "text", notNull: true, default: "Pending" },
    lease_owner: { type: "text", notNull: false },
    lease_expires_at: { type: "timestamptz", notNull: false },
    sent_at: { type: "timestamptz", notNull: false },
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable("notification");
  pgm.dropTable("external_mapping");
  pgm.dropTable("checkin_evidence");
  pgm.dropIndex("booking", ["employee_id", "booking_date", "resource_type"], {
    name: "booking_employee_daily_active_unique",
  });
  pgm.dropIndex("booking", ["resource_id", "booking_date"], {
    name: "booking_resource_active_unique",
  });
  pgm.dropTable("booking");
  pgm.dropTable("dev_bearer_token");
  pgm.dropTable("employee");
  pgm.dropTable("policy");
  pgm.dropTable("resource");
  pgm.dropTable("office");
}
