export interface NotificationMessage {
  notificationId: string;
  bookingId: string;
  type: string;
  channel: string;
}

export interface NotificationChannel {
  send(message: NotificationMessage): Promise<void>;
}

export interface FakeNotificationChannelOptions {
  shouldFail?: () => boolean;
  latencyMs?: number;
}

/**
 * Mocked NotificationChannel (TASK-11, plan §1 decision 8): stands in for
 * Microsoft Graph/Teams/Email, which is explicitly out of scope for the PoC.
 * shouldFail/latencyMs let tests deterministically exercise the worker's
 * failure/backoff path without a real provider dependency.
 */
export class FakeNotificationChannel implements NotificationChannel {
  private readonly sentLog: NotificationMessage[] = [];

  constructor(private readonly options: FakeNotificationChannelOptions = {}) {}

  async send(message: NotificationMessage): Promise<void> {
    if (this.options.latencyMs) {
      await new Promise((resolve) => setTimeout(resolve, this.options.latencyMs));
    }
    if (this.options.shouldFail?.()) {
      throw new Error(`FakeNotificationChannel: simulated send failure for ${message.notificationId}`);
    }
    this.sentLog.push(message);
  }

  getSentLog(): readonly NotificationMessage[] {
    return this.sentLog;
  }
}
