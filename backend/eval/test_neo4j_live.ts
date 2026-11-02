import dotenv from "dotenv";
dotenv.config();

import { getNeo4jDriver, closeNeo4jDriver } from "../src/lib/graph/neo4jClient";
import { getGraphContext } from "../src/lib/graph/graphRetrieval";

async function main() {
  console.log("=== Checking Neo4j Live Connection ===");
  const driver = await getNeo4jDriver();
  const session = driver.session();

  try {
    // 1. Node count
    const nodeRes = await session.run("MATCH (n) RETURN count(n) AS nodeCount");
    const nodeCount = nodeRes.records[0].get("nodeCount").toNumber();

    // 2. Relationship count
    const relRes = await session.run("MATCH ()-[r]->() RETURN count(r) AS relCount");
    const relCount = relRes.records[0].get("relCount").toNumber();

    // 3. Labels
    const labelsRes = await session.run("CALL db.labels() YIELD label RETURN collect(label) AS labels");
    const labels = labelsRes.records[0].get("labels");

    // 4. Relationship types
    const relTypesRes = await session.run("CALL db.relationshipTypes() YIELD relationshipType RETURN collect(relationshipType) AS relTypes");
    const relTypes = relTypesRes.records[0].get("relTypes");

    console.log(`Node count: ${nodeCount}`);
    console.log(`Relationship count: ${relCount}`);
    console.log(`Labels: ${JSON.stringify(labels)}`);
    console.log(`Relationship types: ${JSON.stringify(relTypes)}`);

    // Also inspect some sample nodes if needed
    const sampleNodesRes = await session.run("MATCH (n) RETURN labels(n) AS lbl, n.name AS name LIMIT 10");
    console.log("Sample nodes:", sampleNodesRes.records.map((r: any) => ({ label: r.get("lbl"), name: r.get("name") })));

    // 5. Test messages through getGraphContext
    const testMessages = [
      "I've been feeling anxious and can't sleep lately.",
      "Work pressure has me completely overwhelmed and burnt out.",
      "Can you give me a recipe for tomato soup?"
    ];

    console.log("\n=== Testing getGraphContext with 3 Messages ===");
    for (let i = 0; i < testMessages.length; i++) {
      const msg = testMessages[i];
      console.log(`\n--- Test Message ${i + 1} ---`);
      console.log(`User Message: "${msg}"`);
      const ctx = await getGraphContext(msg);
      console.log(`Matched Topics: ${JSON.stringify(ctx.matchedTopics)}`);
      console.log(`Context Text:\n${ctx.contextText ? ctx.contextText : "(empty string / no context returned)"}`);
    }

  } finally {
    await session.close();
    await closeNeo4jDriver();
  }
}

main().catch((err) => {
  console.error("Live query failed:", err);
  process.exit(1);
});
