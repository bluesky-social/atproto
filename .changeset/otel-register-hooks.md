---
'@atproto-labs/opentelemetry-node': minor
'@atproto/pds': patch
'@atproto/ozone': patch
---

Register the import-in-the-middle ESM loader hook in-thread with `module.registerHooks()` instead of the deprecated `module.register()` (DEP0205), and update `@opentelemetry/*` dependencies. `@atproto-labs/opentelemetry-node` now requires Node.js `^22.22.3 || ^24.11.1 || >=25.1.0`.
