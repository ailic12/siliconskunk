import type { CheckInEvent } from "../checkin-contract";

export interface CheckinAdapter {
  provider: string;
  /** Validates the provider-specific credential from the request; never Entra ID (HLD §7.1). */
  validateCredential(credential: string | undefined): boolean;
  /** Validates and translates this provider's own payload shape into the canonical contract. */
  translate(payload: unknown): CheckInEvent;
}

const adapters = new Map<string, CheckinAdapter>();

/**
 * Lets a new provider be added by registering a route here, without any
 * change to ingress.routes.ts (proven by TASK-07/TASK-13).
 */
export function registerCheckinAdapter(adapter: CheckinAdapter): void {
  adapters.set(adapter.provider, adapter);
}

export function getCheckinAdapter(provider: string): CheckinAdapter | undefined {
  return adapters.get(provider);
}

export function unregisterCheckinAdapter(provider: string): void {
  adapters.delete(provider);
}
