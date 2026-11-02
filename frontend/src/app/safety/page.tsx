import Link from "next/link";
import Image from "next/image";
import {
  ShieldCheck,
  HeartHandshake,
  PhoneCall,
  AlertTriangle,
  ArrowLeft,
  LifeBuoy,
  CheckCircle2,
  XCircle,
  Eye,
  Sparkles,
  HelpCircle,
  Radio,
} from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/navigation/Sidebar";
import { MobileNav } from "@/components/navigation/MobileNav";
import { BackButton } from "@/components/navigation/BackButton";

const HELPLINES = [
  {
    region: "United States & Canada",
    name: "988 Suicide & Crisis Lifeline",
    action: "Call or Text 988",
    detail: "Free, confidential 24/7 support for anyone in suicidal crisis or emotional distress.",
    href: "tel:988",
    badge: "24/7 Toll-free",
  },
  {
    region: "United States & Canada",
    name: "Crisis Text Line",
    action: "Text HOME to 741741",
    detail: "Connect with a trained volunteer Crisis Counselor via text 24/7.",
    href: "sms:741741?&body=HOME",
    badge: "24/7 Text",
  },
  {
    region: "United Kingdom",
    name: "Samaritans UK & ROI",
    action: "Call 116 123",
    detail: "Confidential emotional support for anyone experiencing feelings of distress or despair.",
    href: "tel:116123",
    badge: "24/7 Free",
  },
  {
    region: "India",
    name: "KIRAN Mental Health Helpline",
    action: "Call 1800-599-0019",
    detail: "24/7 national psychological helpline managed by the Ministry of Social Justice.",
    href: "tel:18005990019",
    badge: "24/7 National",
  },
  {
    region: "European Union & India",
    name: "General Emergency Services",
    action: "Call 112",
    detail: "Immediate police, fire, or medical dispatch for acute physical or medical danger.",
    href: "tel:112",
    badge: "Emergency Services",
  },
  {
    region: "International & Worldwide",
    name: "Befrienders Worldwide",
    action: "Visit befrienders.org",
    detail: "Global network of 349 emotional support centres across 32 countries.",
    href: "https://www.befrienders.org",
    badge: "Worldwide Directory",
  },
];

const SCOPE_ITEMS = [
  {
    canDo: true,
    title: "Holding compassionate space",
    desc: "A non-judgmental conversational sounding board to externalize racing thoughts and feelings.",
  },
  {
    canDo: true,
    title: "Everyday stress & burnout",
    desc: "Helping untangle workplace exhaustion, interpersonal friction, and creative blocks.",
  },
  {
    canDo: true,
    title: "Guided grounding exercises",
    desc: "Step-by-step breathing, progressive muscle relaxation prompts, and somatic sensory focus.",
  },
  {
    canDo: true,
    title: "Identifying cognitive loops",
    desc: "Gently highlighting catastrophizing, black-and-white thinking, and harsh self-talk.",
  },
  {
    canDo: false,
    title: "Medical or psychiatric diagnosis",
    desc: "MindCare cannot and will not diagnose depression, bipolar disorder, PTSD, or any condition.",
  },
  {
    canDo: false,
    title: "Medication advice or adjustment",
    desc: "We cannot recommend, prescribe, or comment on psychiatric or pharmaceutical dosages.",
  },
  {
    canDo: false,
    title: "Crisis de-escalation & intervention",
    desc: "If acute self-harm or violence is detected, conversations are paused and routed to human care.",
  },
  {
    canDo: false,
    title: "Substituted clinical therapy",
    desc: "MindCare is not a licensed physician, psychotherapist, clinical psychologist, or psychiatrist.",
  },
];

const GROUNDING_STEPS = [
  { num: "5", sense: "SEE", text: "Look around and notice 5 things you can see right now (a shadow, a leaf, a texture)." },
  { num: "4", sense: "TOUCH", text: "Feel 4 physical sensations (your feet on the floor, the fabric of your shirt, cool air)." },
  { num: "3", sense: "HEAR", text: "Listen for 3 distinct sounds in your surroundings (distant traffic, a fan, birds outside)." },
  { num: "2", sense: "SMELL", text: "Notice 2 scents in the air (coffee, cedar, rain, or simply taking a deep breath in)." },
  { num: "1", sense: "TASTE", text: "Notice 1 taste in your mouth, or take a refreshing sip of cool water." },
];

