# @atproto/lex-space

Read and write [atproto spaces](https://github.com/bluesky-social/proposals/tree/main/0016-permissioned-data) with the `Client` from [`@atproto/lex`](../lex).

Spaces hold data with an access perimeter: personal data (bookmarks, drafts), gated content, private posts, group forums. This package handles the protocol for you: it obtains and renews space credentials, sends each request to the right server, signs it, and verifies what comes back.

```typescript
import { Client } from '@atproto/lex'
import { SpaceClient, listSpaces } from '@atproto/lex-space'
import { com } from './lexicons/index.js'

const client = new Client(oauthSession)
const forum = com.example.forum // the space type's schema

const { spaces } = await client.call(listSpaces, { spaceType: forum.nsid })
const space = SpaceClient.openSpace(forum, spaces[0].space, {
  agent: client.agent,
})

for await (const { repo, collection, record } of space.allRecords()) {
  console.log(repo, collection, record)
}
```

- [Concepts](#concepts)
- [Getting started](#getting-started)
- [Errors and verification](#errors-and-verification)
- [Managing a space](#managing-a-space)
- [Building a sync service](#building-a-sync-service)
- [Configuration](#configuration)
- [Reference](#reference)

## Concepts

- A **space** is identified by its authority, its type and its key, in a URI: `at://{authority}/space/{type}/{skey}` (e.g. `at://did:plc:abc/space/com.example.forum/general`).
- A **space type** is declared by a Lexicon (`"type": "space"`): its key type, an optional title, and the record collections clients should expect in its spaces. Its generated schema (`l.space()`) is required to open, create or read a space.
- The space **authority** is the DID at the root of the space. Its PDS is the **space host**, which decides who may read the space.
- Each account writing to a space holds its own **repo** in it, on its own PDS. The accounts holding a repo in a space form its **writer set**.
- Reading other accounts' repos requires a **space credential**, issued by the space host in exchange for a **delegation token**. The user's PDS mints delegation tokens for apps the user granted access to the space. This package handles both.
- Records read from other accounts' repos are verified against a MAC computed by their host, so a response cannot be forged on the way.

## Getting started

### 1. Install

```bash
npm install @atproto/lex @atproto/lex-space
```

Space types and records are typed with Lexicon schemas: install and build those of the space types and record types you use (see [Lexicon Schemas](../lex/README.md#lexicon-schemas)), or declare them with the `l` builder from `@atproto/lex`.

### 2. Request access to spaces

Access to spaces is granted through `space:` OAuth scopes, by space type and authority. For example:

| Scope                                                  | Grants                                                                                |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| `space:com.example.bookmarks`                          | The user's own bookmarks spaces: read, and write the collections the type declares    |
| `space:com.example.forum?authority=*`                  | Every forum the user is in, under any authority: read, and write declared collections |
| `space:com.example.forum?authority=*&action=read`      | The same forums, read-only                                                            |
| `space:com.example.forum?authority=*&action=read_self` | Only the user's own repo in those forums, read-only                                   |
| `space:*?authority=*&action=read_self`                 | List all of the user's spaces, and read the user's own repo in each                   |

A `read` grant lets the app read every repo in the space. A `read_self` grant only covers the user's own repo: enough to read the user's own data, but not to obtain a space credential.

### 3. List the user's spaces

```typescript
import { listSpaces } from '@atproto/lex-space'

// The spaces the user holds a repo in, or is the authority of
const { spaces, cursor } = await client.call(listSpaces)

// Only the spaces the user is the authority of
const owned = await client.call(listSpaces, { spaceDid: client.did })

// Only the spaces of a given type
const forums = await client.call(listSpaces, {
  spaceType: com.example.forum.nsid,
})
```

### 4. Open a space

```typescript
import { SpaceClient } from '@atproto/lex-space'

// By URI
const space = SpaceClient.openSpace(
  com.example.forum,
  'at://did:plc:abc/space/com.example.forum/general',
  { agent: client.agent },
)

// By authority and key (the key can be left out for space types with a literal key)
const space = SpaceClient.openSpace(
  com.example.forum,
  { authority: 'did:plc:abc', skey: 'general' },
  { agent: client.agent },
)
```

The space must be of the type described by the schema (a `TypeError` is thrown otherwise). Opening a space makes no request. The space credential is obtained when a request first needs it, then cached and renewed shortly before it expires. To check right away that the space grants access, call `authorize()`:

```typescript
await space.authorize() // throws if the space does not grant access (e.g. SpaceNotFound)
```

Each `SpaceClient` obtains its own credential: keep one instance per space, rather than opening the space again for every use.

To create a space instead, with the user as its authority, use `SpaceClient.createSpace()`. It returns the new space, opened:

```typescript
import { SpaceClient, memberspacePolicy } from '@atproto/lex-space'

const space = await SpaceClient.createSpace(client.agent, com.example.forum, {
  skey: 'general', // Defaults to the literal key of the space type, or to a TID
  policy: memberspacePolicy.$build({}),
})
```

### 5. Read and write the user's own records

`SpaceClient` mirrors the record helpers of `Client`. Writes always target the user's own repo, and reads target it unless `repo` is set:

```typescript
import { com } from './lexicons/index.js'

const { uri } = await space.create(com.example.post, { text: 'Hello, space!' })

const { records, cursor } = await space.list(com.example.post)
for (const { rkey, valid, value } of records) {
  if (valid) console.log(rkey, value.text) // typed as com.example.post.Main
}

const post = await space.get(com.example.post, { rkey })
await space.put(com.example.post, { text: 'Edited' }, { rkey })
await space.delete(com.example.post, { rkey })

await space.applyWrites((op) => [
  op.create(com.example.post, { text: 'First' }),
  op.create(com.example.post, { text: 'Second' }),
])
```

Reads and writes of the user's own repo use the user's session, so a `read_self` grant is enough to read it.

These typed methods only accept the collections the space type declares: other record types are rejected at compile time, and throw before any request. Spaces may hold records of any type though: pass `validateRequest: false` to read or write other collections (e.g. with a `collection=*` grant). With `validateRequest: true`, records are also validated against their schema before being written. The lower level methods (`createRecord()`, `putRecord()`, `deleteRecord()`, `applyWrites()`) accept any record, as in `Client`. To restrict your own helpers the same way, use `SpaceCollectionSchema<S, T>` (or `SpaceCollection<S>` for the collection NSIDs).

```typescript
await space.create(app.bsky.feed.post, post, { validateRequest: false })
```

### 6. Read other members' records

Set `repo` to read another account's repo. This requires a `read` grant:

```typescript
// The accounts holding a repo in the space
for await (const { repo } of space.writers()) {
  // Every post of each of them, across pages
  for await (const post of space.listAll(com.example.post, { repo })) {
    if (post.valid) console.log(repo, post.value.text)
  }
}

// A single record, verified against the MAC its host computed
const { value } = await space.get(com.example.post, { repo, rkey })
```

### 7. Read the whole space

`allRecords()` reads every repo of the writer set. Each repo is fetched in full and verified (its commit against its host's MAC, its records against its commit) before its records are yielded:

```typescript
// Every record, flagged with whether its collection is declared by the space type
for await (const {
  repo,
  collection,
  rkey,
  valid,
  record,
} of space.allRecords()) {
  if (valid) record // of a declared collection (not validated)
}

// The records of some collections, validated against their schema
for await (const post of space.allRecords({
  collections: [com.example.post],
})) {
  if (post.valid) post.record // typed as com.example.post.Main
}
```

Repos that are unavailable (not found, taken down, suspended or deactivated) are skipped.

### 8. Fetch blobs

Blobs referenced by records in the space are fetched from the repo that references them, and verified against their CID:

```typescript
import { getBlobCid } from '@atproto/lex'

const { body } = await space.getBlob({
  repo,
  cid: getBlobCid(post.value.image),
})
// body: Uint8Array
```

## Errors and verification

| Error                                                | When                                                                                                               |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `XrpcResponseError` with `error: 'SpaceNotFound'`    | The space does not exist, or does not grant the user access (authorities do not disclose which)                    |
| `XrpcResponseError` with `error: 'AppNotAuthorized'` | The space only grants access to specific apps (see `clientAttestationProvider` in [Configuration](#configuration)) |
| `XrpcResponseError` with `error: 'SpaceDeleted'`     | The space was deleted: drop any copy of its data                                                                   |
| `SpaceRepoVerificationError`                         | A record, commit, repo or blob failed verification                                                                 |
| `RepoGapError`                                       | A repo cannot be synced incrementally from a known state (see [Building a sync service](#building-a-sync-service)) |
| `UnsupportedSpacePolicyError`                        | A space is not governed by one of the expected policies (see [Managing a space](#managing-a-space))                |
| `TypeError`                                          | A space is not of the schema's type, or a record type is not one of its collections (see `validateRequest`)        |

Some failures are recovered from automatically:

- A request rejected because of its credential (HTTP 401, e.g. after the credential was revoked) is retried once with a new credential.
- A response failing MAC verification is retried once after re-resolving the author's key, which may have been rotated.

## Managing a space

The authority of a space manages it: its policy (who may read it, whose writes are tracked), and its lifecycle. Managing requires a `manage` grant on the space.

### The policy

`SpaceManager.open()` reads the policy governing a space, and returns the API of that policy. The baseline policies, which every PDS supports, are handled out of the box:

```typescript
import {
  MemberspacePolicyManager,
  SpaceClient,
  SpaceManager,
  memberspacePolicy,
} from '@atproto/lex-space'

const space = await SpaceClient.createSpace(client.agent, com.example.forum, {
  policy: memberspacePolicy.$build({}),
})

const manager = await SpaceManager.open(client.agent, space.uri)
if (manager instanceof MemberspacePolicyManager) {
  await manager.putMembers([{ did, read: true, write: true }])
  for await (const member of manager.members()) console.log(member)
  await manager.updatePolicy({ publicRead: true })
}
```

| Policy                             | Manager                      | API                                                                               |
| ---------------------------------- | ---------------------------- | --------------------------------------------------------------------------------- |
| `com.atproto.personalspace.policy` | `PersonalspacePolicyManager` | `updatePolicy()`                                                                  |
| `com.atproto.memberspace.policy`   | `MemberspacePolicyManager`   | `putMembers()`, `removeMembers()`, `listMembers()`, `members()`, `updatePolicy()` |
| `com.atproto.managedspace.policy`  | `ManagedspacePolicyManager`  | `updatePolicy()` (e.g. the `managingApp`)                                         |

The schemas of these policies are exported as `personalspacePolicy`, `memberspacePolicy` and `managedspacePolicy`, and their managers as `baselineSpacePolicies`.

To only accept some policies, list their managers: the result is typed accordingly, and `UnsupportedSpacePolicyError` is thrown for any other policy.

```typescript
const members = await SpaceManager.open(client.agent, spaceUri, {
  policies: [MemberspacePolicyManager],
}) // MemberspacePolicyManager
```

`updatePolicy()` replaces the policy wholesale: concurrent changes are overwritten (last write wins).

A space host may implement other policies, which define their own methods. To manage them the same way, extend `SpacePolicyManager`, with the policy's schema as static `schema`, and list it in `policies`:

```typescript
import { xrpc } from '@atproto/lex'
import { SpacePolicyManager, baselineSpacePolicies } from '@atproto/lex-space'

class ForumPolicyManager extends SpacePolicyManager<forum.policy.Main> {
  static readonly schema = forum.policy.main

  async ban(did: DidString) {
    await xrpc(this.agent, forum.ban, { body: { space: this.uri, did } })
  }
}

const manager = await SpaceManager.open(client.agent, spaceUri, {
  policies: [ForumPolicyManager, ...baselineSpacePolicies],
})
if (manager instanceof ForumPolicyManager) await manager.ban(did)
```

The first manager whose schema matches the policy manages the space.

### The lifecycle

`SpaceManager` handles what every policy shares, including policies no manager supports:

```typescript
import { SpaceManager, managedspacePolicy } from '@atproto/lex-space'

const space = new SpaceManager(client.agent, spaceUri)

const { policy } = await space.getSpace()
await space.removeWriter(did) // from the writer set
await space.updateSpace(managedspacePolicy.$build({ managingApp }))
await space.deleteSpace()
```

Governing a space by a policy of another type discards the state of the previous policy (e.g. a member list).

## Building a sync service

A sync service keeps its own copy of spaces, e.g. to index them for the users of an app. It does not act for one specific user: use a `SpaceReader`, which provides every read above (but no writes) with space credentials only. `SpaceClient` extends it.

### Obtaining credentials

A `SpaceReader` exchanges delegation tokens for space credentials. A delegation token is always issued by the PDS of a user the space grants access to, with that user's session, but the session does not need to live in the service:

```typescript
import { SpaceReader, delegationTokenProviderFor } from '@atproto/lex-space'

// With the session of a user the space grants access to
const reader = SpaceReader.openSpace(com.example.forum, spaceUri, {
  delegationTokenProvider: delegationTokenProviderFor(client.agent),
})

// With tokens issued elsewhere, e.g. by the app holding the users' sessions
const reader = SpaceReader.openSpace(com.example.forum, spaceUri, {
  delegationTokenProvider: async (space, { signal }) =>
    app.issueToken(space.toString(), { signal }),
})

// For spaces with public read access, which need no delegation token
const reader = SpaceReader.openSpace(com.example.forum, { authority, skey })
```

### Syncing repos

The service keeps a copy of each repo: its records, and a `head` (`{ rev, state }`, where `state` is the repo's LtHash state). It decides when to sync each repo, e.g. when notified of a write:

```typescript
// No known state at first: the first pull fetches the repo in full
let head: SpaceReader.RepoHead | undefined

for await (const _ of notified) {
  // The operations since `head`, or a full copy of the repo (verified) when
  // there is no `head`, or the operation log cannot be applied to it
  const pulled = await reader.pullRepo({
    repo,
    head,
    lookup: (collection, rkey) => store.getCid(repo, collection, rkey),
  })
  if (pulled.type === 'changes') {
    for (const { collection, rkey, cid, record } of pulled.changes) {
      if (cid) store.put(repo, collection, rkey, cid, record)
      else store.delete(repo, collection, rkey)
    }
  } else {
    store.replace(repo, pulled.records)
  }
  head = pulled.head
}
```

To discover the repos to sync, list the writer set with `reader.writers()`. The highest `spaceRev` it yields can be passed as `cursor` later, to only list the repos updated since.

### Notifications

A syncing service registers an endpoint to be notified of updates to the space through the `notify` field of `com.atproto.space.getSpaceCredential`. Registering for, receiving and verifying notifications are not covered by this package yet.

## Configuration

`SpaceClient.openSpace()`, `SpaceClient.createSpace()` and `SpaceReader.openSpace()` accept these options (`SpaceClient.openSpace()` also takes the user's `agent` in them):

```typescript
import { createDidResolver } from '@atproto-labs/did-resolver'
import { clientAttestationProviderForOAuthClient } from '@atproto/lex-space'

const space = SpaceClient.openSpace(com.example.forum, spaceUri, {
  agent: client.agent,

  // Resolves the space authority and members to their PDS and keys. Defaults
  // to a new caching resolver for did:plc (through plc.directory) and did:web:
  // pass one to share its cache between instances.
  didResolver: createDidResolver({ plcDirectoryUrl: 'http://localhost:2582' }),

  // For spaces that only grant access to specific apps. Signs with the keyset
  // of a confidential OAuth client. `clientAttestationProviderFor(clientId,
  // signer)` takes a `Keyset` or an `@atproto/crypto` keypair instead.
  clientAttestationProvider:
    clientAttestationProviderForOAuthClient(oauthClient),

  // Used for every request to hosts other than the user's PDS (e.g. to
  // enforce your own network policy)
  fetch,
})
```

## Reference

### How requests are routed

| Request                                                    | Sent to                              | Authenticated with                      |
| ---------------------------------------------------------- | ------------------------------------ | --------------------------------------- |
| The user's own repo (all writes, and reads without `repo`) | The user's PDS                       | The user's session (their agent)        |
| Another account's repo (reads with `repo`)                 | That account's PDS                   | The space credential, for that account  |
| The space as a whole (`writers()`, `listWriters()`, …)     | The space host (the authority's PDS) | The space credential, for the authority |

### Methods

| Method                                                                               | Description                                                      | On                            |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------------- | ----------------------------- |
| `authorize()`                                                                        | Obtain (or renew) the space credential, to check access early    | `SpaceReader` / `SpaceClient` |
| `writers()`, `listWriters()`                                                         | The writer set                                                   | `SpaceReader` / `SpaceClient` |
| `records()`, `listRecords()`                                                         | A repo's records (not covered by a MAC)                          | `SpaceReader` / `SpaceClient` |
| `getRecord()`                                                                        | A record, verified                                               | `SpaceReader` / `SpaceClient` |
| `allRecords()`                                                                       | The records of every repo in the writer set, verified            | `SpaceReader` / `SpaceClient` |
| `getLatestCommit()`, `getRepo()`, `listRepoOps()`                                    | A repo's commit, full content and operation log, verified        | `SpaceReader` / `SpaceClient` |
| `getRepoSnapshot()`, `syncRepo()`, `pullRepo()`                                      | Full and incremental repo sync                                   | `SpaceReader` / `SpaceClient` |
| `getBlob()`, `listBlobs()`                                                           | Blobs referenced by a repo's records                             | `SpaceReader` / `SpaceClient` |
| `list()`, `listAll()`, `get()`                                                       | Typed reads, of the space type's collections                     | `SpaceClient`                 |
| `create()`, `put()`, `delete()`                                                      | Typed writes to the user's repo, of the space type's collections | `SpaceClient`                 |
| `createRecord()`, `putRecord()`, `deleteRecord()`, `applyWrites()`, `clearRecords()` | Lower level writes to the user's repo, of any collection         | `SpaceClient`                 |

Other calls to the user's PDS can be made with the user's agent: `xrpc(space.agent, method, options)`. The package exports the space schemas it uses, under `com` (e.g. `com.atproto.space.getDelegationToken`). To manage a space, see [Managing a space](#managing-a-space).

### Current limitations

- `getRepo()` and `getBlob()` buffer the response in memory: they will stream once `@atproto/lex-client` supports streamed responses.
- Space credentials are kept in memory only, and each `SpaceClient` obtains its own.

## License

MIT or Apache2
