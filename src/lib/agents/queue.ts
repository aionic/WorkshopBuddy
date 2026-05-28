// Service Bus producer for agent runs.
// Web container sends a versioned envelope to the `agent-runs` queue; a
// Container Apps Job worker drains it.
import { ServiceBusClient } from "@azure/service-bus";
import { DefaultAzureCredential } from "@azure/identity";
import {
  AGENT_RUN_ENVELOPE_VERSION,
  agentRunEnvelopeSchema,
  type AgentRunEnvelope,
} from "./envelope";

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

export async function enqueueAgentRun(input: { runId: string; projectId: string }): Promise<void> {
  // Validate at the producer boundary so a typo or refactor fails fast
  // instead of silently corrupting the queue.
  const envelope: AgentRunEnvelope = agentRunEnvelopeSchema.parse({
    version: AGENT_RUN_ENVELOPE_VERSION,
    runId: input.runId,
    projectId: input.projectId,
  });
  const queue = process.env.SERVICEBUS_QUEUE ?? "agent-runs";
  const sender = getClient().createSender(queue);
  try {
    await sender.sendMessages({
      body: envelope,
      contentType: "application/json",
      messageId: envelope.runId,
    });
  } finally {
    await sender.close();
  }
}

export function isAgentRunQueueConfigured(): boolean {
  return !!process.env.SERVICEBUS_NAMESPACE;
}
