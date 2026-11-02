"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, X, Sparkles, Mail, KeyRound, ArrowLeft } from "lucide-react";
import { createClient, signInWithGithub } from "@/lib/supabase/client";
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

interface InPageAuthModalProps {
  open: boolean;
  onClose: () => void;
  featureName?: string;
  onSuccess?: () => void;
}

export function InPageAuthModal({
  open,
  onClose,
  featureName = "this feature",
  onSuccess,
}: InPageAuthModalProps) {
  const [authMethod, setAuthMethod] = useState<"otp" | "password" | "signup">("otp");
  const [otpStep, setOtpStep] = useState<"enter_email" | "enter_code">("enter_email");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demoHint, setDemoHint] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  if (!open) return null;

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

      if (error) throw error;

      setOtpStep("enter_code");
      if ((data as any)?.demoCode) {
        setDemoHint(`Demo OTP Code: ${(data as any).demoCode}`);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to send verification code");
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

      if (error) throw error;

      onClose();
      if (onSuccess) {
        onSuccess();
      } else {
        router.refresh();
      }
    } catch (err: any) {
      setError(err?.message || "Invalid or expired verification code");
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (authMethod === "password") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name: name || email.split("@")[0] } },
        });
        if (error) throw error;
      }

      onClose();
      if (onSuccess) {
        onSuccess();
      } else {
        router.refresh();
      }
    } catch (err: any) {
      setError(err?.message || "Authentication failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleQuickDemoSignIn() {
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: "demo@mindcare.app",
        password: "demo-password",
      });
      if (error) throw error;
      onClose();
      if (onSuccess) {
        onSuccess();
      } else {
        router.refresh();
      }
    } catch (err: any) {
      setError(err?.message || "Sign in failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/40 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-3xl border border-charcoal/10 bg-warm-white p-7 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-5 top-5 rounded-full p-1.5 text-soft-gray hover:bg-cream hover:text-charcoal"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sage/20 text-deep-sage">
            <Lock size={18} />
          </span>
          <div>
            <h2 className="font-serif text-xl text-charcoal">
              Unlock {featureName}
            </h2>
            <p className="text-xs text-soft-gray">
              {authMethod === "otp" && otpStep === "enter_code"
                ? `Enter the 6-digit code sent to ${email}`
                : "Safe, private, encrypted conversations."}
            </p>
          </div>
        </div>

        {/* Primary GitHub Quick Unlock */}
        <div className="mt-5 space-y-2">
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              signInWithGithub(undefined, typeof window !== "undefined" ? window.location.pathname : "/dashboard");
            }}
            disabled={loading}
            className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-charcoal px-4 py-2.5 text-xs font-medium text-warm-white transition-all hover:bg-charcoal/90 active:scale-[0.99] shadow-xs"
          >
            <GithubIcon className="h-4 w-4" />
            <span>Continue with GitHub to Unlock</span>
          </button>
        </div>

        <div className="relative my-4 flex items-center justify-center">
          <div className="w-full border-t border-charcoal/[0.08]" />
          <span className="absolute bg-warm-white px-2.5 text-[10px] uppercase tracking-wider text-soft-gray">
            or email sign in
          </span>
        </div>

        {/* Tab switch */}
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
            Email OTP Code
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
          <button
            type="button"
            onClick={() => {
              setAuthMethod("signup");
              setError(null);
            }}
            className={`flex-1 rounded-lg py-1.5 font-medium transition-all ${
              authMethod === "signup"
                ? "bg-warm-white text-charcoal shadow-xs"
                : "text-soft-gray hover:text-charcoal"
            }`}
          >
            New Account
          </button>
        </div>

        {/* Form Body */}
        {authMethod === "otp" ? (
          otpStep === "enter_email" ? (
            <form onSubmit={handleSendOtp} className="mt-4 space-y-3.5">
              <div>
                <label className="mb-1 block text-xs text-soft-gray">Email Address</label>
                <Input
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              {error && <p className="text-xs text-dusty-rose">{error}</p>}

              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Sending verification code…" : "Send 6-Digit Verification Code"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="mt-4 space-y-3.5">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs text-soft-gray">6-Digit Verification Code</label>
                  <button
                    type="button"
                    onClick={() => setOtpStep("enter_email")}
                    className="text-[11px] text-deep-sage hover:underline inline-flex items-center gap-1"
                  >
                    <ArrowLeft size={11} /> Change email
                  </button>
                </div>
                <Input
                  type="text"
                  required
                  maxLength={6}
                  placeholder="123456"
                  className="text-center font-mono tracking-widest text-lg font-bold"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                />
              </div>

              {demoHint && (
                <div className="rounded-xl border border-sage/40 bg-sage/10 p-2.5 text-center text-xs text-deep-sage font-medium">
                  {demoHint}
                </div>
              )}

              {error && <p className="text-xs text-dusty-rose">{error}</p>}

              <Button type="submit" disabled={loading || otpCode.length < 6} className="w-full">
                {loading ? "Verifying…" : "Verify Code & Start Talking"}
              </Button>
            </form>
          )
        ) : (
          <form onSubmit={handlePasswordSubmit} className="mt-4 space-y-3.5">
            {authMethod === "signup" && (
              <div>
                <label className="mb-1 block text-xs text-soft-gray">Name</label>
                <Input
                  required
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs text-soft-gray">Email</label>
              <Input
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-soft-gray">Password</label>
              <Input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && <p className="text-xs text-dusty-rose">{error}</p>}

            <Button type="submit" disabled={loading} className="w-full">
              {loading
                ? "Connecting…"
                : authMethod === "password"
                ? "Sign in to continue"
                : "Create account & unlock"}
            </Button>
          </form>
        )}

        {/* 1-Click Demo Login for quick testing */}
        <div className="mt-4 border-t border-charcoal/[0.08] pt-4">
          <button
            type="button"
            onClick={handleQuickDemoSignIn}
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-sage/40 bg-sage/10 px-3 py-2 text-xs font-medium text-deep-sage transition-all hover:bg-sage/20"
          >
            <Sparkles size={14} />
            <span>1-Click Instant Demo Login</span>
          </button>
        </div>

        <div className="mt-3 text-center">
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-soft-gray hover:text-charcoal underline"
          >
            Continue previewing in guest mode
          </button>
        </div>
      </div>
    </div>
  );
}
