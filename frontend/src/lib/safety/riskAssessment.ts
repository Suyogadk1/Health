import type { RiskAssessment } from "./safetyTypes";
import { scoreCues } from "./cueScoring";

// NOTE: This is a deliberately transparent, auditable heuristic layer - not
// a clinical tool. It is kept separate from the AI provider so a trained
// classifier (or moderation API) can be dropped in behind the same
// `assessRisk` signature without touching any calling code.
//
// v2 (this revision) adds, on top of the original keyword list:
//   1. light normalization of informal / abbreviated text,
//   2. passive-ideation, method, farewell, burden and foreshortened-future
//      patterns (first person),
//   3. third-party disclosure patterns ("my sister says she wants to end it"),
//   4. a figurative / informational-frame filter so idioms ("killed it",
//      "dying to see") and academic or media mentions ("class project on
//      suicide prevention") do not trigger crisis responses,
//   5. a broader moderate tier (anhedonia, withdrawal, worthlessness...).
// It is still a heuristic: it will miss phrasings it has no pattern for.

// ---------------------------------------------------------------- normalize
const ABBREV: [RegExp, string][] = [
  [/\bdont\b/g, "don't"], [/\bcant\b/g, "can't"], [/\bwont\b/g, "won't"],
  [/\bill\b/g, "i'll"], [/\bim\b/g, "i'm"], [/\bive\b/g, "i've"],
  [/\banymor\b/g, "anymore"], [/\bwanna\b/g, "want to"], [/\bgonna\b/g, "going to"],
  [/\bthru\b/g, "through"], [/\bwk\b/g, "week"], [/\b2\b/g, "to"],
  [/\bb\b/g, "be"], [/\bu\b/g, "you"], [/\bur\b/g, "your"],
  [/\bwakin\b/g, "waking"], [/\bthinkin\b/g, "thinking"], [/\bbout\b/g, "about"],
  [/\beverythin\b/g, "everything"], [/\bfeelin\b/g, "feeling"], [/\brlly\b/g, "really"],
  [/\bgoin\b/g, "going"], [/\bkinda\b/g, "kind of"], [/\bsry\b/g, "sorry"],
  [/\bidk\b/g, "i don't know"], [/\bfr\b/g, "for real"],
];

export function normalize(text: string): string {
  let t = text.toLowerCase().replace(/[\u2018\u2019]/g, "'");
  for (const [re, rep] of ABBREV) t = t.replace(re, rep);
  return t.replace(/\s+/g, " ").trim();
}

// ----------------------------------------------------------- figurative / info
// Idioms that reuse death/violence words without literal meaning.
const FIGURATIVE: RegExp[] = [
  /\bkill(ed|ing)? (it|time)\b/, /\bdead tired\b/, /\bdying to\b/,
  /\bdeath of me\b/, /\bdie of (embarrassment|boredom|laughter|shame)\b/,
  /\b(it'?s|that'?s|is) killing me\b/, /\bheart attack\b/,
  /\bdon't want to be alive (at|for|this early|when it'?s)\b/,
  /\bwant(s|ed)? to end it all in (a )?(game|fortnite|minecraft|roblox)\b/,
  /\b(game|level|boss|fortnite|minecraft)\b.*\b(end it all|killing me|kill me)\b/,
];
// Informational / media / academic framing around a sensitive keyword.
const INFO_FRAME: RegExp[] = [
  /\b(article|documentary|movie|film|show|series|memoir|book|podcast|lecture|class|course|professor|research|paper|project|study|studying|statistics|thesis|novel|character|essay|fiction(al)?|story|stigma|poem|lyrics)\b/,
];

