import { useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Tracks whether the current user has seen the first-login onboarding flow.
 *
 * Storage: localStorage, key `pn_onboarded_<userId>`.
 * - Per-account: a second account on the same device sees onboarding independently.
 * - Persists across refresh, logout, and login — once marked complete it never
 *   reappears for that account.
 * - No server round-trip needed: the flag is UI-only state.
 */
export function useOnboarding(): {
  /** True only when the current user has NOT yet completed onboarding. */
  shouldShow: boolean;
  /** Call this when the user taps "Continue". Persists immediately. */
  markComplete: () => void;
} {
  const { user } = useAuth();

  // Derive a stable storage key — null when there is no authenticated user.
  // All hook calls must happen unconditionally before any early return.
  const storageKey = user ? `pn_onboarded_${user.id}` : null;
  const alreadySeen = storageKey ? localStorage.getItem(storageKey) === "1" : true;

  const markComplete = useCallback(() => {
    if (storageKey) localStorage.setItem(storageKey, "1");
  }, [storageKey]);

  return { shouldShow: !alreadySeen, markComplete };
}
