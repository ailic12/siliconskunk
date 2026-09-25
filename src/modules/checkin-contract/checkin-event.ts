export interface CheckInEvent {
  sourceSystem: string;
  externalEventId: string;
  subjectReference: string;
  occurredAt: string;
  receivedAt: string;
}