// ------------------------------------------------------------- first person
const HIGH_FIRST_PERSON: RegExp[] = [
  /\bkill myself\b/, /\bsuicid(e|al)\b/, /\bend my life\b/, /\bwant to die\b/,
  /\bnot want(ing)? to (be alive|live|be here)\b/, /\bdon't want to (be alive|live|be here)( anymore)?\b/,
  /\bhurt(ing)? (myself|someone|others)\b/, /\bhurt(ing)? me\b/, /\bself[- ]harm\b/,
  /\bplan to (kill|hurt|harm)\b/, /\b(cut|cutting|hurt) myself\b/, /\bi cut myself\b/,
  /\bthinking (about|of) (ending it|jumping|ending things)\b/, /\bending it\b/,
  /\bend it all\b/, /\bend things\b/, /\breasons to end it\b/, /\bways? (people )?end things\b/,
  /\bwant(ing)? (this|it|everything|it all) (all )?to (stop|end)\b/, /\bwant it all to stop\b/,
  /\bwants? this all to end\b/, /\bto end for good\b/, /\bstop permanently\b/,
  /\bdisappear(ing)?( for good| forever| and not coming back)?\b/,
  /\bjust (not )?wak(e|ing) up\b/, /\bnot waking up\b/, /\bnot to wake up\b/,
  /\bstop existing\b/, /\bcease to exist\b/, /\bnot be (here|around) anymore\b/,
  /\bnot being here anymore\b/, /\bbe gone\b/, /\bif i was gone\b/,
  /\bwithout me\b.*\b(better|fine|solved|easier)\b/, /\b(better|fine|easier) (off )?without me\b/,
  /\beasier if i wasn't (around|here)\b/, /\bif i (just )?wasn't (here|around)\b/,
  /\bpermanent solutions?\b/, /\bsaving up pills\b/, /\bstockpil\w+ (pills|medication)/,
  /\bgiving away (some of )?my (things|stuff|belongings)\b/, /\bwritten a (letter|note) to my\b/,
  /\bsaid goodbye\b/, /\bgoodbye like it was the last\b/, /\btold my friend goodbye\b/,
  /\bthinking about jumping\b/, /\bthe bridge near\b/,
  /\bdon't (think|know) (i'?ll|i will) make it\b/, /\bwon't make it through\b/, /\bmake it (through|thru) (this|the) (week|month|night)\b/,
  /\bnot safe with myself\b/, /\bdon't feel safe with myself\b/,
  /\bpain to stop even if\b/, /\bmade peace with (the idea of )?not being here\b/,
  /\bdon't (see|want to see|picture myself)\b.*\b(tomorrow|next month|in a year|being here)\b/,
  /\bi'?ll? (not|never) be here\b/, /\bnot be here in a year\b/, /\bmy time to go\b/,
  /\bdon't see the point of tomorrow\b/, /\bnot (sure )?(i )?want to see next month\b/,
  /\bhow much longer i can hold on\b/, /\bhold on for\b.*\bmuch longer\b/,
  /\bquiet everything would be if i (just )?stopped\b/, /\bif i just stopped\b/,
  /\bdon't (want|feel like) (to )?(fight|fighting)\b.*\b(anymore|for myself)\b/, /\bdon't want to fight this anymore\b/,
  /\bdon't feel like fighting for myself\b/, /\bi'?m done\b.*\b(fight|anymore)\b/,
  /\bwaiting for something to make the decision\b/, /\bhave much left in me to keep going\b/,
  /\bstopped making plans for the future\b/, /\blife would be like without me\b/,
  /\bdark thoughts\b/, /\bthoughts i'?m scared to say\b/, /\bwhat it would feel like to just not\b/,
  /\bthoughts about hurting myself\b/, /\bpeople would be better off\b/, /\bwould notice if i was gone\b/,
  /\btired of being tired\b.*\bstop\b/, /\bdon't want to be (here|alive)\b/, /\bthinking maybe it'?s just my time\b/,
  /\bdon't (think i )?can keep doing this much longer\b/, /\bwant to just give up (on )?(life|living)\b/,
];

// Third-party disclosure: a relation + report of suicidal talk/behaviour.
const THIRD_SUBJECT = /\b(my|a|the) (sister|brother|mom|mother|dad|father|friend|best friend|roommate|partner|boyfriend|girlfriend|husband|wife|son|daughter|cousin|coworker|classmate|colleague|neighbou?r|student|teammate)\b/;
const THIRD_HIGH: RegExp[] = [
  /\b(end it all|ending it|end things|ending things|hurting (her|him|them)sel(f|ves))\b/,
  /\b(wants?|wanted|wishes|wished|wishing) (to )?(she|he|they)?(.d)? ?(just )?(disappear|die|be gone)\b/,
  /\bwishes (she|he|they)'?d (just )?disappear\b/, /\bwish(es)? (she|he|they) (wasn't|weren't) (here|around)\b/,
  /\bnot wanting to (be here|live|wake up)\b/, /\bdon't see the point in living\b/,
  /\bsaying goodbye\b/, /\bgoodbye like (she|he|they) wasn'?t\b/, /\bwant(ed)? to disappear\b/,
  /\bwishes (she|he|they) wasn'?t here\b/, /\bthoughts of ending\b/,
  /\bsuicid(e|al)\b/, /\bwant(s|ed)? to die\b/, /\bwant(s|ed)? to kill (her|him|them)sel(f|ves)\b/,
  /\bnot want(ing)? to (wake up|be here)\b/,
];
const THIRD_MODERATE: RegExp[] = [
  /\bnothing matters\b/, /\bhopeless\b/, /\bempty( inside)?\b/, /\bworthless\b/,
  /\bwithdrawn\b/, /\bstruggling\b/, /\bfeels? (like )?a burden\b/,
];

