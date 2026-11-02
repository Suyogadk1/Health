import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  Lock,
  ShieldCheck,
  Database,
  Key,
  Download,
  Trash2,
  CheckCircle,
  Cpu,
  MicOff,
  FileText,
  Sparkles,
} from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/navigation/Sidebar";
import { MobileNav } from "@/components/navigation/MobileNav";
import { BackButton } from "@/components/navigation/BackButton";

const PILLARS = [
  {
    icon: Database,
    title: "PostgreSQL Row-Level Security",
    desc: "Database access rules are enforced directly at the SQL engine level. Even if an internal application query is malformed, the database kernel strictly refuses to return rows that do not match your unique authenticated UUID.",
  },
  {
    icon: Cpu,
    title: "Zero Model Training on Your Thoughts",
    desc: "We strictly prohibit using your personal conversational reflections, transcripts, or journal entries to train, tune, or improve public machine learning foundation models. Your thoughts remain your own.",
  },
  {
    icon: ShieldCheck,
    title: "No Ad Networks or Data Brokers",
    desc: "MindCare has no advertising business model. We do not embed Meta tracking pixels, Google ad tags, or behavioral fingerprinting scripts. We will never sell your mental health records to insurers or data aggregators.",
  },
  {
    icon: Key,
    title: "Sovereign Portability & Total Erasure",
    desc: "You can download a complete, readable JSON copy of all your check-ins and conversations with one click. If you choose to delete your account, all associated rows are purged permanently with zero retention.",
  },
];

const DATA_INVENTORY = [
  {
    category: "Account Credentials",
    items: "Email address, display name, password hash",
    purpose: "Authenticating your secure login session",
    retention: "Retained until account deletion",
    encryption: "Bcrypt hash / TLS 1.3 in transit",
  },
  {
    category: "Conversational Reflections",
    items: "Text message contents, assistant replies",
    purpose: "Displaying your ongoing dialogue history",
    retention: "Retained until deleted by user",
    encryption: "AES-256 at rest, TLS 1.3 in transit",
  },
  {
    category: "Voice Audio Streams",
    items: "Spoken microphone audio input",
    purpose: "Converted to text via browser Speech API",
    retention: "Never recorded or stored on servers",
    encryption: "Processed locally in browser memory",
  },
  {
    category: "Wellbeing Check-ins",
    items: "Mood label, stress score, sleep rating",
    purpose: "Powering your personal wellbeing dashboard",
    retention: "Retained until account deletion",
    encryption: "AES-256 at rest, Row-Level Security",
  },
];

