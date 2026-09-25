import type { CheckInEvent } from "../../checkin-contract";
import { InvalidCheckInEventError } from "../../checkin-contract";
import type { CheckinAdapter } from "../registry";

const PROVIDER = "app-qr";
const DEMO_SECRET = "app-qr-demo-secret";

interface AppQrPayload {
  eventId?: string;
  bookingReference?: string;
  employeeBadge?: string;
  scannedAt?: string;
}

export const appQrAdapter: CheckinAdapter = {
  provider: PROVIDER,
  validateCredential(credential) {
    return credential === DEMO_SECRET;
  },
  translate(payload): CheckInEvent {
    const body = (payload ?? {}) as AppQrPayload;
    if (!body.eventId || !body.bookingReference || !body.scannedAt) {
      throw new InvalidCheckInEventError(
        "<app-qr-payload>",
        "must include eventId, bookingReference, scannedAt",
      );
    }
    return {
      sourceSystem: PROVIDER,
      externalEventId: body.eventId,
      subjectReference: body.bookingReference,
      occurredAt: body.scannedAt,
      receivedAt: new Date().toISOString(),
    };
  },
};