// ----------------------------------------------------------------- moderate
const MODERATE: RegExp[] = [
  /\bhopeless\b/, /\bcan'?t (take|handle|do) (this|it) anymore\b/, /\bno point in\b/, /\bpointless\b/,
  /\bgive up\b/, /\bgiven up\b/, /\bworthless\b/, /\bfeel(ing)? numb\b/, /\bnumb (and|n) empty\b/,
  /\bfeel(ing)? (so )?empty\b/, /\bnothing (feels )?(matters|enjoyable)\b/,
  /\blost interest\b/, /\bdon't (feel )?(excited|enjoy)\b/, /\bisolating (myself)?\b/,
  /\bstopped answering\b/, /\bpushing people away\b/, /\bburden\b/, /\bdisappointing everyone\b/,
  /\bfailing at everything\b/, /\breplaying my failures\b/, /\bdrowning\b/,
  /\btrouble getting out of bed\b/, /\bcan'?t (even )?get out of bed\b/, /\bhaven'?t left my room\b/,
  /\bgoing through the motions\b/, /\bcrying for no reason\b/, /\bdon't feel like myself\b/,
  /\bdon't believe it\b/, /\bheavier than\b/, /\bso done (with|w) everything\b/,
  /\bnot sure what the point\b/, /\bdon't have an appetite\b/, /\bfeels? heavy\b/,
  /\bstuck and i don't know\b/, /\bsnapping at people\b/, /\bso tired of everything\b/,
  /\bkeep telling myself things will get better\b/,
];

const uniq = (a: string[]) => Array.from(new Set(a));
const hits = (res: RegExp[], t: string, tag: string) =>
  res.filter((r) => r.test(t)).map((r) => `${tag}:${r.source}`);

function assessRiskPatterns(text: string): RiskAssessment {
  const t = normalize(text);

  const figurative = FIGURATIVE.some((r) => r.test(t));
  const infoFrame = INFO_FRAME.some((r) => r.test(t));
  // First-person ideation markers that override an informational frame
  // ("for my class I've been thinking about ending it").
  const personalIdeation = /\b(i'?m|i am|i've been|i keep|i want|i feel like) (thinking|wanting|having)\b.*\b(end|kill|hurt|die|suicid)/.test(t);

  const hi = hits(HIGH_FIRST_PERSON, t, "high");
  const third = THIRD_SUBJECT.test(t) ? hits(THIRD_HIGH, t, "third-party") : [];

  if (figurative && !personalIdeation) {
    // Idiom present: ignore keyword hits that the idiom explains.
    return { level: "none", matchedSignals: ["figurative-language-suppressed"] };
  }
  if (infoFrame && !personalIdeation && hi.length > 0 && !third.length) {
    // Keyword mention inside an academic / media sentence, no personal ideation.
    return { level: "none", matchedSignals: ["informational-frame-suppressed"] };
  }
  if (third.length > 0) return { level: "high", matchedSignals: uniq(third) };
  if (hi.length > 0) return { level: "high", matchedSignals: uniq(hi) };

  const thirdMod = THIRD_SUBJECT.test(t) ? hits(THIRD_MODERATE, t, "third-party-moderate") : [];
  if (thirdMod.length > 0) return { level: "moderate", matchedSignals: uniq(thirdMod) };

  const mod = hits(MODERATE, t, "moderate");
  if (mod.length > 0) return { level: "moderate", matchedSignals: uniq(mod) };

  return { level: "none", matchedSignals: [] };
}

