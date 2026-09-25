import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Clock } from "../../shared/clock";
import { createBooking, getAvailability, getBookingForEmployee } from "./booking.service";
import {
  BookingNotFoundError,
  EmployeeConflictError,
  InvalidBookingDateError,
  OutsideBookingWindowError,
  ResourceConflictError,
  ResourceNotBookableError,
  ResourceNotFoundError,
} from "./errors";

const RESOURCE_TYPES = ["Desk", "ParkingSpace"] as const;
type ResourceTypeParam = (typeof RESOURCE_TYPES)[number];

const UUID_FORMAT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isResourceType(value: unknown): value is ResourceTypeParam {
  return typeof value === "string" && (RESOURCE_TYPES as readonly string[]).includes(value);
}

function isDateString(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_FORMAT.test(value);
}

interface AvailabilityQuery {
  officeId?: string;
  resourceType?: string;
  date?: string;
}

interface CreateBookingBody {
  resourceId?: string;
  bookingDate?: string;
}

export function registerBookingRoutes(app: FastifyInstance, clock: Clock): void {
  app.get(
    "/availability",
    async (request: FastifyRequest<{ Querystring: AvailabilityQuery }>, reply: FastifyReply) => {
      const { officeId, resourceType, date } = request.query;

      if (!isUuid(officeId)) {
        return reply
          .status(400)
          .send({ error: "bad_request", message: "officeId must be a valid UUID." });
      }
      if (!isResourceType(resourceType)) {
        return reply
          .status(400)
          .send({ error: "bad_request", message: "resourceType must be Desk or ParkingSpace." });
      }
      if (!isDateString(date)) {
        return reply.status(400).send({
          error: "bad_request",
          message: "date must be an ISO calendar date (YYYY-MM-DD).",
        });
      }

      const resources = await getAvailability(officeId, resourceType, date);
      return reply.status(200).send({ resources });
    },
  );

  app.post(
    "/bookings",
    async (request: FastifyRequest<{ Body: CreateBookingBody }>, reply: FastifyReply) => {
      const { resourceId, bookingDate } = request.body ?? {};

      if (!isUuid(resourceId)) {
        return reply
          .status(400)
          .send({ error: "bad_request", message: "resourceId must be a valid UUID." });
      }

      try {
        const booking = await createBooking(
          clock,
          request.identity.employeeId,
          resourceId,
          bookingDate,
        );
        return reply.status(201).send(booking);
      } catch (err) {
        if (err instanceof InvalidBookingDateError) {
          return reply.status(400).send({ error: "bad_request", message: err.message });
        }
        if (err instanceof ResourceNotFoundError) {
          return reply.status(404).send({ error: "not_found", message: err.message });
        }
        if (err instanceof ResourceNotBookableError) {
          return reply.status(422).send({
            error: "unprocessable_entity",
            reason: "resource_not_bookable",
            message: err.message,
          });
        }
        if (err instanceof OutsideBookingWindowError) {
          return reply.status(422).send({
            error: "unprocessable_entity",
            reason: "outside_booking_window",
            message: err.message,
          });
        }
        if (err instanceof ResourceConflictError) {
          return reply.status(409).send({
            error: "conflict",
            reason: "resource_already_booked",
            message: err.message,
          });
        }
        if (err instanceof EmployeeConflictError) {
          return reply.status(409).send({
            error: "conflict",
            reason: "employee_daily_limit_reached",
            message: err.message,
          });
        }
        throw err;
      }
    },
  );

  app.get(
    "/bookings/:id",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;

      if (!isUuid(id)) {
        return reply.status(404).send({ error: "not_found", message: "Booking not found." });
      }

      try {
        const booking = await getBookingForEmployee(id, request.identity.employeeId);
        return reply.status(200).send(booking);
      } catch (err) {
        if (err instanceof BookingNotFoundError) {
          return reply.status(404).send({ error: "not_found", message: err.message });
        }
        throw err;
      }
    },
  );
}
