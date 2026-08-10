import { getPdsEndpoint, getServiceEndpoint } from '@atproto/common'
import type { Keypair } from '@atproto/crypto'
import type { IdResolver } from '@atproto/identity'
import { xrpc } from '@atproto/lex'
import type { SpacePermissionMatch } from '@atproto/oauth-scopes'
import {
  type CommitCtx,
  LtHash,
  RepoCommit,
  type SignedCommit,
} from '@atproto/space'
import {
  AtUri,
  type DidString,
  type SpaceRef,
  type SpaceRefString,
} from '@atproto/syntax'
import {
  InvalidRequestError,
  createServiceAuthHeaders,
} from '@atproto/xrpc-server'
import type { ActorStore } from '../../../../actor-store/actor-store.js'
import type { SpaceRepo } from '../../../../actor-store/db/index.js'
import type {
  AccessOutput,
  OAuthOutput,
  SpaceCredentialOutput,
} from '../../../../auth-output.js'
import type { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { spaceLogger } from '../../../../logger.js'

// Everything except the (type, authority, skey) tuple, derived from the space URI.
type SpaceScopeOp = Omit<SpacePermissionMatch, 'type' | 'authority' | 'skey'>

// Lexicons type a space as a `space-ref`, so schema validation rejects a
// malformed one before any handler runs. Defensive for other callers.
export function toSpaceRef(spaceUri: SpaceRefString): SpaceRef {
  const ref = new AtUri(spaceUri).spaceRef()
  if (!ref) {
    throw new InvalidRequestError(
      `Not a space uri: ${spaceUri}`,
      'InvalidSpaceUri',
    )
  }
  return ref
}

/**
 * Assert that this host is the space's authority, returning its DID. Space-host
 * methods reach straight into the authority's actor store, which would otherwise
 * fail as `Repo not found` — an error none of their lexicons declare.
 */
export async function assertSpaceHost(
  ctx: AppContext,
  spaceUri: SpaceRefString,
): Promise<DidString> {
  const { spaceDid } = toSpaceRef(spaceUri)
  const account = await ctx.accountManager.getAccount(spaceDid, {
    includeDeactivated: true,
    includeTakenDown: true,
  })
  if (!account) {
    throw new InvalidRequestError('Space not found', 'SpaceNotFound')
  }
  return spaceDid
}

// A simplespace space is anchored on its authority's own DID, so ownership is a
// comparison against the space URI.
export function assertSpaceOwner(
  callerDid: string,
  spaceUri: SpaceRefString,
): void {
  const { spaceDid } = toSpaceRef(spaceUri)
  if (spaceDid !== callerDid) {
    throw new InvalidRequestError('Not the space owner', 'NotSpaceOwner')
  }
}

/**
 * Space credentials carry their own space, checked by {@link assertCredentialSpace}.
 * Legacy access tokens (including app passwords) predate granular permissions and
 * carry no space grants at all, so there is nothing to evaluate — they are bounded
 * instead by the handlers, which require the caller to be the repo they name.
 */
export function assertSpaceScope(
  auth: AccessOutput | OAuthOutput | SpaceCredentialOutput,
  spaceUri: SpaceRefString,
  op: SpaceScopeOp,
): void {
  if (auth.credentials.type !== 'oauth') return
  const { spaceDid, spaceType, skey } = toSpaceRef(spaceUri)
  auth.credentials.permissions.assertSpace({
    type: spaceType,
    authority: spaceDid,
    skey,
    ...op,
  } as SpacePermissionMatch)
}

/**
 * An account credential reads only that account's own repo in the space. Reaching
 * another member's repo takes a space credential, which only the authority issues
 * and only after deciding the holder may read the space — a repo host has no member
 * list of its own to consult. A whole-space `read` grant is what an app exchanges
 * for such a credential (see getDelegationToken); it is not itself one.
 */
export function assertSpaceRead(
  auth: AccessOutput | OAuthOutput | SpaceCredentialOutput,
  spaceUri: SpaceRefString,
  repo: string,
): void {
  if (auth.credentials.type === 'space_credential') {
    assertCredentialSpace(auth.credentials, spaceUri)
    return
  }
  if (auth.credentials.did !== repo) {
    // Deliberately the same error an absent repo gets: whether a given account
    // holds a repo in a space the caller cannot read is not the caller's business.
    throw new InvalidRequestError(
      `Could not find repo for DID: ${repo}`,
      'RepoNotFound',
    )
  }
  assertSpaceScope(auth, spaceUri, { action: 'read_self' })
}

// The space analogue of `isUserOrAdmin`: a space credential names a syncer rather
// than an account, so it is never the repo's own owner.
export function isSpaceSelfRead(
  auth: AccessOutput | OAuthOutput | SpaceCredentialOutput,
  repo: string,
): boolean {
  if (auth.credentials.type === 'space_credential') return false
  return auth.credentials.did === repo
}

export function assertCredentialSpace(
  credentials: SpaceCredentialOutput['credentials'],
  spaceUri: SpaceRefString,
): void {
  if (credentials.space !== spaceUri) {
    throw new InvalidRequestError(
      'Credential is not scoped to this space',
      'InvalidCredential',
    )
  }
}

// Undefined when the repo has never been written to.
export async function buildSignedCommit(opts: {
  spaceUri: SpaceRefString
  author: string
  state: SpaceRepo | null
  keypair: Keypair
}): Promise<SignedCommit | undefined> {
  const { spaceUri, author, state, keypair } = opts
  if (!state?.setHash || !state.rev) return undefined

  const ctx: CommitCtx = {
    space: toSpaceRef(spaceUri).toString(),
    author,
    rev: state.rev,
  }
  return RepoCommit.fromState(state.setHash).sign(ctx, keypair)
}

/**
 * Resolve a service identifier — a DID with an optional service fragment, e.g.
 * `did:web:syncer.example.com#atproto_space_syncer` — to its endpoint. Without a
 * fragment the DID's own `#atproto_pds` entry is used, since a bare DID names an
 * account and an account is served by its PDS.
 */
export async function resolveServiceEndpoint(
  idResolver: IdResolver,
  service: string,
): Promise<string | undefined> {
  const [did, fragment] = service.split('#')
  const didDoc = await idResolver.did.resolve(did).catch((err) => {
    spaceLogger.warn({ err, service }, 'could not resolve service did')
    return null
  })
  if (!didDoc) return undefined
  return fragment
    ? getServiceEndpoint(didDoc, { id: `#${fragment}` })
    : getPdsEndpoint(didDoc)
}

/**
 * Resolve a notification target and mint the service auth to reach it. `aud` is the
 * service identifier itself, so a fragment-bearing target is addressed as published.
 */
export async function resolveNotifyTarget(
  deps: { idResolver: IdResolver; actorStore: ActorStore },
  opts: { iss: string; service: string; lxm: string },
): Promise<{ endpoint: string; headers: Record<string, string> } | undefined> {
  const { iss, service, lxm } = opts
  const endpoint = await resolveServiceEndpoint(deps.idResolver, service)
  if (!endpoint) return undefined
  const keypair = await deps.actorStore.keypair(iss)
  const { headers } = await createServiceAuthHeaders({
    iss,
    aud: service,
    lxm,
    keypair,
  })
  return { endpoint, headers }
}

// Notifications are best-effort: sync recovers on a later notification or a sweep.
// Takes a nullable commit so callers whose write may be a no-op — an already-deleted
// record, an empty batch — don't each have to guard.
export async function fireNotifyWrite(
  ctx: AppContext,
  opts: {
    space: SpaceRefString
    writerDid: string
    commit: { rev: string; setHash: Uint8Array } | null
  },
): Promise<void> {
  const { space, writerDid, commit } = opts
  if (!commit) return
  const { rev, setHash } = commit
  const { spaceDid } = toSpaceRef(space)
  const lxm = com.atproto.space.notifyWrite.$lxm
  try {
    const target = await resolveNotifyTarget(ctx, {
      iss: writerDid,
      service: spaceDid,
      lxm,
    })
    if (!target) {
      spaceLogger.warn({ space, lxm }, 'could not resolve space host')
      return
    }
    await xrpc(target.endpoint, com.atproto.space.notifyWrite, {
      headers: target.headers,
      body: {
        space,
        repo: writerDid as DidString,
        rev,
        hash: new LtHash(setHash).digest(),
      },
    })
  } catch (err) {
    spaceLogger.warn({ err, space, repo: writerDid, lxm }, 'notify failed')
  }
}
