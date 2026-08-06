import { getPdsEndpoint, getServiceEndpoint } from '@atproto/common'
import { Keypair } from '@atproto/crypto'
import { IdResolver } from '@atproto/identity'
import { xrpc } from '@atproto/lex'
import { SpacePermissionMatch } from '@atproto/oauth-scopes'
import { CommitCtx, LtHash, RepoCommit, SignedCommit } from '@atproto/space'
import { AtUri, DidString, SpaceRef, SpaceRefString } from '@atproto/syntax'
import {
  InvalidRequestError,
  createServiceAuthHeaders,
} from '@atproto/xrpc-server'
import { ActorStore } from '../../../../actor-store/actor-store.js'
import { SpaceRepo } from '../../../../actor-store/db/index.js'
import {
  AccessOutput,
  OAuthOutput,
  SpaceCredentialOutput,
} from '../../../../auth-output.js'
import { AppContext } from '../../../../context.js'
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

// Legacy access tokens and space credentials pre-authorize at the auth layer.
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
 * Reading a repo other than the caller's own takes whole-space `read`. Reading
 * their own takes only `read_self`, which `read` implies.
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
  const isOwnRepo =
    auth.credentials.type === 'oauth' && auth.credentials.did === repo
  assertSpaceScope(auth, spaceUri, {
    action: isOwnRepo ? 'read_self' : 'read',
  })
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