/**
 * v3 entry point: exact-phrase patterns (v2) UNION concept-level cue scoring.
 * The more severe result wins, so adding the cue layer can only raise risk.
 * Figurative / informational framing suppresses the cue layer the same way it
 * suppresses the patterns, unless personal ideation is stated.
 */
export function assessRisk(text: string): RiskAssessment {
  const base = assessRiskPatterns(text);
  const t = normalize(text);
  const suppressed = base.matchedSignals.some((s) => s.endsWith("-suppressed"));
  const framed = FIGURATIVE.some((r) => r.test(t)) || INFO_FRAME.some((r) => r.test(t));
  const personal = /\b(i'?m|i am|i've been|i keep|i want|i feel like) (thinking|wanting|having)\b.*\b(end|kill|hurt|die|suicid)/.test(t);
  if (suppressed || (framed && !personal)) return base;

  const cue = scoreCues(t);
  const rank = { none: 0, moderate: 1, high: 2 } as const;
  if (rank[cue.level] > rank[base.level]) {
    return { level: cue.level, matchedSignals: [...base.matchedSignals, ...cue.matchedSignals] };
  }
  return base;
}

// ------------------------------------------------------------ hybrid (LLM)
// Evaluation showed the regex tier does not generalize to unseen phrasings
// (see eval/README.md). The hybrid tier keeps the regex as a fast, offline,
// auditable first pass and adds an LLM classifier for everything the regex
// does not flag as high. The final level is the MORE severe of the two, and
// any classifier failure falls back to the regex result (never lowers risk).
import type { AIProvider } from "../ai/provider";
import type { RiskLevel } from "./safetyTypes";

const CLASSIFIER_PROMPT = `You classify the emotional-risk level of a message sent to a mental-wellbeing chat app. Users write English, Hindi, or Hinglish (Hindi in Roman script), often indirectly.
Respond with strict JSON only: {"level":"none"|"moderate"|"high","reasoning":"one short sentence"}
"high": suicidal thoughts - explicit OR indirect (wanting to disappear / not wake up / "everyone better off without me", being a burden, "the only thing stopping me is...", goodbyes, putting affairs in order, standing at heights/tracks, access to pills or other means, searching for methods), self-harm (including urges), intent to harm others, or a user describing ANOTHER person's suicidal or self-harm statements or behaviour.
"moderate": persistent low mood, hopelessness, worthlessness, numbness, withdrawal, loss of interest, appetite/sleep change, exhaustion, strong self-criticism - but no suicidal content.
"none": ordinary stress, everyday talk, positive messages, requests for tips, and figurative or academic/media mentions of death or suicide (idioms like "killed my presentation", class projects, films) with no personal risk.
Examples: "i've got the tablets lined up on my desk" -> high. "mummy papa ko sorry bol dena, main ab nahi rahunga" -> high. "my friend said she doesn't want to live" -> high. "i've been avoiding everyone for two weeks" -> moderate. "exam tomorrow, a bit nervous" -> none.
When uncertain between two levels, choose the higher one.`;

const ORDER: Record<RiskLevel, number> = { none: 0, moderate: 1, high: 2 };

export async function assessRiskHybrid(
  text: string,
  classifier?: AIProvider,
  timeoutMs = 4000
): Promise<RiskAssessment & { source: "regex" | "llm" | "regex+llm-failed" }> {
  const regex = assessRisk(text);
  if (regex.level === "high" || !classifier) return { ...regex, source: "regex" };

  try {
    const call = classifier.generate([{ role: "user", content: text }], CLASSIFIER_PROMPT);
    const timeout = new Promise<never>((_, rej) => setTimeout(() => rej(new Error("classifier timeout")), timeoutMs));
    const raw = await Promise.race([call, timeout]);
    const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
    // Fail closed: an unrecognised level is treated as moderate, never as "none".
    const llmLevel: RiskLevel = ["none", "moderate", "high"].includes(parsed.level) ? parsed.level : "moderate";
    if (ORDER[llmLevel] > ORDER[regex.level]) {
      return { level: llmLevel, matchedSignals: [...regex.matchedSignals, `llm:${String(parsed.reasoning || "").slice(0, 80)}`], source: "llm" };
    }
    return { ...regex, source: "regex" };
  } catch {
    return { ...regex, source: "regex+llm-failed" };
  }
}
