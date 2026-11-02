import {
  Smile,
  Sparkles,
  Zap,
  Moon,
  Brain,
  Shield,
  Heart,
  Compass,
} from "lucide-react";
import type { Mood } from "@/types";

export interface QuestionChoice {
  value: number; // 1 to 5
  label: string;
  subtitle: string;
  emoji: string;
}

export interface WellbeingQuestion {
  id: "mood" | "stress" | "energy" | "sleep" | "clarity";
  category: string;
  title: string;
  description: string;
  icon: typeof Smile;
  choices: QuestionChoice[];
}

export const WELLBEING_QUESTIONS: WellbeingQuestion[] = [
  {
    id: "mood",
    category: "Emotional Weather",
    title: "How is your emotional landscape today?",
    description: "Notice whatever feelings are present without judging them as good or bad.",
    icon: Heart,
    choices: [
      { value: 5, label: "Radiant & Light", subtitle: "Hopeful, joyful, and deeply at ease", emoji: "☀️" },
      { value: 4, label: "Steady & Content", subtitle: "Grounded, pleasant, no heavy clouds", emoji: "🌿" },
      { value: 3, label: "Mixed / In-Between", subtitle: "A bit of everything, floating neutrally", emoji: "⛅" },
      { value: 2, label: "Tender / Low", subtitle: "Carrying quiet sadness, worry, or sensitivity", emoji: "🌧️" },
      { value: 1, label: "Extremely low", subtitle: "Hurting, turbulent, or deeply overwhelmed", emoji: "⛈️" },
    ],
  },
  {
    id: "stress",
    category: "Stress & Mental Load",
    title: "How heavy does your mental workload or tension feel?",
    description: "Consider internal pressure, deadlines, and tightness in your body.",
    icon: Shield,
    choices: [
      { value: 5, label: "Spacious & Unburdened", subtitle: "Clear horizon, deep breath comes easily", emoji: "🍃" },
      { value: 4, label: "Manageable Rhythm", subtitle: "Normal duties, keeping pace without strain", emoji: "🌊" },
      { value: 3, label: "Moderate Demand", subtitle: "Feeling busy, occasional tension in shoulders", emoji: "⏳" },
      { value: 2, label: "High Pressure", subtitle: "Racing thoughts, shallow breathing, feeling pushed", emoji: "🔥" },
      { value: 1, label: "Near Overload", subtitle: "Urgent weight, feeling close to the edge", emoji: "💥" },
    ],
  },
  {
    id: "energy",
    category: "Vitality & Energy",
    title: "What is your physical and emotional battery level?",
    description: "Your capacity to focus, engage, and initiate activity today.",
    icon: Zap,
    choices: [
      { value: 5, label: "Vibrant & Restored", subtitle: "Naturally awake, eager, and full of vitality", emoji: "⚡" },
      { value: 4, label: "Sustained & Steady", subtitle: "Reliable reserve for work and leisure", emoji: "🔋" },
      { value: 3, label: "Low-Idle", subtitle: "Functional, but needing frequent quiet pauses", emoji: "🍂" },
      { value: 2, label: "Depleted", subtitle: "Running on willpower, caffeine, or empty reserves", emoji: "🕯️" },
      { value: 1, label: "Exhausted", subtitle: "Heavy limbs, need immediate stillness and rest", emoji: "🪫" },
    ],
  },
  {
    id: "sleep",
    category: "Restorative Rest",
    title: "How restorative was your sleep last night?",
    description: "Quality of sleep is the primary neurological foundation for resilience.",
    icon: Moon,
    choices: [
      { value: 5, label: "Deep & Refreshing", subtitle: "Woke up naturally with clear, unclouded head", emoji: "🌙" },
      { value: 4, label: "Good & Restful", subtitle: "Solid hours of sleep, ready for the day", emoji: "🛏️" },
      { value: 3, label: "Light / Interrupted", subtitle: "Woke a few times, but manageable", emoji: "🕰️" },
      { value: 2, label: "Restless & Broken", subtitle: "Tossed, turned, or struggled with late thoughts", emoji: "🌫️" },
      { value: 1, label: "Insomnia / Deprived", subtitle: "Very little or fragmented, unrefreshing sleep", emoji: "🌑" },
    ],
  },
  {
    id: "clarity",
    category: "Mental Clarity & Presence",
    title: "How clear and focused is your mind right now?",
    description: "Notice mental chatter, brain fog, and ability to stay anchored in the present.",
    icon: Brain,
    choices: [
      { value: 5, label: "Crystal Clear & Anchored", subtitle: "Present, mindful, attentive to what matters", emoji: "💎" },
      { value: 4, label: "Mostly Focused", subtitle: "Able to organize thoughts and make choices", emoji: "🧭" },
      { value: 3, label: "Mildly Scattered", subtitle: "Several open mental tabs pulling for attention", emoji: "🌪️" },
      { value: 2, label: "Foggy & Drifting", subtitle: "Hard to concentrate, sluggish cognitive pace", emoji: "🌁" },
      { value: 1, label: "Overstimulated", subtitle: "Sensory overload, spinning thoughts, mental blur", emoji: "⚡" },
    ],
  },
];

