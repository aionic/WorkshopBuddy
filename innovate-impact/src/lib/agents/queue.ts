// Service Bus producer for agent runs.
// Web container sends a small envelope { runId, projectId } to the
// `agent-runs` queue; a Container Apps Job worker drains it.
import { ServiceBusClient } from "@azure/service-bus";
import { DefaultAzureCredential } from "@azure/identity";

let cachedClient: ServiceBusClient | null = null;

function getClient(): ServiceBusClient {
  if (cachedClient) return cachedClient;
  const namespace = process.env.SERVICEBUS_NAMESPACE;
  if (!namespace) throw new Error("SERVICEBUS_NAMESPACE not configured");
  const credential = new DefaultAzureCredential({
    managedIdentityClientId: process.env.AZURE_CLIENT_ID
  });
  cachedClient = new ServiceBusClient(namespace, credential);
  return cachedClient;
}

export async function enqueueAgentRun(envelope: { runId: string; projectId: string }): Promise<void> {
  const queue = process.env.SERVICEBUS_QUEUE ?? "agent-runs";
  const sender = getClient().createSender(queue);
  try {
    await sender.sendMessages({
      body: envelope,
      contentType: "application/json",
      messageId: envelope.runId
    });
  } finally {
    await sender.close();
  }
}

export function isAgentRunQueueConfigured(): boolean {
  return !!process.env.SERVICEBUS_NAMESPACE;
}
