---
"@atproto/api": minor
---

Helper functions (e.g. `NS.isRecord`) no longer casts the output value. Use `asPredicate(NS.validateRecord)` to create a predicate function that will ensure that an unknown value is indeed an `NS.Record`. The `isX` helper function's purpose is to discriminate between `$type`d values from unions.
