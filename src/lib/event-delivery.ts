import {
  SQSClient,
  SendMessageCommand,
  CreateQueueCommand,
} from "@aws-sdk/client-sqs";
import {
  EventBridgeClient,
  PutEventsCommand,
} from "@aws-sdk/client-eventbridge";
const queue = process.env.SMARTDETECTOR_QUEUE_URL,
  bus = process.env.SMARTDETECTOR_EVENT_BUS;
const sqs = new SQSClient({
  endpoint: process.env.SMARTDETECTOR_QUEUE_ENDPOINT,
});
export async function deliverIncident(tenantId: string, incidentId: string) {
  return deliver({ kind: "incident", tenantId, incidentId });
}
export async function deliverTvAlert(
  tenantId: string,
  incidentId: string,
  connectionId: string
) {
  return deliver({ kind: "tv-alert", tenantId, incidentId, connectionId });
}
async function deliver(detail: {
  kind: "incident" | "tv-alert";
  tenantId: string;
  incidentId: string;
  connectionId?: string;
}) {
  if (bus) {
    const r = await new EventBridgeClient({}).send(
      new PutEventsCommand({
        Entries: [
          {
            EventBusName: bus,
            Source: "smartdetector",
            DetailType: "IncidentCreated",
            Detail: JSON.stringify(detail),
          },
        ],
      })
    );
    if (r.FailedEntryCount)
      throw new Error("EventBridge rejected incident delivery");
    return;
  }
  if (!queue) return;
  try {
    await sqs.send(
      new SendMessageCommand({
        QueueUrl: queue,
        MessageBody: JSON.stringify(detail),
      })
    );
  } catch (e) {
    if (
      process.env.SMARTDETECTOR_LOCAL_QUEUE_AUTOCREATE === "true" &&
      e instanceof Error &&
      e.name === "QueueDoesNotExist"
    ) {
      await sqs.send(
        new CreateQueueCommand({ QueueName: queue.split("/").pop()! })
      );
      await sqs.send(
        new SendMessageCommand({
          QueueUrl: queue,
          MessageBody: JSON.stringify(detail),
        })
      );
    } else throw e;
  }
}
