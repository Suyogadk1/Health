import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  Sparkles,
  Heart,
  Shield,
  Leaf,
  Compass,
  Feather,
  Sun,
  EyeOff,
  MessageCircle,
  Mic,
  ArrowRight,
  BookOpen,
} from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/navigation/Sidebar";
import { MobileNav } from "@/components/navigation/MobileNav";
import { BackButton } from "@/components/navigation/BackButton";

const TENETS = [
  {
    icon: Feather,
    title: "Slow, intentional pacing",
    subtitle: "Counteracting algorithmic rush",
    description:
      "Most modern software is engineered to trigger dopamine and accelerate your pulse. MindCare is crafted in reverse: unhurried responses, quiet breathing pauses, and organic visual rhythms designed to down-regulate your nervous system.",
  },
  {
    icon: Compass,
    title: "Reflective inquiry over cheerleading",
    subtitle: "Finding your own internal compass",
    description:
      "We avoid shallow toxic positivity and unsolicited advice. Instead of prescribing quick fixes, MindCare reflects your own words back with curiosity, helping you uncover underlying needs and emotional clarity.",
  },
  {
    icon: EyeOff,
    title: "Zero gamification & streaks",
    subtitle: "A refuge, not another daily obligation",
    description:
      "No guilt-inducing streak counters, pushy notifications, or vanity metrics. Visit when you feel burdened, talk until your shoulders relax, and return to your life without digital clinginess.",
  },
  {
    icon: Shield,
    title: "Clear, non-clinical boundaries",
    subtitle: "Compassionate accompaniment",
    description:
      "MindCare honors its role as a supportive sounding board. We do not pretend to be licensed human therapists or medical professionals. When deeper distress is detected, we immediately guide toward human crisis care.",
  },
];

const METHODOLOGY = [
  {
    step: "01",
    title: "Notice & Name",
    desc: "Unload swirling, tangled thoughts through private voice or reflective typing without fearing judgment or burdening anyone.",
  },
  {
    step: "02",
    title: "Untangle & Reflect",
    desc: "The mindful AI companion detects underlying emotional themes, offering gentle perspective and reflective inquiries.",
  },
  {
    step: "03",
    title: "Ground & Re-enter",
    desc: "Complete your session with steadying breathwork or a concise summary to walk back into your day with lighter shoulders.",
  },
];

