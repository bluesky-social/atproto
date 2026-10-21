import type { IncomingMessage, ServerResponse } from 'node:http'
import {
  MINUTE,
  TID,
  getPdsEndpoint,
  getServiceEndpoint,
} from '@atproto/common'
import type { IdResolver } from '@atproto/identity'
import { xrpc } from '@atproto/lex'
import type { Cid } from '@atproto/lex-data'
import type { SpacePermissionMatchOperation } from '@atproto/oauth-scopes'
import {
  COMMIT_MAC_TYPE,
  type Commit,
  MAC_HEADER,
  type MacType,
  RECORD_MAC_TYPE,
  RepoCommit,
  SpaceMacError,
  WANT_MAC_HEADER,
  computeCommitMac,
  computeRecordMac,
  decapsulate,
  formatMacHeader,
  parseWantMacHeader,
} from '@atproto/space'
import { type DidString, SpaceRef, type SpaceRefString } from '@atproto/syntax'
import {
  AuthRequiredError,
  ForbiddenError,
  InvalidRequestError,
  createServiceAuthHeaders,
} from '@atproto/xrpc-server'
import type { ActorStore } from '../../../../actor-store/actor-store.js'
import type { SpaceRepo } from '../../../../actor-store/db/index.js'
import {
  type AccessOutput,
  type OAuthOutput,
  type SpaceCredentialOutput,
  isSpaceCredentialOutput,
} from '../../../../auth-output.js'
import type { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { spaceLogger } from '../../../../logger.js'
import { appendVary } from '../../../../util/http.js'

// Lexicons type a space as a `space-ref`, so schema validation rejects a
// malformed one before any handler runs. Defensive for other callers.
export function toSpaceRef(spaceUri: SpaceRefString): SpaceRef {
  try {
    return SpaceRef.parse(spaceUri)
  } catch (cause) {
    throw new InvalidRequestError(
      `Not a space uri: ${spaceUri}`,
      'InvalidSpaceUri',
      { cause },
    )
  }
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
  auth: AccessOutput | OAuthOutput,
  space: SpaceRef | SpaceRefString,
  op: SpacePermissionMatchOperation,
): void {
  const ref = typeof space === 'string' ? toSpaceRef(space) : space
  auth.credentials.permissions?.assertSpaceRef(ref, op)
  if (ref.spaceDid !== auth.credentials.did) {
    throw new InvalidRequestError('Not the space owner', 'NotSpaceOwner')
  }
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
  if (isSpaceCredentialOutput(auth)) {
    assertCredentialSpace(auth.credentials, spaceUri, repo)
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
  auth.credentials.permissions?.assertSpaceRef(spaceUri, {
    action: 'read_self',
  })
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
  audience: string = toSpaceRef(spaceUri).spaceDid,
): void {
  if (credentials.audience !== audience) {
    throw new AuthRequiredError(
      'space audience does not match the request',
      'BadSpaceAudience',
    )
  }
  if (credentials.space !== spaceUri) {
    throw new InvalidRequestError(
      'Credential is not scoped to this space',
      'InvalidCredential',
    )
  }
}

// Undefined when the repo has never been written to.
export function buildCommit(opts: {
  spaceUri: SpaceRefString
  repo: DidString
  state: SpaceRepo | null
}): Commit | undefined {
  const { spaceUri, repo, state } = opts
  if (!state?.setHash || !state.rev) return undefined

  return RepoCommit.fromState(state.setHash).toCommit({
    space: spaceUri,
    repo,
    rev: state.rev,
  })
}

/**
 * Methods that return a commit or record require a MAC when called with a space
 * credential, requested via the `Atproto-Space-Want-Mac` header. Returns the
 * shared secret to compute it with, or undefined when an account reading its own
 * data did not ask for one.
 */
export async function getSpaceMacSecret(
  ctx: AppContext,
  opts: {
    req: IncomingMessage
    res: ServerResponse
    auth: AccessOutput | OAuthOutput | SpaceCredentialOutput
    repo: DidString
    type: MacType
  },
): Promise<Uint8Array | undefined> {
  const { req, res, auth, repo, type } = opts
  appendVary(res, WANT_MAC_HEADER)

  const header = req.headers[WANT_MAC_HEADER]
  if (header === undefined && !isSpaceCredentialOutput(auth)) {
    return undefined
  }

  const kemKeypair = await ctx.actorStore.kemKeypair(repo)
  try {
    const keyShare = parseWantMacHeader(header, type)
    return decapsulate(kemKeypair, keyShare)
  } catch (err) {
    if (err instanceof SpaceMacError) {
      throw new InvalidRequestError(err.message, 'BadSpaceMac')
    }
    throw err
  }
}

// The `Atproto-Space-Mac` response header for a commit, when a MAC was requested.
export function commitMacHeaders(
  sharedSecret: Uint8Array | undefined,
  commit: Commit,
): Record<string, string> | undefined {
  if (!sharedSecret) return undefined
  const mac = computeCommitMac(sharedSecret, commit)
  return { [MAC_HEADER]: formatMacHeader(COMMIT_MAC_TYPE, mac) }
}

// The `Atproto-Space-Mac` response header for a record, when a MAC was requested.
export function recordMacHeaders(
  sharedSecret: Uint8Array | undefined,
  uri: string,
  cid: Cid,
): Record<string, string> | undefined {
  if (!sharedSecret) return undefined
  const mac = computeRecordMac(sharedSecret, uri, cid)
  return { [MAC_HEADER]: formatMacHeader(RECORD_MAC_TYPE, mac) }
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
  if (fragment === 'atproto_space_host') {
    const dedicated = didDoc.service?.some(
      (entry) => entry.id === '#atproto_space_host' || entry.id === service,
    )
    return dedicated
      ? getServiceEndpoint(didDoc, { id: '#atproto_space_host' })
      : getPdsEndpoint(didDoc)
  }
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

/** Process a write notification when this PDS hosts the space authority. */
export async function processNotifyWrite(
  ctx: AppContext,
  input: com.atproto.space.notifyWrite.$InputBody,
): Promise<void> {
  const { space, repo, repoRev, data } = input
  const { spaceDid: ownerDid } = toSpaceRef(space)

  await assertSpaceHost(ctx, space)
  if (TID.fromStr(repoRev).timestamp() > (Date.now() + 5 * MINUTE) * 1000) {
    throw new InvalidRequestError('Repo revision is in the future', 'FutureRev')
  }

  const { existing, config, recipients } = await ctx.actorStore.read(
    ownerDid,
    async (store) => ({
      existing: await store.space.getSpace(space),
      config: await store.space.getSpaceConfig(space),
      recipients: await store.space.getCredentialRecipients(space),
    }),
  )
  if (!config || !existing || existing.deletedAt) {
    throw new InvalidRequestError('Space not found', 'SpaceNotFound')
  }

  // Apply the same user perimeter used when minting credentials. notifyWrite
  // comes from a PDS rather than an app, so there is no app attestation to check.
  const authorized = await ctx.simpleSpaceManager.authorizeUser({
    config,
    userDid: repo,
    access: 'write',
  })
  if (!authorized) {
    throw new ForbiddenError('notifyWrite writer is not authorized')
  }

  const sequence = await ctx.actorStore.transact(ownerDid, (txn) =>
    txn.space.recordWriter(space, repo, repoRev, data),
  )
  if (!sequence) return

  // Fan-out stays queued so neither a local write nor a remote PDS waits on
  // downstream syncing services.
  const lxm = com.atproto.space.notifyWrite.$lxm
  ctx.backgroundQueue.add(async (_ctx, signal) => {
    for (const recipient of recipients) {
      try {
        const target = await resolveNotifyTarget(ctx, {
          iss: ownerDid,
          service: recipient.serviceDid,
          lxm,
        })
        if (!target) {
          spaceLogger.warn(
            { space, service: recipient.serviceDid, lxm },
            'could not resolve notify recipient',
          )
          continue
        }
        await xrpc(target.endpoint, com.atproto.space.notifyWrite, {
          headers: target.headers,
          body: { space, repo, repoRev, data, ...sequence },
          signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
        })
      } catch (err) {
        spaceLogger.warn(
          { err, space, service: recipient.serviceDid, lxm },
          'notify failed',
        )
      }
    }
  })
}

/** Send immediately after the repo commit, persisting failures for retry. */
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
  await ctx.spaceNotifications.notify(space, writerDid as DidString, commit)
}