export default async function SafetyPage() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const safetyBody = (
    <div className="max-w-4xl space-y-12">
      {/* Header */}
      <div>
        <div className="mb-4">
          <BackButton fallbackHref="/dashboard" label="Back" />
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-sage/40 bg-sage/15 px-3.5 py-1.5 text-xs font-medium text-deep-sage">
          <ShieldCheck size={14} />
          <span>Safety Architecture & Guardrails</span>
        </div>

        <h1 className="mt-4 font-serif text-3xl sm:text-4xl lg:text-5xl text-charcoal leading-[1.2]">
          Compassionate boundaries you can rely on.
        </h1>
        <p className="mt-4 text-base sm:text-lg text-soft-gray leading-relaxed max-w-2xl">
          MindCare is engineered with uncompromising safety ethics. We believe artificial intelligence must respect its limitations and prioritize human safety above all else.
        </p>
      </div>

      {/* Featured Visual */}
      <div className="relative overflow-hidden rounded-3xl border border-charcoal/[0.08] shadow-sm">
        <div className="relative h-[240px] sm:h-[360px] w-full">
          <Image
            src="/images/safety_haven.jpg"
            alt="Misty rainforest pathway with sturdy timber railings and moss-covered cedar trees"
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-charcoal/70 via-charcoal/20 to-transparent" />
        </div>
        <div className="absolute bottom-5 left-5 right-5 sm:bottom-7 sm:left-7 text-warm-white">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-warm-white/20 px-3 py-1 text-[11px] font-medium backdrop-blur-md">
            <Radio size={12} className="text-sage" /> Guarded Sanctuary
          </span>
          <p className="mt-2 text-sm sm:text-base font-serif italic text-warm-white/95 max-w-xl">
            "A true sanctuary is defined not by how far it lets you wander, but by how reliably it catches you when ground gives way."
          </p>
        </div>
      </div>

      {/* Urgent Crisis Interception Banner */}
      <div className="rounded-3xl border-2 border-dusty-rose/40 bg-dusty-rose/10 p-7 sm:p-8">
        <div className="flex items-start gap-3.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-dusty-rose/20 text-dusty-rose">
            <AlertTriangle size={22} />
          </span>
          <div>
            <h2 className="font-serif text-xl sm:text-2xl text-charcoal">
              If you are in acute crisis, distress, or immediate danger
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-soft-gray leading-relaxed">
              MindCare is a gentle reflection tool, not an emergency response unit or clinical intervention service. If you are experiencing thoughts of self-harm, suicide, or severe psychiatric distress, please connect with a live, trained human responder right now:
            </p>
          </div>
        </div>

        {/* Helpline Cards */}
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {HELPLINES.map((h, i) => (
            <div
              key={i}
              className="flex flex-col justify-between rounded-2xl border border-charcoal/10 bg-warm-white p-4 shadow-2xs transition-all hover:border-dusty-rose/40"
            >
              <div>
                <div className="flex items-center justify-between text-[11px] text-soft-gray mb-1.5">
                  <span>{h.region}</span>
                  <span className="rounded-md bg-sage/15 px-1.5 py-0.5 font-medium text-deep-sage text-[10px]">
                    {h.badge}
                  </span>
                </div>
                <p className="text-sm font-medium text-charcoal">{h.name}</p>
                <p className="mt-1 text-xs text-soft-gray leading-normal">{h.detail}</p>
              </div>
              <a
                href={h.href}
                className="mt-3.5 inline-flex items-center justify-center gap-2 rounded-xl bg-charcoal px-3 py-2 text-xs font-medium text-warm-white transition-colors hover:bg-charcoal/85 text-center"
              >
                <PhoneCall size={13} />
                {h.action}
              </a>
            </div>
          ))}
        </div>
      </div>

      {/* Scope of Practice Matrix */}
      <div>
        <h2 className="font-serif text-2xl text-charcoal">Scope of Practice Boundaries</h2>
        <p className="mt-1 text-sm text-soft-gray">
          Transparency about what our conversational AI can support and where its boundaries begin.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {SCOPE_ITEMS.map((item, idx) => (
            <div
              key={idx}
              className={`rounded-2xl border p-5 ${
                item.canDo
                  ? "border-sage/30 bg-warm-white"
                  : "border-dusty-rose/25 bg-dusty-rose/[0.04]"
              }`}
            >
              <div className="flex items-center gap-2.5">
                {item.canDo ? (
                  <CheckCircle2 size={18} className="shrink-0 text-deep-sage" />
                ) : (
                  <XCircle size={18} className="shrink-0 text-dusty-rose" />
                )}
                <h3 className="font-serif text-base text-charcoal">{item.title}</h3>
              </div>
              <p className="mt-2 text-xs sm:text-sm text-soft-gray leading-relaxed pl-7">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Somatic Sensory Grounding Guide */}
      <div className="rounded-3xl border border-sage/40 bg-[#EDF1EA]/70 p-8">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sage/25 text-deep-sage">
            <Sparkles size={20} />
          </span>
          <div>
            <h2 className="font-serif text-2xl text-charcoal">The 5-4-3-2-1 Sensory Grounding Technique</h2>
            <p className="text-xs sm:text-sm text-soft-gray">
              If your mind feels overwhelmed or dizzy right now, try this gentle somatic reset.
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          {GROUNDING_STEPS.map((step) => (
            <div
              key={step.num}
              className="flex items-start gap-4 rounded-2xl bg-warm-white p-4 shadow-2xs"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-deep-sage text-warm-white font-serif font-bold text-sm">
                {step.num}
              </span>
              <div>
                <span className="text-[11px] font-semibold tracking-wider text-deep-sage uppercase">
                  {step.sense}
                </span>
                <p className="text-xs sm:text-sm text-charcoal mt-0.5 leading-relaxed">
                  {step.text}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Safety Protocol Architecture */}
      <div className="rounded-3xl border border-charcoal/[0.07] bg-warm-white p-8">
        <h2 className="font-serif text-2xl text-charcoal">Automated Crisis Detection Pipeline</h2>
        <p className="mt-1 text-xs sm:text-sm text-soft-gray">
          How our underlying engineering stack protects users during conversational interactions.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="border-l-2 border-sage pl-4">
            <span className="text-xs font-semibold text-deep-sage uppercase tracking-wider">Step 1</span>
            <h3 className="mt-1 font-serif text-base text-charcoal">Real-time Sentiment Scan</h3>
            <p className="mt-1 text-xs text-soft-gray leading-relaxed">
              Every message passes through safety classifiers that detect self-harm ideation, physical threats, and extreme emotional vulnerability.
            </p>
          </div>

          <div className="border-l-2 border-dusty-rose pl-4">
            <span className="text-xs font-semibold text-dusty-rose uppercase tracking-wider">Step 2</span>
            <h3 className="mt-1 font-serif text-base text-charcoal">Immediate Generation Halting</h3>
            <p className="mt-1 text-xs text-soft-gray leading-relaxed">
              If critical crisis markers trigger, typical AI text generation is aborted. The system suppresses conversational open-loop replies.
            </p>
          </div>

          <div className="border-l-2 border-charcoal pl-4">
            <span className="text-xs font-semibold text-charcoal uppercase tracking-wider">Step 3</span>
            <h3 className="mt-1 font-serif text-base text-charcoal">Helpline Interception</h3>
            <p className="mt-1 text-xs text-soft-gray leading-relaxed">
              The user interface automatically surfaces verified, clickable 24/7 national helpline resources and advises immediate human contact.
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  // In-session layout (guest or authenticated)
  if (user) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 px-4 py-6 sm:px-10 sm:py-10 pb-28 md:pb-10 max-w-4xl">
          {safetyBody}
        </main>
        <MobileNav />
      </div>
    );
  }

  // Public visitor layout
  return (
    <div className="min-h-screen bg-cream">
      <header className="border-b border-charcoal/[0.06] bg-cream/80 backdrop-blur-md px-4 py-3 sm:px-6 sm:py-4 sticky top-0 z-50">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <BackButton fallbackHref="/" label="Back to MindCare" />
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="rounded-full bg-charcoal px-4 py-1.5 text-xs font-medium text-warm-white transition-colors hover:bg-charcoal/85"
            >
              Enter Sanctuary
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-16">
        {safetyBody}
      </main>
    </div>
  );
}
