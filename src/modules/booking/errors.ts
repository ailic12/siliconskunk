export class ResourceNotFoundError extends Error {
  constructor(resourceId: string) {
    super(`Resource "${resourceId}" was not found.`);
    this.name = "ResourceNotFoundError";
  }
}

export class BookingNotFoundError extends Error {
  constructor(bookingId: string) {
    super(`Booking "${bookingId}" was not found.`);
    this.name = "BookingNotFoundError";
  }
}

export class ResourceNotBookableError extends Error {
  constructor(resourceId: string) {
    super(`Resource "${resourceId}" is not currently bookable.`);
    this.name = "ResourceNotBookableError";
  }
}

export class OutsideBookingWindowError extends Error {
  constructor(bookingDate: string) {
    super(`Booking date "${bookingDate}" is outside the allowed booking window.`);
    this.name = "OutsideBookingWindowError";
  }
}

export class InvalidBookingDateError extends Error {
  constructor(value: unknown) {
    super(`"${String(value)}" is not a valid booking date.`);
    this.name = "InvalidBookingDateError";
  }
}

export class ResourceConflictError extends Error {
  constructor() {
    super("This resource already has an active booking for that date.");
    this.name = "ResourceConflictError";
  }
}

export class EmployeeConflictError extends Error {
  constructor() {
    super("You already have an active booking of this type for that date.");
    this.name = "EmployeeConflictError";
  }
}
