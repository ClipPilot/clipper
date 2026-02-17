import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  UpdateCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { ServiceCheck, DailyUptime } from "./types";

const TABLE_NAME = "clipster-status-checks-prod";
const REGION = "us-west-2";
const TTL_DAYS = 91;

let docClient: DynamoDBDocumentClient | null = null;

function getClient(): DynamoDBDocumentClient {
  if (docClient) return docClient;
  const client = new DynamoDBClient({ region: REGION });
  docClient = DynamoDBDocumentClient.from(client);
  return docClient;
}

function todayUTC(): string {
  return new Date().toISOString().split("T")[0];
}

function ninetyDaysAgo(): string {
  const d = new Date();
  d.setDate(d.getDate() - 90);
  return d.toISOString().split("T")[0];
}

export async function recordCheck(check: ServiceCheck): Promise<void> {
  const client = getClient();
  if (!client) return;

  const failed = check.status === "outage" ? 1 : 0;
  const ttl = Math.floor(Date.now() / 1000) + TTL_DAYS * 86400;

  await client.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { serviceId: check.id, date: todayUTC() },
      UpdateExpression:
        "ADD checks :one, failures :f, totalResponseTime :rt SET expiresAt = :ttl",
      ExpressionAttributeValues: {
        ":one": 1,
        ":f": failed,
        ":rt": check.responseTime,
        ":ttl": ttl,
      },
    })
  );
}

export async function recordChecks(checks: ServiceCheck[]): Promise<void> {
  await Promise.all(checks.map(recordCheck));
}

export async function getHistory(serviceId: string): Promise<DailyUptime[]> {
  const client = getClient();
  if (!client) return [];

  const result = await client.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "serviceId = :sid AND #d >= :start",
      ExpressionAttributeNames: { "#d": "date" },
      ExpressionAttributeValues: {
        ":sid": serviceId,
        ":start": ninetyDaysAgo(),
      },
      ScanIndexForward: true,
    })
  );

  return (result.Items || []).map((item) => ({
    date: item.date as string,
    checks: (item.checks as number) || 0,
    failures: (item.failures as number) || 0,
    avgResponseTime:
      (item.checks as number) > 0
        ? Math.round((item.totalResponseTime as number) / (item.checks as number))
        : 0,
    uptimePercent:
      (item.checks as number) > 0
        ? Number(
            (
              (((item.checks as number) - (item.failures as number)) /
                (item.checks as number)) *
              100
            ).toFixed(2)
          )
        : 100,
  }));
}

export async function getAllHistory(
  serviceIds: string[]
): Promise<Record<string, DailyUptime[]>> {
  const entries = await Promise.all(
    serviceIds.map(async (id) => [id, await getHistory(id)] as const)
  );
  return Object.fromEntries(entries);
}

export function isStoreConfigured(): boolean {
  return true;
}
