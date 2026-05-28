// Agent run worker — consumes Service Bus messages and executes the
// orchestrator out-of-band from the web container. Runs as a Container
// Apps Job (KEDA azure-servicebus trigger).
//
// Lifecycle per message:
//   1. Receive { runId, projectId } with peek-lock; auto-renew lock.
//   2. Load run + project + inputs, set AgentRun.status=Running + startedAt.
//   3. Run orchestrator; persist artifacts (upsert by type with versioning).
//   4. Set AgentRun.status=Completed + completedAt + outputJson.
//   5. completeMessage(). On error: 1 auto-retry by Service Bus, then DLQ;
//      we mark the run Failed so the UI surfaces it immediately.
//
// Env:
//   SERVICEBUS_NAMESPACE   workshop-buddy-bus.servicebus.windows.net (FQDN)
//   SERVICEBUS_QUEUE       agent-runs
//   DATABASE_URL           postgres URL (Entra-token auth at pool level)
//   AZURE_CLIENT_ID        workload UAMI client id
//   plus AI_PROVIDER + AZURE_FOUNDRY_* same as web container.

import { ServiceBusClient, type ServiceBusReceivedMessage } from "@azure/service-bus";
import { DefaultAzureCredential } from "@azure/identity";
import { prisma } from "../src/lib/db";
import { runInnovationWorkflow } from "../src/lib/agents/orchestrator";
import { persistArtifacts } from "../src/lib/agents/persist-artifacts";
import {
  agentRunEnvelopeSchema,
  truncate,
  type AgentRunEnvelope,
} from "../src/lib/agents/envelope";

type Envelope = AgentRunEnvelope;

const TERMINAL_STATUSES = new Set(["Completed", "Failed", "Cancelled"]);

async function handleRun(envelope: Envelope): Promise<void> {
  const { runId, projectId } = envelope;
  console.log(`[worker] run=${runId} project=${projectId} starting`);

  const run = await prisma.agentRun.findUnique({ where: { id: runId } });
  if (!run) {
    console.warn(`[worker] run ${runId} not found in DB; dropping message`);
    return;
  }
  // S-4: idempotency — if a prior delivery already completed/failed this
  // run, ack and move on instead of re-executing the orchestrator.
  if (TERMINAL_STATUSES.has(run.status)) {
    console.log(`[worker] run=${runId} already ${run.status}; skipping`);
    return;
  }
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { inputs: true }
  });
  if (!project) {
    await prisma.agentRun.update({
      where: { id: runId },
      data: {
        status: "Failed",
        completedAt: new Date(),
        outputJson: JSON.stringify({ error: truncate(`Project ${projectId} not found`) })
      }
    });
    return;
  }

  const inputBody = (() => {
    try { return JSON.parse(run.inputJson) as { mode?: string; artifactTypes?: any; customInstructions?: string }; }
    catch { return {}; }
  })();

  await prisma.agentRun.update({
    where: { id: runId },
    data: { status: "Running", startedAt: run.startedAt ?? new Date() }
  });

  try {
    const result = await runInnovationWorkflow(project, project.inputs, {
      artifactTypes: inputBody.artifactTypes,
      customInstructions: inputBody.customInstructions
    });

    // S-6: shared persistence routine (also used by the web fallback path).
    await persistArtifacts(project.id, result.artifacts);

    await prisma.agentRun.update({
      where: { id: runId },
      data: {
        status: "Completed",
        completedAt: new Date(),
        outputJson: JSON.stringify({
          agents: result.agents.map((a) => ({
            name: a.name, status: a.status, summary: a.summary,
            usedLLM: a.usedLLM, llmError: a.llmError, durationMs: a.durationMs
          })),
          review: result.review,
          usedLiveAI: result.usedLiveAI
        }),
        logJson: JSON.stringify(result.agents.map((a) => ({ name: a.name, status: a.status })))
      }
    });
    console.log(`[worker] run=${runId} completed`);
  } catch (err) {
    const msg = truncate((err as Error)?.message ?? String(err));
    console.error(`[worker] run=${runId} failed:`, msg);
    await prisma.agentRun
      .update({
        where: { id: runId },
        data: {
          status: "Failed",
          completedAt: new Date(),
          outputJson: JSON.stringify({ error: msg })
        }
      })
      .catch((e) => console.error(`[worker] failed to mark run ${runId} Failed:`, e));
    throw err; // let Service Bus retry/DLQ
  }
}

async function main(): Promise<void> {
  const namespace = process.env.SERVICEBUS_NAMESPACE;
  const queue = process.env.SERVICEBUS_QUEUE ?? "agent-runs";
  if (!namespace) {
    console.error("[worker] SERVICEBUS_NAMESPACE not set");
    process.exit(1);
  }

  const credential = new DefaultAzureCredential({
    managedIdentityClientId: process.env.AZURE_CLIENT_ID
  });
  const sbClient = new ServiceBusClient(namespace, credential);
  const receiver = sbClient.createReceiver(queue, { receiveMode: "peekLock" });
  console.log(`[worker] listening on ${namespace}/${queue}`);

  // Container Apps Jobs (Event trigger) start one replica per pending message
  // batch. We process available messages, then exit so KEDA can scale down.
  // Run until either the queue is drained or we've processed for a max window.
  const maxRuntimeMs = 25 * 60 * 1000; // 25 min cap (under default 30m job timeout)
  const deadline = Date.now() + maxRuntimeMs;
  let totalProcessed = 0;

  while (Date.now() < deadline) {
    const remaining = Math.max(5_000, deadline - Date.now());
    const batch = await receiver.receiveMessages(1, { maxWaitTimeInMs: Math.min(30_000, remaining) });
    if (batch.length === 0) {
      console.log(`[worker] no more messages; processed=${totalProcessed}; exiting`);
      break;
    }
    const msg: ServiceBusReceivedMessage = batch[0];
    const renewer = setInterval(() => {
      receiver.renewMessageLock(msg).catch((e) => console.warn("[worker] lock renew failed:", e?.message));
    }, 30_000);
    try {
      const parsed = agentRunEnvelopeSchema.safeParse(msg.body);
      if (!parsed.success) {
        console.warn("[worker] envelope failed validation; dead-lettering", parsed.error.issues);
        await receiver.deadLetterMessage(msg, {
          deadLetterReason: "envelope-validation-failed",
          deadLetterErrorDescription: truncate(JSON.stringify(parsed.error.issues), 1024),
        });
      } else {
        await handleRun(parsed.data);
        await receiver.completeMessage(msg);
      }
      totalProcessed++;
    } catch (err) {
      console.error("[worker] handler threw; abandoning for retry:", err);
      await receiver.abandonMessage(msg).catch(() => {});
    } finally {
      clearInterval(renewer);
    }
  }

  await receiver.close();
  await sbClient.close();
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("[worker] fatal:", err);
  process.exit(1);
});
