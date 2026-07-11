import { getPocketNumberConfig } from "./settings";

export interface NormalizedPhone {
  /** Canonical new-format representation, e.g. "+967 76XXXXXXX". */
  canonical: string;
  /** Just the local digits (without country code), e.g. "76XXXXXXX". */
  local: string;
}

/**
 * Normalizes a user-entered phone number into the forms needed to match it
 * against Pocket Number accounts, accepting (spaces/dashes ignored):
 *   +<countryCode><local>   e.g. "+967 76-XXX-XXXX"
 *   <countryCode><local>    e.g. "967 76XXXXXXX"
 *   <local>                 e.g. "76XXXXXXX"
 *
 * Country code comes from the Admin-configurable Pocket Number settings
 * (default "+967"), not hardcoded. Returns null when the input doesn't look
 * like a plausible phone number.
 */
export async function normalizePhoneNumber(raw: string): Promise<NormalizedPhone | null> {
  if (typeof raw !== "string") return null;

  // Ignore spaces and dashes; everything else must be digits with an
  // optional leading '+'.
  const cleaned = raw.replace(/[\s-]/g, "");
  if (!/^\+?\d+$/.test(cleaned)) return null;

  const { countryCode } = await getPocketNumberConfig();
  const ccDigits = countryCode.replace(/\D/g, "");

  let digits = cleaned.startsWith("+") ? cleaned.slice(1) : cleaned;

  let local: string;
  if (digits.startsWith(ccDigits) && digits.length > ccDigits.length) {
    // "+967 76XXXXXXX" or "967 76XXXXXXX"
    local = digits.slice(ccDigits.length);
  } else {
    // Local-only, e.g. "76XXXXXXX"
    local = digits;
  }

  // Basic sanity check on local number length (covers old 9-digit prefixes
  // like 71/73/77/700 and the current 76-prefix scheme, with headroom for
  // future admin-configured prefix/suffix lengths).
  if (local.length < 7 || local.length > 10) return null;

  return {
    canonical: `+${ccDigits} ${local}`,
    local,
  };
}
