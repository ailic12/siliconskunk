import { useState, type ReactElement } from "react";
import { createBooking, getAvailability, getBooking } from "./api";
import { belgradeLocalDate } from "./belgrade-date";
import { describeApiError } from "./error-messages";
import { BELGRADE_OFFICE_ID, SCENARIO_1_EMPLOYEE, SCENARIO_2_EMPLOYEE } from "./seed-identities";
import type { TimelineEventKind, TrackedBooking } from "./types";

interface DemoScenariosProps {
  onBooked: (tracked: TrackedBooking) => void;
  onTimelineEvent: (kind: TimelineEventKind, message: string) => void;
}

type ScenarioState = "idle" | "running" | "done" | "error";

/**
 * TASK-17 §H: two independent, non-interfering demo bookings, each set up
 * with one click by reusing the same search+book flow SearchPanel uses (no
 * duplicated business logic) — then the resulting booking's own card
 * (BookingCard) is where "Simulate check-in" (Scenario 1) or waiting for the
 * real scheduler (Scenario 2) actually happens.
 */
export function DemoScenarios({ onBooked, onTimelineEvent }: DemoScenariosProps): ReactElement {
  const [scenario1State, setScenario1State] = useState<ScenarioState>("idle");
  const [scenario2State, setScenario2State] = useState<ScenarioState>("idle");
  const [error1, setError1] = useState<string | undefined>();
  const [error2, setError2] = useState<string | undefined>();

  async function runScenario(params: {
    employee: typeof SCENARIO_1_EMPLOYEE;
    bookingDate: string;
    setState: (s: ScenarioState) => void;
    setError: (e: string | undefined) => void;
    scenarioLabel: string;
  }): Promise<void> {
    params.setState("running");
    params.setError(undefined);
    try {
      const availability = await getAvailability(
        params.employee.devToken,
        BELGRADE_OFFICE_ID,
        "Desk",
        params.bookingDate,
      );
      if (!availability.ok) {
        throw new Error(describeApiError(availability.status, availability.body));
      }
      const resource = availability.body.resources[0];
      if (!resource) {
        throw new Error(`No available Belgrade Desk found for ${params.bookingDate}.`);
      }

      const created = await createBooking(params.employee.devToken, resource.id, params.bookingDate);
      if (!created.ok) {
        throw new Error(describeApiError(created.status, created.body));
      }

      onTimelineEvent(
        "booking_created",
        `${params.scenarioLabel}: ${params.employee.displayName} booked ${resource.name} for ${params.bookingDate} — Reserved.`,
      );

      const status = await getBooking(params.employee.devToken, created.body.id);
      if (!status.ok) {
        throw new Error(describeApiError(status.status, status.body));
      }

      onBooked({
        booking: status.body,
        ownerToken: params.employee.devToken,
        ownerName: params.employee.displayName,
        resourceName: resource.name,
      });
      params.setState("done");
    } catch (err) {
      params.setState("error");
      params.setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <fieldset>
      <legend>Demo scenarios</legend>

      <div className="scenario">
        <h3>Scenario 1 — successful check-in</h3>
        <p>Books {SCENARIO_1_EMPLOYEE.displayName} a Belgrade Desk for tomorrow (office-local).</p>
        <button
          type="button"
          onClick={() =>
            void runScenario({
              employee: SCENARIO_1_EMPLOYEE,
              bookingDate: belgradeLocalDate(1),
              setState: setScenario1State,
              setError: setError1,
              scenarioLabel: "Scenario 1",
            })
          }
          disabled={scenario1State === "running"}
          data-testid="scenario-1-run"
        >
          {scenario1State === "running" ? "Booking…" : "Run Scenario 1 (book)"}
        </button>
        {scenario1State === "done" && (
          <p className="hint">Booked. Use "Simulate check-in" on the booking card below.</p>
        )}
        {scenario1State === "error" && <p className="error">{error1}</p>}
      </div>

      <div className="scenario">
        <h3>Scenario 2 — automatic release</h3>
        <p>Books {SCENARIO_2_EMPLOYEE.displayName} a different Belgrade Desk for today, deliberately not checked in.</p>
        <button
          type="button"
          onClick={() =>
            void runScenario({
              employee: SCENARIO_2_EMPLOYEE,
              bookingDate: belgradeLocalDate(0),
              setState: setScenario2State,
              setError: setError2,
              scenarioLabel: "Scenario 2",
            })
          }
          disabled={scenario2State === "running"}
          data-testid="scenario-2-run"
        >
          {scenario2State === "running" ? "Booking…" : "Run Scenario 2 (book, do not check in)"}
        </button>
        {scenario2State === "done" && (
          <p className="hint">
            Booked. Do not check in — wait for the running scheduler to release it (watch the card below).
          </p>
        )}
        {scenario2State === "error" && <p className="error">{error2}</p>}
      </div>
    </fieldset>
  );
}
