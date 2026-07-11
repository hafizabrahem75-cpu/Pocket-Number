---
name: Pocket Number artifact registration gap
description: Why manual workflows were used instead of artifact-managed ones for this project's frontend/API.
---

`artifacts/pocket-number` and `artifacts/api-server` have valid `.replit-artifact/artifact.toml` files, but after a GitHub re-import the platform's artifact registry was empty (`listArtifacts()` returned `[]`) and `createArtifact()` refused to re-register them (`ARTIFACT_DIR_EXISTS`).

**Why:** there is currently no callback to re-register a pre-existing `artifacts/<slug>` directory — `createArtifact` only bootstraps fresh slugs.

**How to apply:** as a workaround, manual workflows were configured directly with `configureWorkflow` (inline `PORT`/`BASE_PATH` env vars in the command string, since `configureWorkflow` has no env param) instead of the artifact-managed workflow names. This gets the app running for dev/preview, but production build/deploy config in the `artifact.toml` and artifact-aware tooling (e.g. Screenshot's `appPreview` source) won't work until the artifacts are properly re-registered. See task "Make the app deployable and previewable properly" for the follow-up.
