# @atproto/identity — DID + handle resolution

Resolves atproto identities. Given a handle (`alice.wsocial.eu`) returns the DID. Given a DID returns the DID document and the PDS endpoint. Used everywhere we need to look up where a user's data lives.

## Resolvers

- **HandleResolver** — DNS TXT (`_atproto.<handle>`) + HTTP `/.well-known/atproto-did`
- **DidResolver** — `did:plc` (via PLC directory) + `did:web` (via HTTPS)

## Caching

Production callers should pass an `IdentitiesCache` (e.g. `simple-store-redis`) — without it every resolution hits the network.

## See also

- `packages/internal/handle-resolver/` and `packages/internal/handle-resolver-node/` for the lower-level handle resolution
- `packages/internal/identity-resolver/` for the unified resolver
- `.claude/docs/atproto/did-and-identity.md`
