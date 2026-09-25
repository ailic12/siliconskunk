import type { CheckInEvent } from "../../checkin-contract";
import { InvalidCheckInEventError } from "../../checkin-contract";
import type { CheckinAdapter } from "../registry";

const PROVIDER = "test-harness";
const DEMO_SECRET = "test-harness-demo-secret";

interface AdminConfirmationPayload {
  confirmationId?: string;
  subjectRef?: string;
  confirmedAt?: string;
}

export const testHarnessAdapter: CheckinAdapter = {
  provider: PROVIDER,
  validateCredential(credential) {
    return credential === DEMO_SECRET;
  },
  translate(payload): CheckInEvent {
    const body = (payload ?? {}) as AdminConfirmationPayload;
    if (!body.confirmationId || !body.subjectRef || !body.confirmedAt) {
      throw new InvalidCheckInEventError(
        "<test-harness-payload>",
        "must include confirmationId, subjectRef, confirmedAt",
      );
    }
    return {
      sourceSystem: "admin",
      externalEventId: body.confirmationId,
      subjectReference: body.subjectRef,
      occurredAt: body.confirmedAt,
      receivedAt: new Date().toISOString(),
    };
  },
};
