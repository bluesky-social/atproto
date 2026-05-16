---
'@atproto/lex-cli': minor
---

**BREAKING:** Generated lexicon code now uses `.js` extensions on relative imports (e.g. `from '../lexicons.js'` instead of `from '../lexicons'`), enabling compatibility with Node16/NodeNext module resolution under ESM. Consumers using classic `node` or `bundler` resolution should be unaffected.

