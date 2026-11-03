# Needed code changes

## Require `did#serviceId` for `managingApp`

The `com.atproto.managedspace.policy` lexicon now describes `managingApp` as a `did#serviceId` reference, but the PDS still accepts a bare DID.

- `packages/pds/src/space-policy/policy.ts` (`normalizePolicy`): only checks `startsWith('did:')`. Validate with `isAtprotoDidRefAbsolute` from `@atproto/did` instead.
- `packages/pds/src/api/com/atproto/space/util.ts` (`resolveServiceEndpoint`): falls back to the DID's `#atproto_pds` endpoint when there's no fragment. That doesn't make sense for a managing app.
- `packages/pds/tests/space/policy.test.ts`: add a bare DID (eg, `did:web:example.com`) to the "refuses a managingApp that does not name a service" test.
- `alpha-migrations/prompt-10-29-26.md` (section 1f): says "Require `managingApp` to be a DID with an optional service fragment." Update to match.

Open question: `com.atproto.space.registerNotify`'s `service` field goes through the same resolver and also accepts a bare DID. Decide whether it should require `did#serviceId` too.