export default async function PrivacyPage() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const privacyContent = (
    <div className="max-w-4xl space-y-12">
      {/* Header */}
      <div>
        <div className="mb-4">
          <BackButton fallbackHref="/dashboard" label="Back" />
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-sage/40 bg-sage/15 px-3.5 py-1.5 text-xs font-medium text-deep-sage">
          <Lock size={14} />
          <span>Privacy by Design & Data Dignity</span>
        </div>

        <h1 className="mt-4 font-serif text-3xl sm:text-4xl lg:text-5xl text-charcoal leading-[1.2]">
          Your thoughts belong exclusively to you.
        </h1>
        <p className="mt-4 text-base sm:text-lg text-soft-gray leading-relaxed max-w-2xl">
          We treat mental wellbeing reflections as sacred, confidential ground. We reject surveillance capitalism and uphold radical transparency in how your information is handled.
        </p>
      </div>

      {/* Featured Visual */}
      <div className="relative overflow-hidden rounded-3xl border border-charcoal/[0.08] shadow-sm">
        <div className="relative h-[240px] sm:h-[360px] w-full">
          <Image
            src="/images/privacy_vault.jpg"
            alt="Minimalist frosted translucent glass cube with internal geometric light resting on moss and slate in a peaceful forest"
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-charcoal/70 via-charcoal/20 to-transparent" />
        </div>
        <div className="absolute bottom-5 left-5 right-5 sm:bottom-7 sm:left-7 text-warm-white">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-warm-white/20 px-3 py-1 text-[11px] font-medium backdrop-blur-md">
            <Lock size={12} className="text-sage" /> Digital Cryptographic Vault
          </span>
          <p className="mt-2 text-sm sm:text-base font-serif italic text-warm-white/95 max-w-xl">
            "Trust is not built with vague legal clauses. It is built through unbreakable architectural boundaries."
          </p>
        </div>
      </div>

      {/* The 4 Sacred Privacy Pillars */}
      <div>
        <h2 className="font-serif text-2xl text-charcoal">The Four Pillars of MindCare Privacy</h2>
        <p className="mt-1 text-sm text-soft-gray">
          Engineered from the ground up to protect intimate emotional disclosures.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {PILLARS.map((p, i) => {
            const Icon = p.icon;
            return (
              <div
                key={i}
                className="flex flex-col justify-between rounded-3xl border border-charcoal/[0.07] bg-warm-white p-6 transition-all hover:border-sage/40 hover:shadow-xs"
              >
                <div>
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sage/15 text-deep-sage">
                    <Icon size={20} />
                  </span>
                  <h3 className="mt-4 font-serif text-lg text-charcoal">{p.title}</h3>
                  <p className="mt-2.5 text-xs sm:text-sm text-soft-gray leading-relaxed">
                    {p.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Voice & Microphone Privacy Note */}
      <div className="rounded-3xl border border-sage/40 bg-[#EDF1EA]/60 p-7 sm:p-8">
        <div className="flex items-start gap-3.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sage/25 text-deep-sage">
            <MicOff size={20} />
          </span>
          <div>
            <h2 className="font-serif text-xl text-charcoal">How Voice Mode Handles Your Speech</h2>
            <p className="mt-2 text-xs sm:text-sm text-soft-gray leading-relaxed">
              When using voice mode, MindCare taps directly into your browser's native Speech Recognition interface. We do not record, store, or stream raw WAV/MP3 audio files to remote storage buckets.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs text-charcoal">
              <div className="flex items-center gap-2 rounded-xl bg-warm-white p-3 shadow-2xs">
                <CheckCircle size={15} className="text-deep-sage shrink-0" />
                <span>Microphone access requires explicit permission</span>
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-warm-white p-3 shadow-2xs">
                <CheckCircle size={15} className="text-deep-sage shrink-0" />
                <span>Zero audio recordings stored on external servers</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Data Inventory Table */}
      <div>
        <h2 className="font-serif text-2xl text-charcoal">Comprehensive Data Inventory</h2>
        <p className="mt-1 text-sm text-soft-gray">
          A clear breakdown of what data exists, why it exists, and how long it remains.
        </p>

        <div className="mt-6 overflow-x-auto rounded-2xl border border-charcoal/10 bg-warm-white shadow-2xs">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-charcoal/[0.08] bg-cream/70 text-charcoal font-medium">
                <th className="px-4 py-3 sm:px-6">Category</th>
                <th className="px-4 py-3 sm:px-6">Data Stored</th>
                <th className="px-4 py-3 sm:px-6">Purpose</th>
                <th className="px-4 py-3 sm:px-6">Security Standard</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-charcoal/[0.06] text-soft-gray">
              {DATA_INVENTORY.map((row, i) => (
                <tr key={i} className="hover:bg-cream/30 transition-colors">
                  <td className="px-4 py-3.5 sm:px-6 font-medium text-charcoal">{row.category}</td>
                  <td className="px-4 py-3.5 sm:px-6">{row.items}</td>
                  <td className="px-4 py-3.5 sm:px-6">{row.purpose}</td>
                  <td className="px-4 py-3.5 sm:px-6 text-deep-sage font-mono text-xs">{row.encryption}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Rights & Controls */}
      <div className="rounded-3xl border border-charcoal/[0.07] bg-warm-white p-8">
        <h2 className="font-serif text-2xl text-charcoal">Your Rights & Direct Controls</h2>
        <p className="mt-1 text-xs sm:text-sm text-soft-gray">
          You hold total autonomy over your data. In compliance with international GDPR, CCPA, and privacy frameworks:
        </p>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-charcoal/10 p-5">
            <div className="flex items-center gap-2 text-charcoal font-medium text-sm">
              <Download size={16} className="text-deep-sage" />
              <span>Right to Portability</span>
            </div>
            <p className="mt-2 text-xs text-soft-gray leading-relaxed">
              Export every check-in, message, and profile attribute to an open standard JSON document anytime from your Settings panel.
            </p>
          </div>

          <div className="rounded-2xl border border-charcoal/10 p-5">
            <div className="flex items-center gap-2 text-dusty-rose font-medium text-sm">
              <Trash2 size={16} />
              <span>Right to Total Erasure</span>
            </div>
            <p className="mt-2 text-xs text-soft-gray leading-relaxed">
              Permanently delete your account with a single confirmation. We wipe database rows instantly without retaining archival ghost copies.
            </p>
          </div>
        </div>

        {user && (
          <div className="mt-6 flex items-center justify-end">
            <Link
              href="/settings"
              className="inline-flex items-center gap-2 rounded-full bg-charcoal px-5 py-2 text-xs font-medium text-warm-white hover:bg-charcoal/85 transition-colors"
            >
              Go to Privacy & Data Settings
            </Link>
          </div>
        )}
      </div>
    </div>
  );

  // If inside active app session
  if (user) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 px-4 py-6 sm:px-10 sm:py-10 pb-28 md:pb-10 max-w-4xl">
          {privacyContent}
        </main>
        <MobileNav />
      </div>
    );
  }

  // Public layout
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
        {privacyContent}
      </main>
    </div>
  );
}
