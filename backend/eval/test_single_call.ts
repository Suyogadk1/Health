import dotenv from "dotenv";
dotenv.config();

const endpoint = "https://integrate.api.nvidia.com/v1/chat/completions";
const key = process.env.NVIDIA_API_KEY;
const model = process.env.NEMOTRON_ULTRA_MODEL || "nvidia/nemotron-3.5-lightning-30b-a3b";

const CLASSIFIER_PROMPT = `You classify the emotional-risk level of a message sent to a mental-wellbeing chat app. Users write English, Hindi, or Hinglish (Hindi in Roman script), often indirectly.
Respond with strict JSON only: {"level":"none"|"moderate"|"high","reasoning":"one short sentence"}
"high": suicidal thoughts - explicit OR indirect (wanting to disappear / not wake up / "everyone better off without me", being a burden, "the only thing stopping me is...", goodbyes, putting affairs in order, standing at heights/tracks, access to pills or other means, searching for methods), self-harm (including urges), intent to harm others, or a user describing ANOTHER person's suicidal or self-harm statements or behaviour.
"moderate": persistent low mood, hopelessness, worthlessness, numbness, withdrawal, loss of interest, appetite/sleep change, exhaustion, strong self-criticism - but no suicidal content.
"none": ordinary stress, everyday talk, positive messages, requests for tips, and figurative or academic/media mentions of death or suicide (idioms like "killed my presentation", class projects, films) with no personal risk.
Examples: "i've got the tablets lined up on my desk" -> high. "mummy papa ko sorry bol dena, main ab nahi rahunga" -> high. "my friend said she doesn't want to live" -> high. "i've been avoiding everyone for two weeks" -> moderate. "exam tomorrow, a bit nervous" -> none.
When uncertain between two levels, choose the higher one.`;

async function test(text: string, temp = 0.0) {
  console.log(`Testing text: "${text}" with temperature=${temp}`);
  const t0 = performance.now();
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: CLASSIFIER_PROMPT },
          { role: "user", content: text },
        ],
        max_tokens: 1024,
        temperature: temp,
      }),
    });

    console.log(`HTTP status: ${res.status}`);
    const body = await res.text();
    console.log(`Raw body: ${body.slice(0, 300)}`);
    console.log(`Time: ${(performance.now() - t0).toFixed(0)}ms`);
  } catch (err: any) {
    console.error("Fetch failed:", err);
  }
}

async function main() {
  await test("I'm not sure I want to be around much longer", 0.0);
  await test("I just want to fall asleep and never get up", 0.0);
}
main();
