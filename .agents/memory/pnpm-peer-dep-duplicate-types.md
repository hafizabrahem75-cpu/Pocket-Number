---
name: pnpm peer-dependency duplicate type instances
description: Adding a package with an optional peer dep (e.g. firebase-admin -> @opentelemetry/api) to one workspace member can silently duplicate a shared lib's types elsewhere, breaking cross-package TS assignability.
---

Adding a new dependency to one pnpm workspace package can newly satisfy an
**optional peer dependency** of a shared lib (e.g. `drizzle-orm`'s optional
peer on `@opentelemetry/api`), which makes pnpm create a second virtual
instance of that shared lib scoped to the consuming package. TypeScript then
sees two structurally-identical-but-nominally-different copies of the same
types (e.g. `Column`, `Table`), causing "no overload matches" / "private
property mismatch" errors in files that mix the shared lib's types (via a
workspace package like `@workspace/db`) with the same shared lib imported
directly.

**Why:** pnpm resolves each optional peer dependency per dependency-graph
context. `@google-cloud/firestore` (pulled in by `firebase-admin`) depends
directly on `@opentelemetry/api`; once that's present in a package's tree,
`drizzle-orm`'s optional peer on it becomes satisfied there, creating a
second `drizzle-orm@<version>(@opentelemetry/api@...)` virtual copy distinct
from the one used by the lib package that doesn't have that peer available.

**How to apply:** if adding a package introduces new TS errors that look
like "Property 'config' is protected but type ... is not a class derived
from ..." or "Types have separate declarations of a private property"
between a workspace lib and the same package imported directly — suspect a
duplicated peer-triggered instance, not a real type bug. Fix by adding the
newly-available optional peer (e.g. `@opentelemetry/api`) as an explicit
`devDependency` at the same version in the shared lib's own `package.json`
too, then reinstall — this makes both consumption sites resolve to the same
single virtual instance. Verify with `ls node_modules/.pnpm | grep <lib>@`
before/after — duplicate directories for the same lib+version is the tell.
