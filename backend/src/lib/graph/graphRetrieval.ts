import { getNeo4jDriver, isNeo4jConfigured } from "./neo4jClient";

export interface GraphContextResult {
  matchedTopics: string[];
  contextText: string;
}

/**
 * Keyword -> Topic map used to decide which part of the graph is relevant
 * to a given message. This is intentionally simple (Phase I); it can later
 * be replaced with embedding-based topic detection without changing the
 * Cypher retrieval logic below.
 */
const TOPIC_KEYWORDS: Record<string, string[]> = {
  Anxiety: ["anxious", "anxiety", "panic", "racing thoughts", "nervous", "on edge"],
  Stress: ["stressed", "stress", "overwhelmed", "pressure", "too much"],
  "Low Mood": ["sad", "down", "depressed", "low mood", "hopeless", "unmotivated", "empty"],
  "Sleep Difficulty": ["can't sleep", "cant sleep", "insomnia", "sleep", "tired", "exhausted"],
  Burnout: ["burnout", "burnt out", "no energy", "numb", "checked out", "drained"],
};

function detectTopics(message: string): string[] {
  const lower = message.toLowerCase();
  const matches = new Set<string>();
  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      matches.add(topic);
    }
  }
  return Array.from(matches);
}

/**
 * Retrieves symptoms, coping strategies, and related topics from the
 * knowledge graph for whatever topics were detected in the user's message,
 * and formats them as plain-text context for the LLM's system prompt.
 *
 * Returns an empty result (never throws) if Neo4j isn't configured or if
 * no topic in the message was recognized, so callers can always safely
 * append contextText without extra branching.
 */
export async function getGraphContext(userMessage: string): Promise<GraphContextResult> {
  if (!isNeo4jConfigured()) {
    return { matchedTopics: [], contextText: "" };
  }

  const topics = detectTopics(userMessage);
  if (topics.length === 0) {
    return { matchedTopics: [], contextText: "" };
  }

  let session: any;
  try {
    const driver = await getNeo4jDriver();
    session = driver.session();
    const result = await session.run(
      `MATCH (t:Topic)
       WHERE t.name IN $topics
       OPTIONAL MATCH (t)-[:HAS_SYMPTOM]->(s:Symptom)
       OPTIONAL MATCH (t)-[:EASED_BY]->(st:Strategy)
       OPTIONAL MATCH (t)-[:RELATED_TO]->(r:Topic)
       RETURN t.name AS topic,
              collect(DISTINCT s.name) AS symptoms,
              collect(DISTINCT {name: st.name, description: st.description}) AS strategies,
              collect(DISTINCT r.name) AS related
       LIMIT 5`,
      { topics }
    );

    const blocks = result.records.map((record: any) => {
      const topic = record.get("topic") as string;
      const symptoms = ((record.get("symptoms") as string[]) || []).filter(Boolean);
      const strategies = (
        (record.get("strategies") as { name: string; description: string }[]) || []
      ).filter((s) => s && s.name);
      const related = ((record.get("related") as string[]) || []).filter(Boolean);

      const strategyLines = strategies
        .map((s) => `  - ${s.name}: ${s.description}`)
        .join("\n");

      return [
        `Topic: ${topic}`,
        `Associated symptoms: ${symptoms.join(", ") || "n/a"}`,
        `Suggested strategies:\n${strategyLines || "  n/a"}`,
        `Related topics: ${related.join(", ") || "n/a"}`,
      ].join("\n");
    });

    return {
      matchedTopics: topics,
      contextText: blocks.join("\n\n"),
    };
  } catch (err) {
    // Graph is an enrichment, never a dependency: degrade to no context.
    console.warn("[graphRetrieval] Neo4j lookup failed, continuing without graph context:", (err as Error)?.message);
    return { matchedTopics: topics, contextText: "" };
  } finally {
    if (session) await session.close();
  }
}