export default async function AboutPage() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isGuest = Boolean(user && user.is_guest);

  const aboutContent = (
    <div className="max-w-4xl space-y-12">
      {/* Header & Hero */}
      <div>
        <div className="mb-4">
          <BackButton fallbackHref="/dashboard" label="Back" />
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-sage/40 bg-sage/15 px-3.5 py-1.5 text-xs font-medium text-deep-sage">
          <Sparkles size={14} />
          <span>Our Story & Philosophy</span>
        </div>

        <h1 className="mt-4 font-serif text-3xl sm:text-4xl lg:text-5xl text-charcoal leading-[1.2]">
          A quieter clearing in the forest of your mind.
        </h1>
        <p className="mt-4 text-base sm:text-lg text-soft-gray leading-relaxed max-w-2xl">
          MindCare was created in resistance to the noisy, high-pressure cadence of modern technology. It is an intentional sanctuary where you can speak honestly, untangle heavy emotions, and feel heard.
        </p>
      </div>

      {/* Featured Botanical Visual */}
      <div className="relative overflow-hidden rounded-3xl border border-charcoal/[0.08] shadow-sm">
        <div className="relative h-[260px] sm:h-[380px] w-full">
          <Image
            src="/images/about_sanctuary.jpg"
            alt="Sunlit architectural conservatory with lush ferns, linen meditation cushion, and warm morning light"
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-charcoal/70 via-charcoal/20 to-transparent" />
        </div>
        <div className="absolute bottom-5 left-5 right-5 sm:bottom-7 sm:left-7 text-warm-white">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-warm-white/20 px-3 py-1 text-[11px] font-medium backdrop-blur-md">
            <Leaf size={12} className="text-sage" /> Mindful Sanctuary
          </span>
          <p className="mt-2 text-sm sm:text-base font-serif italic text-warm-white/95 max-w-xl">
            "In nature, the understory is the fertile layer beneath the tallest canopy — where seedlings take root in quiet, shaded shelter."
          </p>
        </div>
      </div>

      {/* Core Tenets Grid */}
      <div>
        <h2 className="font-serif text-2xl text-charcoal">Core Tenets of MindCare</h2>
        <p className="mt-1 text-sm text-soft-gray">The principles shaping how we build conversational companion technology.</p>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {TENETS.map((tenet, idx) => {
            const Icon = tenet.icon;
            return (
              <div
                key={idx}
                className="flex flex-col justify-between rounded-3xl border border-charcoal/[0.07] bg-warm-white p-6 transition-all hover:border-sage/40 hover:shadow-xs"
              >
                <div>
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sage/15 text-deep-sage">
                    <Icon size={20} />
                  </span>
                  <h3 className="mt-4 font-serif text-lg text-charcoal">{tenet.title}</h3>
                  <p className="text-xs font-medium text-deep-sage mt-0.5">{tenet.subtitle}</p>
                  <p className="mt-2.5 text-xs sm:text-sm text-soft-gray leading-relaxed">
                    {tenet.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* The 3-Step Mindful Cycle */}
      <div className="rounded-3xl border border-sage/30 bg-[#F4F6F2] p-8">
        <h2 className="font-serif text-2xl text-charcoal text-center">The Mindful Reflection Cycle</h2>
        <p className="mt-1 text-center text-xs sm:text-sm text-soft-gray max-w-lg mx-auto">
          How a conversation with MindCare unfolds to bring mental clarity.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
          {METHODOLOGY.map((m) => (
            <div key={m.step} className="rounded-2xl bg-warm-white/90 p-5 shadow-2xs">
              <span className="font-serif text-2xl text-deep-sage/60">{m.step}</span>
              <h3 className="mt-2 font-serif text-base text-charcoal">{m.title}</h3>
              <p className="mt-1.5 text-xs text-soft-gray leading-relaxed">{m.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Origin & Commitment */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-3xl border border-charcoal/[0.07] bg-warm-white p-7">
          <div className="flex items-center gap-2.5 text-deep-sage">
            <BookOpen size={18} />
            <h3 className="font-serif text-lg text-charcoal">Why Not Another Chatbot?</h3>
          </div>
          <p className="mt-3 text-xs sm:text-sm text-soft-gray leading-relaxed">
            Mainstream chatbots are built as knowledge search engines or productivity optimizers. When people turn to them late at night with heavy hearts, they often receive robotic lists, clinical checklists, or cold disclaimers.
          </p>
          <p className="mt-2 text-xs sm:text-sm text-soft-gray leading-relaxed">
            MindCare is tuned specifically for empathetic pacing, reflective listening, and cognitive grounding. It listens to understand, not to grade your thoughts.
          </p>
        </div>

        <div className="rounded-3xl border border-charcoal/[0.07] bg-warm-white p-7">
          <div className="flex items-center gap-2.5 text-deep-sage">
            <Heart size={18} />
            <h3 className="font-serif text-lg text-charcoal">Our Commitment to You</h3>
          </div>
          <ul className="mt-3 space-y-2 text-xs sm:text-sm text-soft-gray">
            <li className="flex items-start gap-2">
              <span className="text-deep-sage mt-0.5">•</span>
              <span>We never sell your conversation data to third-party ad networks.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-deep-sage mt-0.5">•</span>
              <span>We never train public foundation models on your private thoughts.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-deep-sage mt-0.5">•</span>
              <span>We uphold rigorous safety guardrails with human helpline routing.</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Action / Next steps */}
      <div className="rounded-3xl bg-charcoal p-8 text-warm-white text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-6">
        <div>
          <h3 className="font-serif text-xl text-warm-white">Ready to explore a conversation?</h3>
          <p className="mt-1 text-xs sm:text-sm text-warm-white/70 max-w-md">
            Begin with a gentle mood check-in or converse directly with our 3D companion.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 shrink-0">
          <Link
            href="/chat"
            className="rounded-full bg-warm-white px-5 py-2.5 text-xs font-medium text-charcoal hover:bg-cream transition-all flex items-center gap-1.5"
          >
            <MessageCircle size={14} /> Open Chat
          </Link>
          <Link
            href="/voice"
            className="rounded-full border border-warm-white/30 bg-warm-white/10 px-5 py-2.5 text-xs font-medium text-warm-white hover:bg-warm-white/20 transition-all flex items-center gap-1.5"
          >
            <Mic size={14} /> Voice Mode
          </Link>
        </div>
      </div>
    </div>
  );

  // If user is inside the app session (guest or authenticated)
  if (user) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 px-4 py-6 sm:px-10 sm:py-10 pb-28 md:pb-10 max-w-4xl">
          {aboutContent}
        </main>
        <MobileNav />
      </div>
    );
  }

  // If public visitor
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
        {aboutContent}
      </main>
    </div>
  );
}
