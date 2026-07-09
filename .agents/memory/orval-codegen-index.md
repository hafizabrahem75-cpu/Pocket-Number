---
name: Orval codegen index duplication
description: Orval appends export lines to existing index.ts files rather than replacing them, causing duplicate exports and TS2308 errors.
---

## Rule
Before re-running codegen, delete the generated output directories:
```
rm -rf lib/api-zod/src/generated lib/api-client-react/src/generated
```
Then run `pnpm --filter @workspace/api-spec run codegen`.

**Why:** Orval's `clean: true` only cleans the `generated/` subdirectory, not the hand-written `index.ts` that re-exports from it. On subsequent runs it appends new `export *` lines with single-quote style alongside the existing double-quote ones, creating duplicate exports. TypeScript treats both as active and throws TS2308 when any name is exported twice.

## Also: GET endpoints with path params cause Zod/type name clash
Orval generates `GetXxxParams` as both a Zod schema (in `generated/api.ts`) and a TypeScript type (in `generated/types/`). Both are re-exported from `index.ts`, causing TS2308 on the name.

**Fix:** Use query params instead of path params for GET endpoints that would otherwise have this conflict. For example, use `/messages/conversation?recipientId=X` instead of `/messages/conversation/:recipientId`.
