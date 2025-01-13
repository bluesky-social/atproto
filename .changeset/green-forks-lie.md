---
"@atproto/api": minor
---

Helper functions (e.g. `NS.isRecord`) no longer casts the output value. Use the new `NS.isValidRecord` function to ensure an unknown input is a valid `NS.Record`. The `isX` helper function's purpose is to discriminate between `$type`d values from unions.
