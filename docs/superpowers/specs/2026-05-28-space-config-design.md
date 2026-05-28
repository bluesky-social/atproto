# Space Config: App Coordination & Access

## Overview

This spec covers the per-space configuration that the space owner's PDS holds
to fulfill the protocol's app-coordination contract. It is a small,
deliberately boring surface: four fields, none of which the PDS interprets
semantically. The PDS is opaque routing infrastructure; governance lives in
the application layer (and is reachable via the managing app); host policy
lives below.

Out of scope: managing-app implementation, OAuth scope shapes for config
mutation, member-list semantics (covered elsewhere), credential mint
mechanics beyond "is this caller allowed to mint?".

### Background

Two protocol-level requirements drive this config:

1. **Generic governance routing.** The protocol's only ACL is the member
   list. Every interesting governance concept — invites, join requests,
   approval flows, paid tiers, moderation rules — lives in an application.
   A user on a different client needs a way to discover *which* application
   manages a given space without the PDS understanding any of those
   concepts. This is the "managing app" contract from the Big Picture doc.

2. **App-level access perimeter.** Spaces are configurable as default-allow
   (any app may sync, with optional denylist) or default-deny (only
   explicitly listed apps may sync). The PDS is the party that actually
   refuses or grants based on this, since it mints space credentials.

Public spaces — spaces with no read perimeter, where any caller can mint a
credential — are also covered here. They reuse the same credential-mint
gate, just with the member-list check bypassed.

### Standardization posture

These fields are **semi-standardized, not prescriptive**. The protocol
defines their shape and meaning so that clients can speak about them across
hosts, but it does not require every space host to implement all of them.

Concretely:

- On wire-level lexicons that surface space details (e.g. a `getSpace`
  view), every field except `isPublic` is **optional**, with no default.
  Hosts that don't implement a given field simply omit it. Clients must
  treat omission as "the host doesn't surface this," not as a default.
- On our PDS implementation, all four fields are present and persisted.
  We default `isPublic` to `false`, `appAccessMode` to `"allow"`, and
  `appExceptions` to empty. `managingApp` defaults to empty (unset).
- `isPublic` is the one exception: it has a meaningful default (`false`)
  on the wire, because the absence of an explicit "this space is public"
  signal must default to "not public."

