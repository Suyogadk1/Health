/**
 * Seeds the Neo4j knowledge graph with a starter set of mental-wellbeing
 * topics, symptoms, and coping strategies.
 *
 * Run with:  npx tsx scripts/seedGraph.ts
 * (requires NEO4J_URI / NEO4J_USER / NEO4J_PASSWORD to be set, e.g. via
 * `npx dotenv -e .env.local -- npx tsx scripts/seedGraph.ts`)
 */
import dotenv from "dotenv";
dotenv.config();

import { getNeo4jDriver, closeNeo4jDriver } from "../src/lib/graph/neo4jClient";

interface TopicSeed {
  name: string;
  symptoms: string[];
  strategies: { name: string; description: string }[];
  related: string[];
}

const topics: TopicSeed[] = [
  {
    name: "Anxiety",
    symptoms: ["Racing thoughts", "Rapid heartbeat", "Difficulty concentrating", "Restlessness"],
    strategies: [
      {
        name: "Box breathing",
        description:
          "Inhale for 4 seconds, hold for 4, exhale for 4, hold for 4 — repeat for 2 minutes to calm the nervous system.",
      },
      {
        name: "5-4-3-2-1 grounding",
        description:
          "Name 5 things you see, 4 you can touch, 3 you hear, 2 you smell, 1 you taste, to anchor in the present.",
      },
    ],
    related: ["Stress", "Sleep Difficulty"],
  },
  {
    name: "Stress",
    symptoms: ["Muscle tension", "Irritability", "Fatigue", "Trouble focusing"],
    strategies: [
      {
        name: "Progressive muscle relaxation",
        description: "Tense and release each muscle group for 5 seconds, working head to toe.",
      },
      {
        name: "Time-boxing tasks",
        description: "Break large tasks into 25-minute focused blocks with 5-minute breaks.",
      },
    ],
    related: ["Anxiety", "Burnout"],
  },
  {
    name: "Low Mood",
    symptoms: ["Loss of interest", "Low energy", "Negative self-talk", "Social withdrawal"],
    strategies: [
      {
        name: "Behavioral activation",
        description: "Schedule one small, achievable, enjoyable activity today, even with low motivation.",
      },
      {
        name: "Gratitude journaling",
        description: "Write down three specific things that went okay today, however small.",
      },
    ],
    related: ["Sleep Difficulty", "Burnout"],
  },
  {
    name: "Sleep Difficulty",
    symptoms: ["Trouble falling asleep", "Waking at night", "Unrefreshing sleep"],
    strategies: [
      {
        name: "Wind-down routine",
        description: "Dim lights and avoid screens 30 minutes before bed; keep a consistent sleep time.",
      },
      {
        name: "Worry journaling before bed",
        description: "Write down tomorrow's worries on paper to 'park' them before sleep.",
      },
    ],
    related: ["Anxiety", "Low Mood"],
  },
  {
    name: "Burnout",
    symptoms: ["Emotional exhaustion", "Cynicism", "Reduced sense of accomplishment"],
    strategies: [
      {
        name: "Micro-recovery breaks",
        description: "Take three 3-minute screen-free pauses across the day to reset attention.",
      },
      {
        name: "Boundary setting",
        description: "Identify one commitment this week that can be declined or delegated.",
      },
    ],
    related: ["Stress", "Low Mood"],
  },
];

async function seed() {
  const driver = await getNeo4jDriver();
  const session = driver.session();

  try {
    // Wipe any existing demo data so the seed is idempotent.
    await session.run(`MATCH (n) DETACH DELETE n`);

    for (const topic of topics) {
      await session.run(`MERGE (t:Topic {name: $name})`, { name: topic.name });

      for (const symptom of topic.symptoms) {
        await session.run(
          `MATCH (t:Topic {name: $topicName})
           MERGE (s:Symptom {name: $symptomName})
           MERGE (t)-[:HAS_SYMPTOM]->(s)`,
          { topicName: topic.name, symptomName: symptom }
        );
      }

      for (const strategy of topic.strategies) {
        await session.run(
          `MATCH (t:Topic {name: $topicName})
           MERGE (st:Strategy {name: $strategyName})
           SET st.description = $description
           MERGE (t)-[:EASED_BY]->(st)`,
          { topicName: topic.name, strategyName: strategy.name, description: strategy.description }
        );
      }
    }

    // Second pass for RELATED_TO edges, once every Topic node exists.
    for (const topic of topics) {
      for (const relatedName of topic.related) {
        await session.run(
          `MATCH (a:Topic {name: $a}), (b:Topic {name: $b})
           MERGE (a)-[:RELATED_TO]->(b)`,
          { a: topic.name, b: relatedName }
        );
      }
    }

    console.log(`Seeded ${topics.length} topics into Neo4j.`);
  } finally {
    await session.close();
    await closeNeo4jDriver();
  }
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
