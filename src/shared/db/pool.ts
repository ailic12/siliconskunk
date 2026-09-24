import { Pool, types } from "pg";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env and configure it.");
}

// DATE columns (e.g. booking.booking_date) represent a plain office-local
// calendar day (BR-01) with no time component. pg's default parser returns
// a JS Date, which reintroduces a timezone interpretation this domain
// deliberately avoids — keep it as the raw "YYYY-MM-DD" string instead.
types.setTypeParser(types.builtins.DATE, (value: string) => value);

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
