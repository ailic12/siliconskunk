import type { BookingWithDeadline, Booking, Resource, ResourceType } from "./types";

export interface ApiOk<T> {
  ok: true;
  status: number;
  body: T;
}

export interface ApiError {
  ok: false;
  status: number;
  body: { error?: string; reason?: string; message?: string };
}

export type ApiResult<T> = ApiOk<T> | ApiError;

/**
 * Every call here reuses an existing, unchanged backend contract verbatim
 * (TASK-17 "API contracts consumed") — no client-side re-implementation of
 * server-side validation or business rules. A network/fetch failure (backend
 * unavailable) is left to throw, distinct from an HTTP error response (§G).
 */
async function apiFetch<T>(path: string, init: RequestInit): Promise<ApiResult<T>> {
  const res = await fetch(path, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, status: res.status, body };
  }
  return { ok: true, status: res.status, body: body as T };
}

export function getAvailability(
  token: string,
  officeId: string,
  resourceType: ResourceType,
  date: string,
): Promise<ApiResult<{ resources: Resource[] }>> {
  const params = new URLSearchParams({ officeId, resourceType, date });
  return apiFetch(`/availability?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function createBooking(
  token: string,
  resourceId: string,
  bookingDate: string,
): Promise<ApiResult<Booking>> {
  return apiFetch("/bookings", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ resourceId, bookingDate }),
  });
}

export function getBooking(
  token: string,
  bookingId: string,
): Promise<ApiResult<BookingWithDeadline>> {
  return apiFetch(`/bookings/${bookingId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

/**
 * Real Check-in Ingress API call (TASK-06/07), never simulated client-side.
 * The demo-secret credential is the same publicly-documented dev fixture the
 * approved task file itself specifies for this adapter.
 */
export function submitAppQrCheckin(
  bookingReference: string,
  scannedAt: string,
): Promise<ApiResult<{ status: string }>> {
  return apiFetch("/integrations/checkin/app-qr", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-provider-api-key": "app-qr-demo-secret",
    },
    body: JSON.stringify({
      eventId: crypto.randomUUID(),
      bookingReference,
      scannedAt,
    }),
  });
}