This split lets alternate space hosts choose their own posture (e.g. a
host that only does private spaces and doesn't care about app perimeters)
without breaking the wire contract.

---

## Config fields

Four fields, all per-space, all mutable by the space owner.

| Field            | Type                         | PDS default | Wire optional? | Description                                                                                                  |
| ---------------- | ---------------------------- | ----------- | -------------- | ------------------------------------------------------------------------------------------------------------ |
| `managingApp`    | `string` (did + service id)  | unset       | optional       | Service identifier (e.g. `did:web:atmoboards.com#forum`) of the application that handles governance for this space. |
| `isPublic`       | `boolean`                    | `false`     | required (default `false`) | If true, the credential mint is open to anyone; the member list is bypassed for read/sync access.            |
| `appAccessMode`  | `string` (knownValues)       | `"allow"`   | optional       | `"allow"` (default-allow with denylist) or `"deny"` (default-deny with allowlist). Open string for forward compatibility. |
| `appExceptions`  | `string[]` (client IDs)      | `[]`        | optional       | Apps that break from the default. Functions as denylist when `appAccessMode == "allow"`, allowlist when `appAccessMode == "deny"`. |

### Field details

#### `managingApp`

A DID with a service ID (e.g. `did:web:atmoboards.com#forum`), not an OAuth
client ID. This intentionally targets a *service* in the network rather
than a specific OAuth client — the managing app is something callers send
signed service-auth requests to, not something they OAuth into.

The PDS does not validate or interpret the value beyond storing and
returning it. It does not resolve the DID, does not check the service ID
exists in the DID doc, does not enforce any contract on the service's
behavior. Members resolve and call it themselves using standard atproto
service-auth.

When unset, `getSpace` simply omits the field. Clients treat omission as
"no managing app is configured."

#### `isPublic`

Boolean. When `true`:

- The PDS bypasses the member-list check at credential mint. Any caller
  can request a credential for the space and receive one.
- The member list is dormant — still maintained, still synced like any
  other space data, but not consulted for sync access. It can be repopulated
  or kept up to date if the owner anticipates flipping back to private.
- App-level restrictions (`appAccessMode` + `appExceptions`) still apply.
  A space can be publicly readable but only sync-able by certain apps.

When `false` (the default), the member list is the read/sync perimeter as
specified elsewhere.

#### `appAccessMode` + `appExceptions`

These two work together as the app-level access policy.

- `"allow"` mode: any client ID may mint a credential, *unless* it appears
  in `appExceptions`. This is the natural default — supports atmospheric
  interop.
- `"deny"` mode: a client ID may mint a credential *only* if it appears
  in `appExceptions`. For tighter perimeters (workplace, paid memberships,
  spaces with strict content rules).

`appAccessMode` is a string with `knownValues = ["allow", "deny"]` rather
than a boolean. This leaves room for alternative space hosts to introduce
additional modes (e.g. `"closed"`, `"invite-only"`) without breaking the
wire format.

`appExceptions` is a flat list of client IDs (atproto OAuth client ID
URLs). The PDS performs a membership check at credential mint time and
either issues or refuses based on the combination of `appAccessMode` and
this list. Order is irrelevant.

---

## What the PDS does with this config

Two surfaces, both narrow.

### 1. Credential mint gate

At `getSpaceCredential` time, the PDS checks (in order):

1. **Read perimeter.** If `isPublic == false`, verify the caller's
   member-grant token resolves to a member of the space. If
   `isPublic == true`, skip this check.
2. **App perimeter.** Look up the requesting client ID. Refuse if:
   - `appAccessMode == "allow"` and the client ID is in `appExceptions`, or
   - `appAccessMode == "deny"` and the client ID is *not* in `appExceptions`.

Both gates apply independently. A public space with `appAccessMode == "deny"`
and a small `appExceptions` list is a coherent and supported configuration:
"anyone can read, but only these apps can sync."

### 2. Surfacing config to clients

Config is exposed via the existing `getSpace` view; no dedicated getter is
introduced. Clients that want to discover the managing app, the access
mode, etc. read them off the `getSpace` response. Fields the host doesn't
implement are simply absent.

---

## Mutation surface

A single update endpoint, owner-only. Sketched:

```
com.atproto.space.updateSpaceConfig
  in: {
    space: string,
    managingApp?: string,           // empty string clears
    isPublic?: boolean,
    appAccessMode?: string,
    appExceptions?: string[],       // full replacement
  }
  out: {}
```

Design notes:

- Every field is **optional, never nullable.** Omitting a field means
  "leave it unchanged." We avoid the optional-and-nullable pattern.
- To **clear `managingApp`**, pass an empty string. The empty string is the
  sentinel for "unset" and is never a valid DID + service id, so there's no
  ambiguity.
- `appExceptions` is a **full replacement**, not a delta. Callers send the
  full intended list; the PDS overwrites. Keeps the surface simple and
  avoids add/remove primitives at the protocol layer.
- `isPublic` and `appAccessMode` are simple value sets.

`createSpace` already accepts `accessMode` and `managingApp` at create time
(see `lexicons/com/atproto/space/createSpace.json`). That input shape needs
updating to match the field names finalized here (`appAccessMode`,
`managingApp`, plus `isPublic` and `appExceptions`).

---

## Storage

All four fields live as columns on the existing `space` table.
`appExceptions` is stored as a JSON-encoded array — it's transmitted that
way at the API boundary and consulted as a single membership check at
credential mint, so a normalized table doesn't earn its keep.

Add to the `space` table:

| Column           | Type              | Notes                                          |
| ---------------- | ----------------- | ---------------------------------------------- |
| `managingApp`    | `varchar` null    | Empty / null when unset                        |
| `isPublic`       | `integer` (bool)  | 0/1, sqlite-style; default 0                   |
| `appAccessMode`  | `varchar`         | Default `'allow'`                              |
| `appExceptions`  | `text` (JSON)     | JSON-encoded `string[]`; default `'[]'`        |

A migration adds the four columns to `space`. `createSpace` populates
initial values from input (or defaults). `updateSpaceConfig` patches them.

---

## What's deliberately *not* here

The bar applied to candidate fields was: **owner-set, PDS just checks or
exposes it, no semantic interpretation.** A few that didn't make the cut:

- **Display metadata** (name, description, avatar): belongs in records
  inside the space, not PDS config. The PDS isn't in the business of
  serving community avatars.
- **Member list visibility**: tempting but redundant. The credential model
  already implies members-only. If a space wants public membership, publish
  a record.
- **Lifecycle status** (active/frozen/archived): considered, deferred. May
  be load-bearing for ownership handoff and end-of-life flows, but not
  needed for v1.
- **Credential lifetime**: a protocol constant, not per-space config. Don't
  let owners footgun themselves.
- **Sync log retention**: host operator policy, not space owner policy.
- **Write notification routing**: per-syncing-service registration, already
  modeled in `space_credential_recipient`.

---

## Open considerations

- **Public credential mint as DDoS surface.** With `isPublic == true`, the
  credential-mint endpoint is unauthenticated. Standard host-operator rate
  limiting concern, not a protocol problem, but worth keeping in mind when
  spec'ing the credential endpoint behavior.
- **`appExceptions` size cap.** No protocol-level cap proposed. Host
  operators may impose one. The separate-table storage means we don't pay
  a deserialization cost as the list grows, but unbounded growth is still
  worth keeping an eye on.
- **Config audit / change log.** Not in scope here. If history of config
  changes matters, that's an above-the-protocol concern (the managing app
  can record it).
