# @atproto/lexicon-resolver — Resolve lexicons from DIDs

Looks up the lexicon document for a given NSID by resolving the authoritative DID (the namespace owner) and fetching its published lexicon record. Used when a service receives an XRPC call referencing a lexicon it doesn't have locally.

In practice we ship most lexicons in the repo, so this is mainly relevant for third-party namespaces and federated content.

## See also

- `packages/lexicon/` — the runtime that uses what this resolver returns
- `.claude/docs/atproto/lexicons-and-codegen.md`
