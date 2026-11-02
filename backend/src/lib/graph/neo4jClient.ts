// neo4j-driver is imported lazily so the app (and offline tests) still run
// when the package or credentials are absent - graph retrieval then returns
// an empty context instead of crashing the chat route.
let driver: any = null;

/** Returns a singleton Neo4j driver. Requires NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD. */
export async function getNeo4jDriver(): Promise<any> {
  if (driver) return driver;
  const uri = process.env.NEO4J_URI;
  const user = process.env.NEO4J_USER;
  const password = process.env.NEO4J_PASSWORD;
  if (!uri || !user || !password) {
    throw new Error("Neo4j is not configured. Set NEO4J_URI, NEO4J_USER, and NEO4J_PASSWORD.");
  }
  const mod: any = await import("neo4j-driver");
  const neo4j = mod.default ?? mod;
  driver = neo4j.driver(uri, neo4j.auth.basic(user, password), { maxConnectionPoolSize: 20 });
  return driver;
}

export async function closeNeo4jDriver() {
  if (driver) {
    await driver.close();
    driver = null;
  }
}

/** Lets calling code skip graph lookups gracefully if Neo4j isn't set up yet. */
export function isNeo4jConfigured(): boolean {
  return Boolean(process.env.NEO4J_URI && process.env.NEO4J_USER && process.env.NEO4J_PASSWORD);
}
