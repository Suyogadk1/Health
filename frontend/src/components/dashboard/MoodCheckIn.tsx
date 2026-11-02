"use client";

import { CalmingMusic } from "./CalmingMusic";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Brain,
  Moon,
  Zap,
  Shield,
  Heart,
  MessageCircle,
  Wind,
  RotateCcw,
  Clock,
  TrendingUp,
  X,
  Volume2,
  Square,
  ArrowRight,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/Toast";
import type { Mood } from "@/types";
import { useAIVoice } from "@/hooks/useAIVoice";
import {
  WELLBEING_QUESTIONS,
  calculateWellbeingScore,
  AssessmentAnswers,
  WellbeingAssessmentResult,
} from "@/lib/wellbeing/assessment";

const QUICK_MOODS: { id: Mood; label: string; color: string; emoji: string }[] = [
  { id: "great", label: "Great", color: "#40916C", emoji: "🌿" },
  { id: "good", label: "Good", color: "#71866D", emoji: "☀️" },
  { id: "okay", label: "Okay", color: "#8B95A5", emoji: "⛅" },
  { id: "low", label: "Low", color: "#C17F5C", emoji: "🌧️" },
  { id: "stressed", label: "Extremely low", color: "#B91C1C", emoji: "🌪️" },
];

interface MoodCheckInProps {
  userId: string;
  initialCheckins?: any[];
}

