import type { RiskAssessment } from "./safetyTypes";

/**
 * Concept-level cue scoring (v3).
 *
 * The v2 regex list only recognised phrasings it had literally seen, so it did
 * not generalise (see eval/README.md). This layer scores *concepts* instead:
 * wish-to-die, burden, means/plan, farewell/arrangements, finality, self-harm,
 * and general distress, in English and romanised Hindi (Hinglish). It is still
 * a transparent heuristic - not a clinical instrument.
 *
 * Design rule (fail-safe): when unsure, round UP. A false alarm costs one
 * supportive message; a miss can cost far more.
 */

interface Cue { re: RegExp; w: 1 | 2 | 3; tag: string }

const C = (tag: string, w: 1 | 2 | 3, ...res: RegExp[]): Cue[] => res.map((re) => ({ re, w, tag }));

const CUES: Cue[] = [
  // --- wish to be dead / not exist (strong)
  ...C("death-wish", 3,
    /\b(never|not) (wake|waking) up\b/, /\bwant(ed)? to (sleep|rest) (forever|and never)\b/,
    /\b(never|not) (have )?exist(ed)?\b/, /\bwish (i|it|the car|a car|a bus|a truck|something) (was|were|would|had|could)\b.*\b(dead|hit me|gone|over|never)\b/,
    /\bwhen i'?m dead\b/, /\bif i (was|were) dead\b/, /\bgone for good\b/, /\b(hit|run over) (me|by)\b.*\b(car|bus|truck|train)\b/,
    /\b(car|bus|truck|train)\b.*\b(hit|run over) me\b/, /\bwish.{0,20}\b(i )?(was|were) dead\b/,
    /\bjeena nahi\b/, /\bmar jau?n(ga)?\b/, /\bmarna chah/, /\bmar jaana\b/, /\bkhatam kar (dun|du|dena|lun|lu)\b/,
    /\bsab khatam\b/, /\bzindagi khatam\b/, /\bjaan (de|dena)\b/, /\bsuicide kar/,
    /\bkill (me|myself)\b/, /\bend (my|it all|this all)\b/),
  // --- burden / better-off-without
  ...C("burden", 2,
    /\bburden\b/, /\bproblem for everyone\b/, /\bwouldn'?t be missed\b/, /\b(no ?one|nobody) (would|will) (even )?(notice|miss|care|remember)\b/,
    /\b(easier|better|fine|simpler) (for everyone )?(if|without)\b.*\b(me|i)\b/, /\bwithout me\b/, /\bnever existed\b/,
    /\bbojh\b/, /\bmere bina\b/, /\bmujhe koi (yaad|miss) nahi\b/, /\bkoi (mujhe )?yaad bhi nahi\b/,
    /\bin the way\b/, /\bworld is better off\b/),
  // --- means / plan / intent (strong)
  ...C("means-plan", 3,
    /\b(pills?|tablets?|medication|meds|blade|rope|gun|knife|poison|overdose)\b.*\b(how many|all (of them )?at once|collect|saving|stockpil|enough|quick|painless|last night)\b/,
    /\bhow many (pills?|tablets?)\b/, /\b(collect|collecting|saving|stockpil\w+)\b.*\b(pills?|tablets?|medication|meds)\b/,
    /\bbought (something|a rope|a knife|pills|poison)\b/, /\bmake it quick\b/, /\bpainless\b/,
    /\b(decided|decide|planned|planning|plan) (how|when|where|to|on)\b.*\b(leave|go|die|end|do it|kill|jump|hang)\b/,
    /\btonight is the night\b/, /\blast night\b.*\b(pills|tablets|rope|jump)\b/, /\bhow i'?ll leave\b/,
    /\bjump(ing)? (off|from)\b/, /\bhang myself\b/, /\bone way\b.*\b(out|left)\b/),
  // --- farewell / arrangements (strong)
  ...C("farewell", 3,
    /\b(last|final) (goodbye|goodbyes|message|time|day|note|letter)\b/, /\bwho gets my\b/, /\bwho(ever)? (should )?(get|keep|take) my (stuff|things|phone|books)\b/,
    /\b(write|writing|wrote|written) (down )?(a |my )?(will|note|letter|goodbye)\b/, /\bgiving away\b/, /\bsaid (my )?(last )?goodbyes?\b/,
    /\bapologi[sz]e(d)? to (everyone|them)\b.*\b(before|in case)\b/, /\bsorry for everything\b.*\b(goodbye|bye|last)\b/),
  // --- finality / no way out
  ...C("finality", 2,
    /\bno way out\b/, /\bcan'?t (go on|do this|keep going|take (it|this)|hold on|pretend)\b/, /\bno point (to|in) (any|living|going|anything|it)\b/,
    /\bfinally be quiet\b/, /\bwant (the|it|this|everything) (pain )?to (stop|end)\b/, /\bend(ing)? the pain\b/, /\bcan'?t (do|handle) this anymore\b/,
    /\bnothing (left|to live)\b/, /\bno reason to (live|stay|go on)\b/, /\bab aur nahi\b/, /\bthak gaya hoon.*(sab|zindagi)\b/, /\bsab kuch khatam\b/),
  // --- self-harm (strong)
  ...C("self-harm", 3,
    /\bcutting\b/, /\bthe cuts\b/, /\bcut (my|myself)\b/, /\bhurt(ing)? myself\b/, /\bburn(ing)? myself\b/, /\bself[- ]?harm\b/, /\bharm myself\b/),
  // --- revenge-suicide / harm to others
  ...C("harm-others", 3, /\bmake them (all )?sorry\b.*\bdead\b/, /\bhurt (them|him|her|everyone)\b/, /\bkill (him|her|them)\b/),
  // --- general distress (weak, moderate floor)
  ...C("distress", 1,
    /\bempty\b/, /\bnumb\b/, /\bhopeless\b/, /\bworthless\b/, /\bfailure\b/, /\bhate myself\b/, /\bcrying\b/, /\bcry every\b/,
    /\bexhausted\b/, /\bdon'?t care (about|anymore)\b/, /\b(feel|feeling) (so )?(alone|lonely|invisible|low|down|lost|stuck|trapped|sinking|drowning)\b/,
    /\bgrey\b|\bgray\b/, /\bcancel(l)?ing plans\b/, /\bstopped (seeing|talking|going|eating|caring)\b/, /\bbarely (eat|sleep)\b/, /\bcan'?t (sleep|concentrate|focus)\b/,
    /\bso (low|tired of)\b/, /\bnobody (really )?cares\b/, /\bno one (really )?(cares|understands|sees)\b/, /\bnot getting better\b/, /\btired of (being|everything|life|pretending|trying)\b/,
    /\bmessing up\b/, /\bwhy am i like this\b/, /\budaas\b/, /\bmann nahi lagta\b/, /\bakela\b/, /\bthak gaya\b/, /\bthak gayi\b/, /\bbahut (bura|dukhi)\b/),
];

