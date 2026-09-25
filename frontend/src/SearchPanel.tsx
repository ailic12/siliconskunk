import { useState, type ReactElement } from "react";
import { createBooking, getAvailability, getBooking } from "./api";
import { describeApiError } from "./error-messages";
import { EMPLOYEES, OFFICES } from "./seed-identities";
import type { Employee, Resource, ResourceType, TimelineEventKind, TrackedBooking } from "./types";

interface SearchPanelProps {
  onBooked: (tracked: TrackedBooking) => void;
  onTimelineEvent: (kind: TimelineEventKind, message: string) => void;
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function SearchPanel({ onBooked, onTimelineEvent }: SearchPanelProps): ReactElement {
  const [employee, setEmployee] = useState<Employee>(EMPLOYEES[0]!);
  const [officeId, setOfficeId] = useState(OFFICES[0]!.id);
  const [resourceType, setResourceType] = useState<ResourceType>("Desk");
  const [date, setDate] = useState(todayIsoDate());
  const [results, setResults] = useState<Resource[] | null>(null);
  const [message, setMessage] = useState<{ text: string; kind: "success" | "error" } | null>(null);
  const [searching, setSearching] = useState(false);

  async function search(): Promise<void> {
    setSearching(true);
    setMessage(null);
    setResults(null);
    try {
      const res = await getAvailability(employee.devToken, officeId, resourceType, date);
      if (!res.ok) {
        setMessage({ text: describeApiError(res.status, res.body), kind: "error" });
        return;
      }
      setResults(res.body.resources);
      onTimelineEvent(
        "availability_refreshed",
        `Availability search: ${resourceType} on ${date} — ${res.body.resources.length} available (from a live GET /availability).`,
      );
    } catch (err) {
      setMessage({
        text: `Backend unavailable: ${err instanceof Error ? err.message : String(err)}`,
        kind: "error",
      });
    } finally {
      setSearching(false);
    }
  }

  async function book(resource: Resource): Promise<void> {
    setMessage(null);
    try {
      const res = await createBooking(employee.devToken, resource.id, date);
      if (!res.ok) {
        setMessage({ text: describeApiError(res.status, res.body), kind: "error" });
        return;
      }
      setMessage({ text: `Reserved: ${resource.name} on ${date}.`, kind: "success" });
      onTimelineEvent(
        "booking_created",
        `${employee.displayName} booked ${resource.name} for ${date} — Reserved (from the POST /bookings response).`,
      );

      const statusRes = await getBooking(employee.devToken, res.body.id);
      if (statusRes.ok) {
        onBooked({
          booking: statusRes.body,
          ownerToken: employee.devToken,
          ownerName: employee.displayName,
          resourceName: resource.name,
        });
      }
    } catch (err) {
      setMessage({
        text: `Backend unavailable: ${err instanceof Error ? err.message : String(err)}`,
        kind: "error",
      });
    }
  }

  return (
    <fieldset>
      <legend>Search availability</legend>

      <label htmlFor="employee-select">Act as</label>
      <select
        id="employee-select"
        value={employee.devToken}
        onChange={(e) => setEmployee(EMPLOYEES.find((emp) => emp.devToken === e.target.value)!)}
      >
        {EMPLOYEES.map((emp) => (
          <option key={emp.devToken} value={emp.devToken}>
            {emp.displayName}
          </option>
        ))}
      </select>

      <label htmlFor="office-select">Office</label>
      <select id="office-select" value={officeId} onChange={(e) => setOfficeId(e.target.value)}>
        {OFFICES.map((office) => (
          <option key={office.id} value={office.id}>
            {office.name}
          </option>
        ))}
      </select>

      <label htmlFor="resource-type-select">Resource type</label>
      <select
        id="resource-type-select"
        value={resourceType}
        onChange={(e) => setResourceType(e.target.value as ResourceType)}
      >
        <option value="Desk">Desk</option>
        <option value="ParkingSpace">ParkingSpace</option>
      </select>

      <label htmlFor="date-input">Date</label>
      <input id="date-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />

      <button type="button" onClick={() => void search()} disabled={searching}>
        {searching ? "Searching…" : "Search availability"}
      </button>

      {results && (
        <div data-testid="search-results">
          {results.length === 0 ? (
            <p>No available resources for this search.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {results.map((resource) => (
                  <tr key={resource.id}>
                    <td>{resource.name}</td>
                    <td>{resource.type}</td>
                    <td>{resource.status}</td>
                    <td>
                      <button type="button" onClick={() => void book(resource)}>
                        Book
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {message && <div className={`message ${message.kind}`}>{message.text}</div>}
    </fieldset>
  );
}
