export class UnknownProviderError extends Error {
  constructor(provider: string) {
    super(`No check-in adapter is registered for provider "${provider}".`);
    this.name = "UnknownProviderError";
  }
}

export class InvalidProviderCredentialError extends Error {
  constructor(provider: string) {
    super(`Missing or invalid credential for provider "${provider}".`);
    this.name = "InvalidProviderCredentialError";
  }
}

export class InvalidProviderPayloadError extends Error {
  constructor(provider: string, reason: string) {
    super(`Invalid payload for provider "${provider}": ${reason}`);
    this.name = "InvalidProviderPayloadError";
  }
}
