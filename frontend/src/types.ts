export interface Employee {
  displayName: string;
  devToken: string;
}

export interface Office {
  id: string;
  name: string;
}

export type ResourceType = "Desk" | "ParkingSpace";

export interface Resource {
  id: string;
  officeId: string;
  type: ResourceType;
  name: string;
  status: string;
}

export type BookingStatus = "Reserved" | "CheckedIn" | "Released" | "Cancelled";

export interface Booking {
  id: string;
  resourceId: string;
  employeeId: string;
  bookingDate: string;
  resourceType: ResourceType;
  status: BookingStatus;
  createdAt: string;
}

export interface BookingWithDeadline extends Booking {
  checkInDeadline: string;
}

/** A booking this browser session created, plus enough context (owner token,
 * resource name) to poll and check it in without re-fetching search results. */
export interface TrackedBooking {
  booking: BookingWithDeadline;
  ownerToken: string;
  ownerName: string;
  resourceName: string;
}

export type TimelineEventKind =
  | "booking_created"
  | "checkin_submitted"
  | "checkin_confirmed"
  | "release_confirmed"
  | "availability_refreshed"
  | "error";

export interface TimelineEvent {
  id: string;
  kind: TimelineEventKind;
  message: string;
  at: string;
}
