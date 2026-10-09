import {createHash} from "node:crypto";
import {DynamoDBClient} from "@aws-sdk/client-dynamodb";
import {DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand} from "@aws-sdk/lib-dynamodb";
import {SQSClient, SendMessageCommand, CreateQueueCommand} from "@aws-sdk/client-sqs";
import {store} from "./store";
import type {RingEvent} from "./ring";
type Job = {orgId: string; connectionId: string; event: RingEvent; id: string; done: boolean; lease: number; ttl: number};
const table = process.env.SMARTDETECTOR_TABLE;
const db = DynamoDBDocumentClient.from(new DynamoDBClient({endpoint: process.env.SMARTDETECTOR_DYNAMODB_ENDPOINT}));
const memory = new Map<string, Job>();
const key = (orgId: string, id: string) => ({pk: "ORG#" + orgId, sk: "RINGJOB#" + id});
export function ringJobId(connectionId: string, requestId: string) {return createHash("sha256").update(connectionId + ":" + requestId).digest("hex");}
export async function queueRingEvent(orgId: string, connectionId: string, event: RingEvent) {
  if (!await store.organizationById(orgId)) throw new Error("Unknown organization");
  const id = ringJobId(connectionId, event.requestId), job: Job = {orgId, connectionId, event, id, done: false, lease: 0, ttl: Math.floor(Date.now()/1000) + 604800};
  if (table) {try {await db.send(new PutCommand({TableName: table, Item: {...key(orgId,id), ...job}, ConditionExpression: "attribute_not_exists(pk)"}));} catch (e) {if (!(e instanceof Error && e.name === "ConditionalCheckFailedException")) throw e;}}
  else if (!memory.has(orgId + id)) memory.set(orgId + id, job);
  const queue = process.env.SMARTDETECTOR_QUEUE_URL; if (!queue) throw new Error("Ring queue is not configured");
  const sqs = new SQSClient({endpoint: process.env.SMARTDETECTOR_QUEUE_ENDPOINT});
  const command = new SendMessageCommand({QueueUrl: queue, MessageBody: JSON.stringify({kind: "ring", orgId, id})});
  try {await sqs.send(command);} catch (e) {if (process.env.SMARTDETECTOR_LOCAL_QUEUE_AUTOCREATE === "true" && e instanceof Error && e.name === "QueueDoesNotExist") {await sqs.send(new CreateQueueCommand({QueueName: queue.split("/").pop()!})); await sqs.send(command);} else throw e;}
  return id;
}
export async function claimRingJob(orgId: string, id: string) {
  const job = table ? (await db.send(new GetCommand({TableName: table, Key: key(orgId,id), ConsistentRead: true}))).Item as Job | undefined : memory.get(orgId + id);
  if (!job || job.ttl <= Date.now()/1000) throw new Error("Expired Ring job");
  if (job.done) return null;
  const now = Date.now(), lease = now + 300000;
  if (table) await db.send(new UpdateCommand({TableName: table, Key: key(orgId,id), UpdateExpression: "SET lease=:lease", ConditionExpression: "done=:false AND lease<:now", ExpressionAttributeValues: {":lease": lease, ":now": now, ":false": false}}));
  else {if (job.lease >= now) throw new Error("Ring job already processing"); job.lease = lease;}
  return {...job, lease};
}
export async function finishRingJob(orgId: string, id: string, lease: number, done: boolean) {
  if (table) await db.send(new UpdateCommand({TableName: table, Key: key(orgId,id), UpdateExpression: "SET done=:done, lease=:zero", ConditionExpression: "lease=:lease", ExpressionAttributeValues: {":done": done, ":zero": 0, ":lease": lease}}));
  else {const job = memory.get(orgId + id); if (job?.lease === lease) {job.done = done; job.lease = 0;}}
}
