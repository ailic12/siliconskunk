import { workCheckinEvents } from "../../shared/queue";
import { processCheckInEvent } from "./checkin-gateway.service";

export function registerCheckinGatewayWorker(): Promise<string> {
  return workCheckinEvents(processCheckInEvent);
}