export function MoodCheckIn({ userId, initialCheckins = [] }: MoodCheckInProps) {
  const [selectedQuickMood, setSelectedQuickMood] = useState<Mood | null>(null);
  const [musicPrompt, setMusicPrompt] = useState(0);
  const [isAssessing, setIsAssessing] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<AssessmentAnswers>({
    mood: 3,
    stress: 3,
    energy: 3,
    sleep: 3,
    clarity: 3,
    notes: "",
  });
  const [result, setResult] = useState<WellbeingAssessmentResult | null>(null);
  const [recentCheckins, setRecentCheckins] = useState<any[]>(initialCheckins);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showBreathing, setShowBreathing] = useState(false);

  const { isSpeaking, activeId, toggle: toggleVoice, isSupported: voiceSupported } = useAIVoice();
  const isInsightSpeaking = isSpeaking && activeId === "checkin-insight";

  const supabase = createClient();
  const { showToast } = useToast();
  const router = useRouter();

  // Load existing check-ins if not provided
  useEffect(() => {
    async function loadCheckins() {
      try {
        const { data } = await supabase
          .from("wellbeing_checkins")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(5);

        if (data && data.length > 0) {
          setRecentCheckins(data);
          // If the most recent checkin has a score, surface it
          const latest = data[0];
          if (latest.score && !result) {
            const calculated = calculateWellbeingScore({
              mood: latest.mood === "great" ? 5 : latest.mood === "good" ? 4 : latest.mood === "okay" ? 3 : 2,
              stress: latest.stress_level || 3,
              energy: latest.energy_level || 3,
              sleep: latest.sleep_quality || 3,
              clarity: latest.clarity_level || 3,
              notes: latest.notes,
            });
            // Preserve stored score and insight if available
            calculated.score = latest.score;
            if (latest.insight) calculated.insight = latest.insight;
            setResult(calculated);
          }
        }
      } catch {}
    }
    loadCheckins();
  }, [userId]);

  // Quick 1-tap mood selection
  async function handleQuickMood(mood: Mood) {
    setSelectedQuickMood(mood);
    if (mood === "low" || mood === "stressed") setMusicPrompt(n => n + 1);

    const numericMood = mood === "great" ? 5 : mood === "good" ? 4 : mood === "okay" ? 3 : mood === "low" ? 2 : 1;
    const defaultAnswers: AssessmentAnswers = {
      mood: numericMood,
      stress: mood === "stressed" ? 2 : 3,
      energy: mood === "low" ? 2 : 4,
      sleep: 3,
      clarity: 3,
    };

    setAnswers(defaultAnswers);
    const calculated = calculateWellbeingScore(defaultAnswers);
    setResult(calculated);

    try {
      const record = {
        user_id: userId,
        mood,
        stress_level: defaultAnswers.stress,
        sleep_quality: defaultAnswers.sleep,
        energy_level: defaultAnswers.energy,
        clarity_level: defaultAnswers.clarity,
        score: calculated.score,
        insight: calculated.insight,
        breakdown: calculated.breakdown,
        created_at: new Date().toISOString(),
      };

      await supabase.from("wellbeing_checkins").insert(record);
      // Background sync to backend API with verified session auth
      const {
        data: { session },
      } = await supabase.auth.getSession();
      fetch("/api/checkins", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify(record),
      }).catch(() => {});

      setRecentCheckins((prev) => [record, ...prev.slice(0, 4)]);
      showToast("Checked in successfully!");
    } catch {
      showToast("Thanks for checking in.");
    }
  }

  // Handle choice selection during multi-question assessment
  function handleSelectQuestionOption(value: number) {
    const qKey = WELLBEING_QUESTIONS[currentStep].id;
    setAnswers((prev) => ({ ...prev, [qKey]: value }));
    if (qKey === "mood" && value <= 2) setMusicPrompt(n => n + 1);

    if (currentStep < WELLBEING_QUESTIONS.length - 1) {
      setCurrentStep((prev) => prev + 1);
    }
  }

  // Final submission of 5 questions
  async function handleCompleteAssessment() {
    setIsSubmitting(true);
    const calculated = calculateWellbeingScore(answers);
    setResult(calculated);
    setIsAssessing(false);

    try {
      const record = {
        user_id: userId,
        mood: calculated.moodLabel,
        stress_level: answers.stress,
        sleep_quality: answers.sleep,
        energy_level: answers.energy,
        clarity_level: answers.clarity,
        score: calculated.score,
        insight: calculated.insight,
        breakdown: calculated.breakdown,
        notes: answers.notes || null,
        created_at: new Date().toISOString(),
      };

      await supabase.from("wellbeing_checkins").insert(record);
      // Background sync to backend
      const {
        data: { session },
      } = await supabase.auth.getSession();
      fetch("/api/checkins", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify(record),
      }).catch(() => {});

      setRecentCheckins((prev) => [record, ...prev.slice(0, 4)]);
      showToast("Assessment completed! Score & insights generated.");
    } catch {
      showToast("Assessment recorded.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleOpenChatWithContext(prompt?: string) {
    if (typeof window !== "undefined") {
      const text =
        prompt ||
        `I just took my daily wellbeing check-in. My MindCare score is ${result?.score}/100. How can you support me today?`;
      sessionStorage.setItem("mindcare_prefill_chat", text);
      router.push("/chat");
    }
  }

  return (
    <div className="mt-5 space-y-4">
      <CalmingMusic request={musicPrompt} />
      {/* 1. Quick Mood Row & Assessment Launcher */}
      <div className="rounded-3xl border border-charcoal/[0.07] bg-warm-white p-5 sm:p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-charcoal/[0.06] pb-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-sage/15 px-3 py-1 text-xs font-medium text-deep-sage">
              <Sparkles size={13} /> Daily Reflection
            </span>
            <h2 className="mt-1 font-serif text-xl sm:text-2xl text-charcoal">
              How is your mind feeling today?
            </h2>
          </div>

          <button
            type="button"
            onClick={() => {
              setIsAssessing(true);
              setCurrentStep(0);
            }}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-charcoal px-4 py-2.5 text-xs font-medium text-warm-white transition-all hover:bg-charcoal/85 hover:shadow-xs cursor-pointer shrink-0"
          >
            <Brain size={14} className="text-sage" />
            <span>Take 5-Question Assessment</span>
            <ChevronRight size={14} />
          </button>
        </div>

        {/* Quick 1-Tap Mood Selector */}
        <div className="mt-4">
          <p className="text-xs text-soft-gray mb-2.5">
            Quick 1-tap check-in or launch the deep assessment above:
          </p>
          <div className="flex flex-wrap gap-2 sm:gap-2.5">
            {QUICK_MOODS.map((m) => {
              const isSelected = selectedQuickMood === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => handleQuickMood(m.id)}
                  className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all duration-150 cursor-pointer ${
                    isSelected
                      ? "border-charcoal bg-charcoal text-warm-white shadow-xs scale-105"
                      : "border-charcoal/[0.1] bg-cream/60 text-charcoal hover:border-charcoal/30 hover:bg-warm-white"
                  }`}
                >
                  <span className="text-base leading-none">{m.emoji}</span>
                  <span>{m.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. Interactive 5-Question Stepper Modal / Panel */}
      {isAssessing && (
        <div className="rounded-3xl border-2 border-sage/40 bg-warm-white p-6 sm:p-8 shadow-md transition-all animate-fadeIn">
          {/* Progress Header */}
          <div className="flex items-center justify-between border-b border-charcoal/[0.08] pb-4">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-sage/20 font-mono text-xs font-bold text-deep-sage">
                {currentStep + 1}
              </span>
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-deep-sage">
                  Question {currentStep + 1} of {WELLBEING_QUESTIONS.length}
                </span>
                <p className="text-xs text-soft-gray font-medium">
                  {WELLBEING_QUESTIONS[currentStep].category}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsAssessing(false)}
              className="rounded-full p-2 text-soft-gray hover:bg-cream hover:text-charcoal cursor-pointer"
              aria-label="Close assessment"
            >
              <X size={16} />
            </button>
          </div>

          {/* Progress Bar */}
          <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-charcoal/[0.06]">
            <div
              className="h-full bg-deep-sage transition-all duration-300 ease-out rounded-full"
              style={{
                width: `${((currentStep + 1) / WELLBEING_QUESTIONS.length) * 100}%`,
              }}
            />
          </div>

          {/* Question Title & Prompt */}
          <div className="mt-6">
            <h3 className="font-serif text-xl sm:text-2xl text-charcoal">
              {WELLBEING_QUESTIONS[currentStep].title}
            </h3>
            <p className="mt-1 text-xs sm:text-sm text-soft-gray">
              {WELLBEING_QUESTIONS[currentStep].description}
            </p>
          </div>

          {/* Option Choices */}
          <div className="mt-6 space-y-2.5">
            {WELLBEING_QUESTIONS[currentStep].choices.map((c) => {
              const qKey = WELLBEING_QUESTIONS[currentStep].id;
              const isChosen = answers[qKey] === c.value;

              return (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => handleSelectQuestionOption(c.value)}
                  className={`flex w-full items-center justify-between rounded-2xl border p-4 text-left transition-all duration-150 cursor-pointer ${
                    isChosen
                      ? "border-deep-sage bg-sage/15 shadow-xs ring-1 ring-deep-sage"
                      : "border-charcoal/[0.08] bg-cream/40 hover:border-charcoal/25 hover:bg-warm-white"
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <span className="text-2xl leading-none">{c.emoji}</span>
                    <div>
                      <p className="text-sm font-semibold text-charcoal">{c.label}</p>
                      <p className="text-xs text-soft-gray mt-0.5">{c.subtitle}</p>
                    </div>
                  </div>

                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                      isChosen
                        ? "border-deep-sage bg-deep-sage text-warm-white"
                        : "border-charcoal/20 bg-warm-white"
                    }`}
                  >
                    {isChosen && <CheckCircle2 size={14} />}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Optional notes on last step */}
          {currentStep === WELLBEING_QUESTIONS.length - 1 && (
            <div className="mt-6 border-t border-charcoal/[0.08] pt-5">
              <label htmlFor="notes" className="block text-xs font-semibold text-charcoal">
                Private Note or Intention for Today (Optional)
              </label>
              <textarea
                id="notes"
                rows={2}
                value={answers.notes || ""}
                onChange={(e) => setAnswers((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="e.g. Struggling with a presentation at 3pm, need to stay grounded..."
                className="mt-2 w-full rounded-xl border border-charcoal/[0.12] bg-warm-white p-3 text-xs text-charcoal focus:border-deep-sage focus:outline-hidden focus:ring-1 focus:ring-deep-sage resize-none"
              />
            </div>
          )}

          {/* Stepper Navigation Buttons */}
          <div className="mt-6 flex items-center justify-between pt-4 border-t border-charcoal/[0.06]">
            <button
              type="button"
              onClick={() => setCurrentStep((prev) => Math.max(0, prev - 1))}
              disabled={currentStep === 0}
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-medium ${
                currentStep === 0
                  ? "text-charcoal/30 cursor-not-allowed"
                  : "text-charcoal hover:bg-cream cursor-pointer"
              }`}
            >
              <ChevronLeft size={14} /> Back
            </button>

            {currentStep < WELLBEING_QUESTIONS.length - 1 ? (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => prev + 1)}
                className="inline-flex items-center gap-1.5 rounded-full bg-charcoal px-5 py-2.5 text-xs font-medium text-warm-white hover:bg-charcoal/85 transition-colors cursor-pointer"
              >
                Next <ChevronRight size={14} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleCompleteAssessment}
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 rounded-full bg-deep-sage px-6 py-2.5 text-xs font-medium text-warm-white hover:bg-deep-sage/90 transition-all shadow-xs cursor-pointer"
              >
                <Sparkles size={14} />
                {isSubmitting ? "Analyzing..." : "Complete & Generate Score"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* 3. Rich Score & Clinical Insight Card */}
      {result && !isAssessing && (
        <div className="rounded-3xl border border-charcoal/[0.08] bg-warm-white p-6 sm:p-8 shadow-xs">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-charcoal/[0.07]">
            {/* Circular SVG Score Dial */}
            <div className="flex items-center gap-5">
              <div className="relative flex h-24 w-24 shrink-0 items-center justify-center">
                <svg className="h-full w-full -rotate-90 transform" viewBox="0 0 36 36">
                  {/* Background Circle */}
                  <path
                    className="text-cream"
                    strokeWidth="3.2"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  {/* Progress Gauge */}
                  <path
                    strokeDasharray={`${result.score}, 100`}
                    strokeWidth="3.2"
                    strokeLinecap="round"
                    stroke={result.tier.color}
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    className="transition-all duration-1000 ease-out"
                  />
                </svg>
                <div className="absolute flex flex-col items-center justify-center text-center">
                  <span className="font-serif text-2xl font-bold text-charcoal leading-none">
                    {result.score}
                  </span>
                  <span className="text-[10px] font-semibold text-soft-gray uppercase tracking-wider mt-0.5">
                    / 100
                  </span>
                </div>
              </div>

              <div>
                <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${result.tier.badgeColor}`}>
                  {result.tier.name}
                </span>
                <h3 className="mt-1 font-serif text-lg text-charcoal">MindCare Wellbeing Score</h3>
                <p className="mt-0.5 text-xs text-soft-gray max-w-sm leading-relaxed">
                  {result.tier.description}
                </p>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => handleOpenChatWithContext(result.recommendedAction.prompt)}
                className="inline-flex items-center gap-1.5 rounded-full bg-charcoal px-4 py-2.5 text-xs font-medium text-warm-white hover:bg-charcoal/85 transition-colors cursor-pointer"
              >
                <MessageCircle size={14} />
                <span>Talk with Companion</span>
              </button>

              <button
                type="button"
                onClick={() => setShowBreathing(!showBreathing)}
                className="inline-flex items-center gap-1.5 rounded-full border border-charcoal/15 bg-warm-white px-4 py-2.5 text-xs font-medium text-charcoal hover:bg-cream transition-colors cursor-pointer"
              >
                <Wind size={14} className="text-deep-sage" />
                <span>{showBreathing ? "Hide Breathwork" : "2-Min Breath Pacer"}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsAssessing(true);
                  setCurrentStep(0);
                }}
                className="inline-flex items-center gap-1 rounded-full p-2 text-soft-gray hover:bg-cream hover:text-charcoal cursor-pointer"
                title="Retake assessment"
              >
                <RotateCcw size={15} />
              </button>
            </div>
          </div>

          {/* 5 Dimensions Sub-Score Breakdown */}
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="rounded-2xl bg-cream/50 p-3 border border-charcoal/[0.05]">
              <div className="flex items-center gap-1.5 text-xs text-soft-gray font-medium">
                <Heart size={13} className="text-deep-sage" />
                <span>Mood</span>
              </div>
              <p className="mt-1 font-serif text-base font-semibold text-charcoal">
                {result.breakdown.moodScore}%
              </p>
              <div className="mt-1.5 h-1 w-full bg-charcoal/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-deep-sage rounded-full"
                  style={{ width: `${result.breakdown.moodScore}%` }}
                />
              </div>
            </div>

            <div className="rounded-2xl bg-cream/50 p-3 border border-charcoal/[0.05]">
              <div className="flex items-center gap-1.5 text-xs text-soft-gray font-medium">
                <Shield size={13} className="text-deep-sage" />
                <span>Stress Relief</span>
              </div>
              <p className="mt-1 font-serif text-base font-semibold text-charcoal">
                {result.breakdown.stressScore}%
              </p>
              <div className="mt-1.5 h-1 w-full bg-charcoal/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-deep-sage rounded-full"
                  style={{ width: `${result.breakdown.stressScore}%` }}
                />
              </div>
            </div>

            <div className="rounded-2xl bg-cream/50 p-3 border border-charcoal/[0.05]">
              <div className="flex items-center gap-1.5 text-xs text-soft-gray font-medium">
                <Zap size={13} className="text-deep-sage" />
                <span>Vitality</span>
              </div>
              <p className="mt-1 font-serif text-base font-semibold text-charcoal">
                {result.breakdown.energyScore}%
              </p>
              <div className="mt-1.5 h-1 w-full bg-charcoal/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-deep-sage rounded-full"
                  style={{ width: `${result.breakdown.energyScore}%` }}
                />
              </div>
            </div>

            <div className="rounded-2xl bg-cream/50 p-3 border border-charcoal/[0.05]">
              <div className="flex items-center gap-1.5 text-xs text-soft-gray font-medium">
                <Moon size={13} className="text-deep-sage" />
                <span>Rest Quality</span>
              </div>
              <p className="mt-1 font-serif text-base font-semibold text-charcoal">
                {result.breakdown.sleepScore}%
              </p>
              <div className="mt-1.5 h-1 w-full bg-charcoal/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-deep-sage rounded-full"
                  style={{ width: `${result.breakdown.sleepScore}%` }}
                />
              </div>
            </div>

            <div className="col-span-2 sm:col-span-1 rounded-2xl bg-cream/50 p-3 border border-charcoal/[0.05]">
              <div className="flex items-center gap-1.5 text-xs text-soft-gray font-medium">
                <Brain size={13} className="text-deep-sage" />
                <span>Clarity</span>
              </div>
              <p className="mt-1 font-serif text-base font-semibold text-charcoal">
                {result.breakdown.clarityScore}%
              </p>
              <div className="mt-1.5 h-1 w-full bg-charcoal/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-deep-sage rounded-full"
                  style={{ width: `${result.breakdown.clarityScore}%` }}
                />
              </div>
            </div>
          </div>

          {/* Personalized Clinical & Mindful Insight Box */}
          <div className="mt-5 rounded-2xl border border-sage/30 bg-[#F4F6F2] p-5">
            <div className="flex items-center justify-between gap-2 border-b border-sage/20 pb-2.5">
              <div className="flex items-center gap-2 text-deep-sage font-semibold text-xs uppercase tracking-wider">
                <Sparkles size={14} />
                <span>Personalized Reflection & Clinical Insight</span>
              </div>

              {voiceSupported && (
                <button
                  type="button"
                  onClick={() => toggleVoice(result.insight, "checkin-insight")}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all cursor-pointer ${
                    isInsightSpeaking
                      ? "bg-deep-sage text-warm-white shadow-xs ring-1 ring-deep-sage animate-pulse"
                      : "bg-sage/20 hover:bg-sage/30 text-deep-sage"
                  }`}
                  title={isInsightSpeaking ? "Stop voice narration" : "Listen to this reflection in AI voice"}
                  aria-label={isInsightSpeaking ? "Stop speech narration" : "Listen to speech narration"}
                >
                  {isInsightSpeaking ? (
                    <>
                      <span className="flex items-end gap-0.5 h-3 w-2.5">
                        <span className="w-0.5 bg-warm-white rounded-full animate-bounce h-2" style={{ animationDelay: "0ms" }} />
                        <span className="w-0.5 bg-warm-white rounded-full animate-bounce h-3" style={{ animationDelay: "150ms" }} />
                        <span className="w-0.5 bg-warm-white rounded-full animate-bounce h-1.5" style={{ animationDelay: "300ms" }} />
                      </span>
                      <span>Speaking…</span>
                      <Square size={9} fill="currentColor" />
                    </>
                  ) : (
                    <>
                      <Volume2 size={13} />
                      <span>Listen to Reflection</span>
                    </>
                  )}
                </button>
              )}
            </div>

            <p className="mt-3 text-xs sm:text-sm text-charcoal/90 leading-relaxed">
              {result.insight}
            </p>

            {/* Contextual AI Suggestions based on this check-in */}
            <div className="mt-4 pt-3.5 border-t border-sage/25">
              <div className="flex items-center justify-between text-xs font-semibold text-deep-sage mb-2">
                <span className="flex items-center gap-1.5">
                  <Sparkles size={13} />
                  <span>AI Conversation Suggestions Based on Your Check-in:</span>
                </span>
                <span className="text-[10px] text-soft-gray font-normal hidden sm:inline">Click to talk in chat</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  {
                    label: result.recommendedAction.title,
                    prompt:
                      result.recommendedAction.prompt ||
                      `I just completed my daily check-in with a score of ${result.score}/100. How can we reflect on this together?`,
                  },
                  ...(answers.stress <= 2
                    ? [
                        {
                          label: "Decompress stress & tension",
                          prompt:
                            "My stress levels feel elevated today. Can we work through some decompression techniques together?",
                        },
                      ]
                    : []),
                  ...(answers.energy <= 2
                    ? [
                        {
                          label: "Pacing plan for low battery",
                          prompt:
                            "My physical energy feels drained today. Help me plan low-pressure pacing so I don't feel guilty.",
                        },
                      ]
                    : []),
                  ...(answers.sleep <= 2
                    ? [
                        {
                          label: "Restore after poor sleep",
                          prompt:
                            "I had fragmented sleep last night. How can I protect my mental clarity and rest today?",
                        },
                      ]
                    : []),
                  ...(answers.notes
                    ? [
                        {
                          label: `Discuss intention: "${answers.notes.slice(0, 18)}…"`,
                          prompt: `I set this daily intention during my check-in: "${answers.notes}". How can you support me with this today?`,
                        },
                      ]
                    : []),
                  {
                    label: `Explore my score (${result.score}/100)`,
                    prompt: `I just checked in with a MindCare wellbeing score of ${result.score}/100 and feeling ${result.moodLabel}. What gentle guidance do you see for me?`,
                  },
                ]
                  .slice(0, 3)
                  .map((item, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleOpenChatWithContext(item.prompt)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-deep-sage/30 bg-warm-white hover:bg-deep-sage hover:text-warm-white px-3.5 py-1.5 text-xs font-medium text-charcoal transition-all shadow-2xs hover:shadow-xs active:scale-95 cursor-pointer"
                    >
                      <MessageCircle size={12} className="text-deep-sage hover:text-warm-white shrink-0" />
                      <span>{item.label}</span>
                      <ArrowRight size={10} className="opacity-60" />
                    </button>
                  ))}
              </div>
            </div>
          </div>

          {/* Interactive Box Breathing Pacer */}
          {showBreathing && (
            <div className="mt-5 rounded-2xl border border-sage/40 bg-warm-white p-6 text-center animate-fadeIn">
              <span className="text-xs font-semibold uppercase tracking-wider text-deep-sage">
                Box Breathing Reset (4-4-4-4)
              </span>
              <p className="mt-1 text-xs text-soft-gray">
                Follow the gentle rhythm to down-regulate heart rate and mental urgency.
              </p>

              <div className="my-6 flex justify-center">
                <div className="relative flex h-28 w-28 items-center justify-center rounded-full bg-sage/20 animate-pulse text-deep-sage font-serif font-medium text-sm">
                  Inhale · Hold · Exhale
                </div>
              </div>

              <div className="flex justify-center gap-4 text-xs text-soft-gray">
                <span>Inhale (4s)</span>
                <span>•</span>
                <span>Hold (4s)</span>
                <span>•</span>
                <span>Exhale (4s)</span>
                <span>•</span>
                <span>Pause (4s)</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. Recent Check-in Score History */}
      {recentCheckins.length > 0 && (
        <div className="rounded-3xl border border-charcoal/[0.06] bg-cream/50 p-5">
          <div className="flex items-center justify-between text-xs text-soft-gray mb-3 font-medium">
            <div className="flex items-center gap-1.5">
              <Clock size={13} className="text-deep-sage" />
              <span>Recent Wellbeing Check-in History</span>
            </div>
            <div className="flex items-center gap-1 text-[11px]">
              <TrendingUp size={12} className="text-deep-sage" />
              <span>{recentCheckins.length} recorded</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {recentCheckins.slice(0, 5).map((chk: any, idx: number) => {
              const dateStr = new Date(chk.created_at).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              });
              const moodEmoji =
                chk.mood === "great" ? "🌿" : chk.mood === "good" ? "☀️" : chk.mood === "okay" ? "⛅" : chk.mood === "low" ? "🌧️" : "🌪️";

              return (
                <div
                  key={chk.id || idx}
                  className="inline-flex items-center gap-2 rounded-xl border border-charcoal/[0.08] bg-warm-white px-3 py-1.5 text-xs text-charcoal shadow-2xs"
                >
                  <span>{moodEmoji}</span>
                  <span className="font-semibold text-deep-sage">
                    {chk.score ? `${chk.score}/100` : chk.mood}
                  </span>
                  <span className="text-soft-gray text-[10px]">• {dateStr}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