export interface AssessmentAnswers {
  mood: number;    // 1-5
  stress: number;  // 1-5 (5 = low stress/spacious, 1 = overloaded)
  energy: number;  // 1-5
  sleep: number;   // 1-5
  clarity: number; // 1-5
  notes?: string;
}

export interface WellbeingAssessmentResult {
  score: number; // 0-100
  tier: {
    name: string;
    description: string;
    color: string;
    bgColor: string;
    borderColor: string;
    badgeColor: string;
  };
  moodLabel: Mood;
  breakdown: {
    moodScore: number;
    stressScore: number;
    energyScore: number;
    sleepScore: number;
    clarityScore: number;
  };
  insight: string;
  recommendedAction: {
    title: string;
    description: string;
    type: "chat" | "breathe" | "voice" | "grounding";
    prompt?: string;
  };
}

export function calculateWellbeingScore(answers: AssessmentAnswers): WellbeingAssessmentResult {
  const { mood, stress, energy, sleep, clarity, notes } = answers;

  // Raw sum is between 5 and 25
  const rawSum = mood + stress + energy + sleep + clarity;
  // Scaled 0 to 100
  const score = Math.min(100, Math.max(0, Math.round(((rawSum - 5) / 20) * 100)));

  // Determine Mood string label
  let moodLabel: Mood = "okay";
  if (mood >= 5) moodLabel = "great";
  else if (mood === 4) moodLabel = "good";
  else if (mood === 3) moodLabel = "okay";
  else if (stress <= 2) moodLabel = "stressed";
  else moodLabel = "low";

  // Tier configuration
  let tier = {
    name: "Flourishing & Centered",
    description: "High emotional resilience, clear mind, and restored physical energy.",
    color: "#2D6A4F",
    bgColor: "bg-emerald-50/90",
    borderColor: "border-emerald-300",
    badgeColor: "bg-emerald-100 text-emerald-800",
  };

  if (score >= 80) {
    tier = {
      name: "Flourishing & Grounded",
      description: "You are experiencing high resilience, clear mental space, and healthy energy reserves.",
      color: "#2D6A4F",
      bgColor: "bg-emerald-50/90",
      borderColor: "border-emerald-300",
      badgeColor: "bg-emerald-100 text-emerald-800",
    };
  } else if (score >= 65) {
    tier = {
      name: "Balanced & Steady",
      description: "A calm, functional equilibrium. Demands are manageable with steady presence.",
      color: "#588157",
      bgColor: "bg-sage/15",
      borderColor: "border-sage/40",
      badgeColor: "bg-sage/20 text-deep-sage",
    };
  } else if (score >= 48) {
    tier = {
      name: "Steady with Gentle Care",
      description: "Some tension or fatigue is present. Your mind benefits from deliberate, low-pressure pacing.",
      color: "#B45309",
      bgColor: "bg-amber-50/90",
      borderColor: "border-amber-300",
      badgeColor: "bg-amber-100 text-amber-900",
    };
  } else if (score >= 30) {
    tier = {
      name: "Tender & Depleted",
      description: "Your reserves are running thin. Emotional sensitivity and cognitive friction require quiet compassion.",
      color: "#C2410C",
      bgColor: "bg-orange-50/90",
      borderColor: "border-orange-300",
      badgeColor: "bg-orange-100 text-orange-900",
    };
  } else {
    tier = {
      name: "High Tension — Sanctuary Needed",
      description: "Significant overwhelm or exhaustion detected. Prioritize immediate nervous system down-regulation.",
      color: "#B91C1C",
      bgColor: "bg-red-50/95",
      borderColor: "border-red-300",
      badgeColor: "bg-red-100 text-red-800",
    };
  }

  // Dimension sub-scores (0-100%)
  const breakdown = {
    moodScore: Math.round(((mood - 1) / 4) * 100),
    stressScore: Math.round(((stress - 1) / 4) * 100), // 5 = 100% spacious
    energyScore: Math.round(((energy - 1) / 4) * 100),
    sleepScore: Math.round(((sleep - 1) / 4) * 100),
    clarityScore: Math.round(((clarity - 1) / 4) * 100),
  };

  // Personalized clinical & mindful insight generator
  let insight = "";
  let recommendedAction: WellbeingAssessmentResult["recommendedAction"] = {
    title: "Talk with MindCare",
    description: "Externalize what is weighing on you in a calm, non-judgmental space.",
    type: "chat",
    prompt: `I just completed my daily wellbeing check-in with a score of ${score}/100. How can we reflect on this together?`,
  };

  // Pattern Detection:
  if (sleep <= 2 && stress <= 2) {
    insight =
      "Your physical recovery was interrupted last night while your mental demands are running high. When sleep is compromised, the amygdala becomes 60% more emotionally reactive, making normal tasks feel heavier. Do not judge yourself for feeling irritable or slow. Cancel non-urgent obligations, hydrate gently, and protect an early rest window tonight.";
    recommendedAction = {
      title: "2-Minute Calming Breathwork",
      description: "Engage your parasympathetic nervous system to lower physical tension immediately.",
      type: "breathe",
    };
  } else if (energy <= 2 && mood <= 2) {
    insight =
      "Both your emotional outlook and physical stamina are in a tender, low-fuel state today. This is not a failure of willpower — it is your nervous system asking for shelter. Give yourself full permission to lower your expectations today. Doing the bare minimum is not just enough; it is wise self-care.";
    recommendedAction = {
      title: "Gentle Sounding Board in Chat",
      description: "Unload swirling thoughts without having to maintain a brave face.",
      type: "chat",
      prompt: `My energy and mood feel quite low today (${score}/100). Can you hold space for me without trying to fix everything?`,
    };
  } else if (stress <= 2 && energy >= 4) {
    insight =
      "You have high drive and momentum, but your stress dial is turned tightly. When energy is high under acute pressure, we tend to run until we hit an abrupt burnout wall. Consciously schedule small 3-minute pauses between tasks to unclench your jaw and drop your shoulders.";
    recommendedAction = {
      title: "5-4-3-2-1 Somatic Grounding",
      description: "Reconnect with physical senses to prevent urgency from hijacking your focus.",
      type: "grounding",
    };
  } else if (clarity <= 2 && stress <= 3) {
    insight =
      "Your mind is carrying competing open tabs and foggy cognitive bandwidth today. Trying to force intense concentration will only increase frustration. Try externalizing your racing thoughts into words so they no longer have to loop in working memory.";
    recommendedAction = {
      title: "Unpack Your Mind in Chat",
      description: "Dump tangled thoughts in our private chat to find clear structure.",
      type: "chat",
      prompt: `My mind feels scattered and foggy right now (${score}/100). Help me untangle what's on my plate.`,
    };
  } else if (score >= 80) {
    insight =
      "You are in a flourishing, grounded state today with strong clarity and supportive vitality. Take a quiet moment to savor this ease. Notice where in your body this calm warmth lives. This is an opportune moment to invest in meaningful creative projects or extend kindness to someone around you.";
    recommendedAction = {
      title: "Anchor Your Gratitude in Chat",
      description: "Reflect on what is nourishing you to cement positive neural pathways.",
      type: "chat",
      prompt: `I'm feeling grounded and resilient today (${score}/100). Can we explore how to anchor this ease?`,
    };
  } else {
    insight =
      "You are navigating steady, neutral waters today. You don't need to perform forced cheerfulness or push for rapid breakthroughs. Normal, quiet, unhurried days are fertile soil for inner stability. Honor your natural pacing as you move through your afternoon.";
    recommendedAction = {
      title: "Reflective Check-in Chat",
      description: "Keep a gentle dialogue open for whatever arises throughout your day.",
      type: "chat",
      prompt: `I checked in with a balanced score of ${score}/100. How can we keep today steady and calm?`,
    };
  }

  return {
    score,
    tier,
    moodLabel,
    breakdown,
    insight,
    recommendedAction,
  };
}
