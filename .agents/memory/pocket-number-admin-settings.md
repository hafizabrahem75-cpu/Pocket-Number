---
name: Pocket Number admin-configurable settings
description: How pocket number country code/prefix are stored and made Admin-configurable, and the TS project-reference gotcha hit while adding them.
---

Pocket Number generation reads its country code and local prefix from a
generic `app_settings` key/value table (`lib/db/src/schema/settings.ts`)
instead of hardcoding them, so they can be changed later without a deploy.
Defaults (`+967` / `76`) are used when no row exists yet.

A minimal `x-admin-secret` header (checked against the `ADMIN_SECRET` env
secret) guards `GET/PATCH /api/admin/settings/pocket-number` until a real
Admin auth system exists — treat this as a placeholder, not a final design.

**Why:** the project doesn't have any Admin/role system yet; a full auth
build was out of scope for a numbering-format change, so a secret-header
guard was the minimal reasonable stopgap.

**Gotcha:** `@workspace/db`'s consumers resolve types through TS project
references (`tsc --build`), which read the package's compiled `dist/*.d.ts`,
not `src/` directly. After adding new exports to `lib/db/src/schema/*.ts`,
run `npx tsc --build lib/db` (or `pnpm -w exec tsc --build lib/db`) before
typechecking dependents — otherwise you'll see false "has no exported
member" errors even though the source is correct.