export interface CueResult extends RiskAssessment { score: number }

/** Words that indicate the sentence is *about* someone else. */
const OTHER_PERSON = /\b(my|a|the) (sister|brother|mom|mother|dad|father|friend|best friend|roommate|partner|boyfriend|girlfriend|husband|wife|son|daughter|cousin|coworker|classmate|colleague|student|teammate)\b|\b(he|she|they) (said|says|told|texted|keeps|wrote|mentioned)\b|\b(bhai|behen|dost|papa|mummy)\b/;

export function scoreCues(t: string): CueResult {
  const tags: string[] = [];
  let strong = 0, mid = 0, weak = 0;
  for (const c of CUES) {
    if (!c.re.test(t)) continue;
    tags.push(`cue-${c.tag}`);
    if (c.w === 3) strong++; else if (c.w === 2) mid++; else weak++;
  }
  const other = OTHER_PERSON.test(t);
  const signals = Array.from(new Set(tags));
  const score = strong * 3 + mid * 2 + weak;

  let level: RiskAssessment["level"] = "none";
  if (strong >= 1) level = "high";
  else if (mid >= 2 || (mid >= 1 && weak >= 1)) level = "high";
  else if (mid >= 1 && other) level = "high";   // third party describing burden / finality
  else if (mid >= 1 || weak >= 1) level = "moderate"; // uncertain tier: round up, never ignore
  return { level, matchedSignals: signals, score };
}
