# @atproto/did — DID parsing + verification

Low-level DID handling: parse `did:plc:...` / `did:web:...`, validate format, extract method-specific parts. Doesn't resolve to a document — for that you need `@atproto/identity`.

## When to touch

- Adding support for a new DID method (rare)
- Tightening validation (with tests)
