---
'@atproto/lex-cli': minor
---

**BREAKING:** Generated lexicon code now uses `.js` extensions on relative imports (e.g. `from '../lexicons.js'` instead of `from '../lexicons'`), required for Node16 module resolution under ESM. Consumers of `lex-cli` will need to use `moduleResolution: "node16"` (or equivalent) for the generated code to compile.

