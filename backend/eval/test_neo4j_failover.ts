import dotenv from "dotenv";
dotenv.config();

import { runChatPipeline } from "../src/lib/pipeline/orchestrator";
import { memoryStoreAdapter } from "../src/lib/pipeline/memoryStoreAdapter";
import { getMultiAIProvider } from "../src/lib/ai";
import { NemotronUltraProvider } from "../src/lib/ai/nemotronProvider";
import { closeNeo4jDriver } from "../src/lib/graph/neo4jClient";

async function main() {
  console.log("=================================================");
  console.log("STEP 1: Run Chat Pipeline with NORMAL Neo4j");
  console.log("=================================================");

  const ai = getMultiAIProvider();
  const key = process.env.NVIDIA_API_KEY;
  const llm = key && !key.includes("placeholder") ? new NemotronUltraProvider() : undefined;

  const normalDeps = {
    store: memoryStoreAdapter,
    generate: (msgs: any[], sys: string) => ai.generateWithDetails(msgs, sys),
    classifier: undefined, // regex
    reviewer: llm,
  };

  const testMessage = "I am feeling so anxious and haven't been able to sleep for days.";

  const normalResult = await runChatPipeline(normalDeps, {
    user: { id: "test-user-normal" },
    rawConversationId: "convo-normal-1",
    rawMessage: testMessage,
  });

  console.log(`[Normal Run] Risk: ${normalResult.risk}`);
  console.log(`[Normal Run] Provider: ${normalResult.provider} (${normalResult.model})`);
  console.log(`[Normal Run] Graph Topics: ${JSON.stringify(normalResult.graphTopics)}`);
  console.log(`[Normal Run] Context Sections: ${JSON.stringify(normalResult.contextSections)}`);
  console.log(`[Normal Run] Reply Snippet: "${normalResult.reply.slice(0, 150)}..."`);

  console.log("\n=================================================");
  console.log("STEP 2: Misconfigure / Break Neo4j Connection");
  console.log("=================================================");
  // Close any existing driver connection
  await closeNeo4jDriver();

  // Sabotage the URI to an invalid, unreachable host
  const originalUri = process.env.NEO4J_URI;
  process.env.NEO4J_URI = "neo4j+s://invalid-unreachable-instance.databases.neo4j.io";
  console.log(`Setting NEO4J_URI to misconfigured value: ${process.env.NEO4J_URI}`);

  console.log("\nRunning Chat Pipeline with misconfigured Neo4j...");
  const degradedResult = await runChatPipeline(normalDeps, {
    user: { id: "test-user-degraded" },
    rawConversationId: "convo-degraded-1",
    rawMessage: testMessage,
  });

  console.log("\n=================================================");
  console.log("RESULTS: Pipeline Verification After Neo4j Failure");
  console.log("=================================================");
  console.log(`Reply returned successfully: ${Boolean(degradedResult.reply && degradedResult.reply.length > 0)}`);
  console.log(`Reply Length: ${degradedResult.reply.length} chars`);
  console.log(`Provider: ${degradedResult.provider} (${degradedResult.model})`);
  console.log(`Graph Topics: ${JSON.stringify(degradedResult.graphTopics)}`);
  console.log(`Context Sections: ${JSON.stringify(degradedResult.contextSections)}`);
  console.log(`Stage Timings (ms):`, degradedResult.stageTimings);
  console.log(`Full Reply:\n"${degradedResult.reply}"\n`);

  // Restore original URI
  process.env.NEO4J_URI = originalUri;
  await closeNeo4jDriver();
  console.log("Original NEO4J_URI restored.");
}

main().catch((err) => {
  console.error("FATAL pipeline crash:", err);
  process.exit(1);
});
