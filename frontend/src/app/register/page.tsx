"use client";

import { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Compass } from "lucide-react";
import { createClient, setGuestSession, signInWithGithub } from "@/lib/supabase/client";
import { BackButton } from "@/components/navigation/BackButton";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

function GithubIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  );
}

function RegisterForm() {
  const [authMethod, setAuthMethod] = useState<"otp" | "password">("otp");
  const [otpStep, setOtpStep] = useState<"enter_email" | "enter_code">("enter_email");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [githubHandle, setGithubHandle] = useState("");
  const [showGithubInput, setShowGithubInput] = useState(false);
  const [demoHint, setDemoHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [githubLoading, setGithubLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const next = searchParams.get("next") || "/dashboard";
  const instantGithubParam = searchParams.get("instant_github") === "1";

  useEffect(() => {
    if (instantGithubParam) {
      setShowGithubInput(true);
    }
  }, [instantGithubParam]);

  function handleGithubContinue() {
    setGithubLoading(true);
    setError(null);
    signInWithGithub(undefined, next);
  }

  function handleGithubHandleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const handle = githubHandle.trim();
    if (!handle) return;
    setGithubLoading(true);
    setError(null);
    signInWithGithub(handle, next);
  }

  async function handleGuestExplore() {
    setGuestLoading(true);
    setError(null);
    try {
      setGuestSession();
      fetch("/api/auth/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "guest@mindcare.app", is_guest: true }),
      }).catch(() => {});
      router.push("/dashboard");
      router.refresh();
    } catch {
      router.push("/dashboard");
    }
  }

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setDemoHint(null);

    try {
      const { data, error } = await supabase.auth.signInWithOtp({
        email,
        options: { data: { name: name || email.split("@")[0] } },
      });

      if (error) {
        const res = await fetch("/api/auth/demo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "send_otp", email, name: name || email.split("@")[0] }),
        }).catch(() => null);
        const fallbackData = await res?.json().catch(() => null);
        if (fallbackData?.ok) {
          setOtpStep("enter_code");
          setDemoHint(`Demo OTP Code: ${fallbackData.demoCode || "123456"}`);
          return;
        }
        throw error;
      }

      setOtpStep("enter_code");
      if ((data as any)?.demoCode) {
        setDemoHint(`Demo OTP Code: ${(data as any).demoCode}`);
      }
    } catch (err: any) {
      try {
        const res = await fetch("/api/auth/demo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "send_otp", email, name: name || email.split("@")[0] }),
        });
        const fallbackData = await res.json();
        if (fallbackData?.ok) {
          setOtpStep("enter_code");
          setDemoHint(`Demo OTP Code: ${fallbackData.demoCode || "123456"}`);
          return;
        }
      } catch {}
      setError(err?.message || "Failed to send verification code. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otpCode,
        type: "email",
      });

      if (error) {
        const res = await fetch("/api/auth/demo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "verify_otp", email, token: otpCode, type: "email" }),
        }).catch(() => null);
        const fallbackData = await res?.json().catch(() => null);
        if (fallbackData?.user) {
          router.push(next);
          router.refresh();
          return;
        }
        throw error;
      }

      router.push(next);
      router.refresh();
    } catch (err: any) {
      try {
        const res = await fetch("/api/auth/demo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "verify_otp", email, token: otpCode, type: "email" }),
        });
        const fallbackData = await res.json();
        if (fallbackData?.user) {
          router.push(next);
          router.refresh();
          return;
        }
      } catch {}
      setError(err?.message || "Invalid or expired verification code.");
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name } },
      });

      if (error) {
        const res = await fetch("/api/auth/demo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, name, is_guest: false }),
        }).catch(() => null);
        const fallbackData = await res?.json().catch(() => null);
        if (fallbackData?.user) {
          router.push(next);
          router.refresh();
          return;
        }
        setError(error.message);
        setLoading(false);
        return;
      }

      if (data?.user) {
        await supabase.from("profiles").insert({
          user_id: data.user.id,
          name,
          email,
          preferred_language: "en",
        }).catch(() => {});
      }

      router.push(next);
      router.refresh();
    } catch (err: any) {
      const res = await fetch("/api/auth/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, is_guest: false }),
      }).catch(() => null);
      const fallbackData = await res?.json().catch(() => null);
      if (fallbackData?.user) {
        router.push(next);
        router.refresh();
        return;
      }
      setError(err?.message || "Sign up failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-cream px-6 py-12">
      <div className="w-full max-w-sm rounded-3xl border border-charcoal/[0.08] bg-warm-white p-8 shadow-sm">
        <div className="mb-4">
          <BackButton fallbackHref="/" label="Back" />
        </div>

        <h1 className="font-serif text-2xl text-charcoal">Create your space</h1>
        <p className="mt-1 text-sm text-soft-gray">
          {authMethod === "otp" && otpStep === "enter_code"
            ? `Enter the 6-digit code sent to ${email}`
            : "Sign up with GitHub or email to get started."}
        </p>

        {/* Primary GitHub Sign Up */}
        <div className="mt-6 space-y-2.5">
          <button
            type="button"
            onClick={handleGithubContinue}
            disabled={githubLoading || loading || guestLoading}
            className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-charcoal px-4 py-3 text-sm font-medium text-warm-white transition-all hover:bg-charcoal/90 active:scale-[0.99] shadow-xs"
          >
            <GithubIcon className="h-4 w-4" />
            <span>{githubLoading ? "Connecting to GitHub…" : "Sign up with GitHub"}</span>
          </button>

          <div className="text-center">
            <button
              type="button"
              onClick={() => setShowGithubInput(!showGithubInput)}
              className="text-xs text-soft-gray hover:text-charcoal underline"
            >
              {showGithubInput ? "Hide handle input" : "Instant GitHub connect (Zero-config)"}
            </button>
          </div>

          {showGithubInput && (
            <form onSubmit={handleGithubHandleSubmit} className="rounded-2xl border border-charcoal/10 bg-cream/50 p-3 space-y-2.5">
              <label className="block text-[11px] font-medium text-soft-gray">
                Enter your GitHub username:
              </label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="@username"
                  value={githubHandle}
                  onChange={(e) => setGithubHandle(e.target.value)}
                  className="text-xs"
                  required
                />
                <Button type="submit" disabled={githubLoading || !githubHandle.trim()} className="shrink-0 text-xs px-3">
                  Connect
                </Button>
              </div>
              <p className="text-[10px] text-soft-gray">
                Fetches your public GitHub profile and creates an instant session.
              </p>
            </form>
          )}
        </div>

        {/* Divider */}
        <div className="relative my-5 flex items-center justify-center">
          <div className="w-full border-t border-charcoal/[0.08]" />
          <span className="absolute bg-warm-white px-3 text-[11px] uppercase tracking-wider text-soft-gray">
            or email options
          </span>
        </div>

        {/* Tab switch between OTP & Password */}
        <div className="flex rounded-xl bg-cream/70 p-1 text-xs">
          <button
            type="button"
            onClick={() => {
              setAuthMethod("otp");
              setOtpStep("enter_email");
              setError(null);
            }}
            className={`flex-1 rounded-lg py-1.5 font-medium transition-all ${
              authMethod === "otp"
                ? "bg-warm-white text-charcoal shadow-xs"
                : "text-soft-gray hover:text-charcoal"
            }`}
          >
            Email OTP
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthMethod("password");
              setError(null);
            }}
            className={`flex-1 rounded-lg py-1.5 font-medium transition-all ${
              authMethod === "password"
                ? "bg-warm-white text-charcoal shadow-xs"
                : "text-soft-gray hover:text-charcoal"
            }`}
          >
            Password
          </button>
        </div>

        {authMethod === "otp" ? (
          otpStep === "enter_email" ? (
            <form onSubmit={handleSendOtp} className="mt-4 space-y-4">
              <div>
                <label htmlFor="otp-name" className="mb-1 block text-xs text-soft-gray">
                  Name
                </label>
                <Input
                  id="otp-name"
                  required
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="otp-email" className="mb-1 block text-xs text-soft-gray">
                  Email
                </label>
                <Input
                  id="otp-email"
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              {error && <p className="text-sm text-dusty-rose">{error}</p>}

              <Button type="submit" disabled={loading || guestLoading || githubLoading} className="w-full">
                {loading ? "Sending code…" : "Send 6-Digit OTP Code"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="mt-4 space-y-4">
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label htmlFor="otp-code" className="block text-xs text-soft-gray">
                    Verification Code
                  </label>
                  <button
                    type="button"
                    onClick={() => setOtpStep("enter_email")}
                    className="text-[11px] text-deep-sage underline"
                  >
                    Change email
                  </button>
                </div>
                <Input
                  id="otp-code"
                  type="text"
                  required
                  maxLength={6}
                  placeholder="123456"
                  className="text-center font-mono text-lg font-bold tracking-widest"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                />
              </div>

              {demoHint && (
                <div className="rounded-xl border border-sage/40 bg-sage/10 p-2.5 text-center text-xs font-medium text-deep-sage">
                  {demoHint}
                </div>
              )}

              {error && <p className="text-sm text-dusty-rose">{error}</p>}

              <Button
                type="submit"
                disabled={loading || otpCode.length < 6 || githubLoading}
                className="w-full"
              >
                {loading ? "Verifying…" : "Verify & Complete Signup"}
              </Button>
            </form>
          )
        ) : (
          <form onSubmit={handlePasswordSubmit} className="mt-4 space-y-4">
            <div>
              <label htmlFor="name" className="mb-1 block text-xs text-soft-gray">
                Name
              </label>
              <Input
                id="name"
                required
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="email" className="mb-1 block text-xs text-soft-gray">
                Email
              </label>
              <Input
                id="email"
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="mb-1 block text-xs text-soft-gray">
                Password
              </label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && <p className="text-sm text-dusty-rose">{error}</p>}

            <Button type="submit" disabled={loading || guestLoading || githubLoading} className="w-full">
              {loading ? "Creating account…" : "Create Account & Start Talking"}
            </Button>
          </form>
        )}

        <div className="relative my-5 flex items-center justify-center">
          <div className="w-full border-t border-charcoal/[0.08]" />
          <span className="absolute bg-warm-white px-3 text-[11px] uppercase tracking-wider text-soft-gray">
            or preview first
          </span>
        </div>

        {/* Explore as Guest */}
        <button
          type="button"
          onClick={handleGuestExplore}
          disabled={guestLoading || loading || githubLoading}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-charcoal/10 bg-cream/70 px-4 py-2.5 text-xs font-medium text-charcoal transition-all hover:bg-cream hover:border-charcoal/20"
        >
          <Compass size={14} className="text-deep-sage" />
          {guestLoading ? "Entering guest mode…" : "Explore as a Guest"}
        </button>

        <p className="mt-5 text-center text-xs text-soft-gray">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-charcoal underline">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}
