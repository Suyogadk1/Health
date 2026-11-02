import { getGraphContext } from "../../graph/graphRetrieval";
import type { GraphRetrievalInput, GraphRetrievalOutput } from "../types";

/** Agent 4 - knowledge-graph (Neo4j) retrieval of symptoms/strategies for detected topics. Never throws. */
export async function graphRetrievalAgent(input: GraphRetrievalInput): Promise<GraphRetrievalOutput> {
  try {
    const r = await getGraphContext(input.message);
    return { matchedTopics: r.matchedTopics, graphContextText: r.contextText };
  } catch {
    return { matchedTopics: [], graphContextText: "" };
  }
}
