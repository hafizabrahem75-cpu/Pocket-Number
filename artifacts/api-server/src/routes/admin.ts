import { Router, type IRouter } from "express";
import {
  POCKET_NUMBER_COUNTRY_CODE_KEY,
  POCKET_NUMBER_PREFIX_KEY,
} from "@workspace/db";
import { getPocketNumberConfig, setSetting } from "../lib/settings";

const router: IRouter = Router();

/**
 * Minimal Admin-only guard: requires the `x-admin-secret` header to match
 * the ADMIN_SECRET environment secret. This is a placeholder until a full
 * Admin auth system exists — it only protects the settings endpoints below.
 */
function requireAdmin(req: any, res: any, next: any): void {
  const provided = req.header("x-admin-secret");
  const expected = process.env["ADMIN_SECRET"];
  if (!expected || !provided || provided !== expected) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

// GET /admin/settings/pocket-number — current country code + prefix
router.get("/admin/settings/pocket-number", requireAdmin, async (_req, res): Promise<void> => {
  const config = await getPocketNumberConfig();
  res.json(config);
});

// PATCH /admin/settings/pocket-number — update country code and/or prefix.
// Only affects pocket numbers generated after this change; existing users
// keep their current numbers.
router.patch("/admin/settings/pocket-number", requireAdmin, async (req, res): Promise<void> => {
  const { countryCode, prefix } = req.body ?? {};

  if (countryCode !== undefined) {
    if (typeof countryCode !== "string" || !/^\+\d{1,4}$/.test(countryCode.trim())) {
      res.status(400).json({ error: "countryCode must look like '+967'" });
      return;
    }
    await setSetting(POCKET_NUMBER_COUNTRY_CODE_KEY, countryCode.trim());
  }

  if (prefix !== undefined) {
    if (typeof prefix !== "string" || !/^\d{1,4}$/.test(prefix.trim())) {
      res.status(400).json({ error: "prefix must be 1-4 digits" });
      return;
    }
    await setSetting(POCKET_NUMBER_PREFIX_KEY, prefix.trim());
  }

  const config = await getPocketNumberConfig();
  res.json(config);
});

export default router;
