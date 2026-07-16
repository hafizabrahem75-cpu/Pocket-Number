import { useState } from "react";
import { Copy, Share2, ArrowLeft, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useOnboarding } from "@/hooks/useOnboarding";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

/**
 * First-login onboarding bottom sheet.
 *
 * Shown once per account immediately after the user lands on the home shell.
 * The sheet:
 *  1. Welcomes the user by name.
 *  2. Explains briefly what Pocket Number is.
 *  3. Displays the user's pocket number prominently with copy and share actions.
 *  4. Lets the user continue into the app.
 *
 * The backdrop is intentionally not tap-dismissible — the user must see their
 * number and tap "Continue" so they know how to share it.
 *
 * Onboarding state is written to localStorage on dismiss (see useOnboarding).
 */
export function OnboardingSheet() {
  const { user } = useAuth();
  const { shouldShow, markComplete } = useOnboarding();
  const { toast } = useToast();

  // Local "visible" flag drives the exit animation. The sheet starts animating
  // out when the user taps Continue, and is removed from the DOM once the CSS
  // transition finishes (200 ms).
  const [exiting, setExiting] = useState(false);
  const [gone, setGone] = useState(false);

  if (!shouldShow || gone || !user) return null;

  const pocketNumber = user.pocketNumber ?? "—";

  // ── Actions ──────────────────────────────────────────────────────────────

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(pocketNumber);
      toast({ title: "تم النسخ", description: "تم نسخ رقمك الافتراضي" });
    } catch {
      toast({ title: "تعذّر النسخ", variant: "destructive" });
    }
  };

  const handleShare = async () => {
    const text = `رقمي الافتراضي على Pocket Number هو: ${pocketNumber}\nتواصل معي من خلال التطبيق.`;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "Pocket Number", text });
        return;
      } catch {
        // User cancelled the share sheet — no need for an error toast.
        return;
      }
    }
    // Fallback: copy the share text when the Web Share API isn't available
    // (desktop browsers, iframes in dev preview).
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "تم النسخ", description: "نص المشاركة جاهز للصق" });
    } catch {
      toast({ title: "تعذّر المشاركة", variant: "destructive" });
    }
  };

  const handleContinue = () => {
    markComplete();
    setExiting(true);
    // Wait for the slide-out animation before removing from DOM.
    setTimeout(() => setGone(true), 250);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    // Backdrop — full-screen, blocks interaction with the home shell underneath.
    <div
      className={cn(
        "fixed inset-0 z-40 flex items-end justify-center bg-black/50 transition-opacity duration-200",
        exiting ? "opacity-0" : "opacity-100",
      )}
    >
      {/* Sheet panel */}
      <div
        className={cn(
          "w-full max-w-[428px] bg-background rounded-t-3xl shadow-2xl px-6 pt-6 pb-10",
          "transition-transform duration-200 ease-out",
          exiting ? "translate-y-full" : "translate-y-0",
        )}
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-start gap-3 mb-6">
          {/* Celebration icon */}
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
            <Sparkles className="w-6 h-6 text-primary" />
          </div>

          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-black text-foreground leading-snug">
              مرحباً، {user.name.split(" ")[0]} 👋
            </h2>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
              حسابك جاهز. الآن لديك رقم افتراضي خاص بك.
            </p>
          </div>
        </div>

        {/* ── What is Pocket Number ────────────────────────────────────────── */}
        <p className="text-sm text-foreground/80 leading-relaxed mb-6">
          يمكنك تلقّي المكالمات والرسائل عبر رقمك الافتراضي دون الكشف عن رقم هاتفك الحقيقي.
          شارك رقمك مع من تريد حتى يتمكنوا من التواصل معك.
        </p>

        {/* ── Pocket number display ────────────────────────────────────────── */}
        <div className="bg-primary/6 border border-primary/20 rounded-2xl p-5 mb-5">
          <p className="text-xs font-semibold text-muted-foreground mb-2 text-right">
            رقمك الافتراضي الخاص
          </p>
          <p
            className="text-3xl font-black text-primary tracking-widest text-center font-mono"
            dir="ltr"
          >
            {pocketNumber}
          </p>
        </div>

        {/* ── Copy + Share buttons ─────────────────────────────────────────── */}
        <div className="flex gap-3 mb-5">
          <button
            onClick={handleCopy}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-border bg-secondary/40 hover:bg-secondary active:scale-[0.98] transition-all text-sm font-semibold text-foreground"
          >
            <Copy className="w-4 h-4" />
            نسخ الرقم
          </button>

          <button
            onClick={handleShare}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-primary/30 bg-primary/8 hover:bg-primary/14 active:scale-[0.98] transition-all text-sm font-semibold text-primary"
          >
            <Share2 className="w-4 h-4" />
            مشاركة الرقم
          </button>
        </div>

        {/* ── Continue button ──────────────────────────────────────────────── */}
        <button
          onClick={handleContinue}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-primary hover:bg-primary/90 active:scale-[0.98] transition-all text-base font-bold text-primary-foreground shadow-md"
        >
          ابدأ الاستخدام
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
