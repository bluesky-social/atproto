import type { IncomingMessage, ServerResponse } from 'node:http'
import { MINUTE, TID, getServiceEndpoint } from '@atproto/common'
import type { IdResolver } from '@atproto/identity'
import { xrpc } from '@atproto/lex'
import type { Cid } from '@atproto/lex-data'
import type { SpacePermissionMatchOperation } from '@atproto/oauth-scopes'
import {
  MAC_COVERED_HEADER,
  type MacProfile,
  type MacRequest,
  RepoCommit,
  type SpaceCommit,
  SpaceKemError,
  SpaceMacError,
  SpaceMetaArchiveError,
  SpaceRepoVerificationError,
  createCommitMacHeaders,
  createRecordMacHeaders,
  decapsulate,
  parseMacRequest,
} from '@atproto/space'
import { StarParseError } from '@atproto/star'
import {
  type AtUriString,
  type DidString,
  SpaceRef,
  type SpaceRefString,
} from '@atproto/syntax'
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
  type AdminTokenOutput,
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
 * Assert that this host is the space's authority. Space-host methods reach
 * straight into the authority's actor store, which would otherwise fail as
 * `Repo not found` — an error none of their lexicons declare.
 */
export async function assertSpaceHost(
  ctx: AppContext,
  ref: SpaceRef,
): Promise<void> {
  await getSpaceHostAccount(ctx, ref)
}

/**
 * Like {@link assertSpaceHost}, but also refuses an authority that is taken down
 * or deactivated, as `sync.*` does for a repo. Notification routes keep using
 * {@link assertSpaceHost} so the authority's writer state stays current.
 */
export async function assertActiveSpaceHost(
  ctx: AppContext,
  ref: SpaceRef,
): Promise<void> {
  const account = await getSpaceHostAccount(ctx, ref)
  if (account.takedownRef) {
    throw new InvalidRequestError(
      `Repo has been takendown: ${ref.spaceDid}`,
      'RepoTakendown',
    )
  }
  if (account.deactivatedAt) {
    throw new InvalidRequestError(
      `Repo has been deactivated: ${ref.spaceDid}`,
      'RepoDeactivated',
    )
  }
}

async function getSpaceHostAccount(ctx: AppContext, ref: SpaceRef) {
  const account = await ctx.accountManager.getAccount(ref.spaceDid, {
    includeDeactivated: true,
    includeTakenDown: true,
  })
  if (!account) {
    throw new InvalidRequestError('Space not found', 'SpaceNotFound')
  }
  return account
}

// A space created on a PDS is anchored on its creator's own DID, so being its
// authority is a comparison against the space URI.
export function assertSpaceAuthority(
  auth: AccessOutput | OAuthOutput,
  ref: SpaceRef,
  op: SpacePermissionMatchOperation,
): void {
  auth.credentials.permissions?.assertSpace(ref, op)
  if (ref.spaceDid !== auth.credentials.did) {
    throw new InvalidRequestError('Not the space authority', 'NotAuthorized')
  }
}

export type SpaceReadAuth =
  AccessOutput | OAuthOutput | SpaceCredentialOutput | AdminTokenOutput

/**
 * An account credential reads only that account's own repo in the space. Reaching
 * another member's repo takes a space credential, which only the authority issues
 * and only after deciding the holder may read the space — a repo host has no member
 * list of its own to consult. A whole-space `read` grant is what an app exchanges
 * for such a credential (see getDelegationToken); it is not itself one. The admin
 * token reads any repo, as it does through `sync.*`.
 */
export function assertSpaceRead(
  auth: SpaceReadAuth,
  ref: SpaceRef,
  repo: DidString,
): void {
  if (auth.credentials.type === 'admin_token') return
  if (isSpaceCredentialOutput(auth)) {
    assertCredentialSpace(auth.credentials, ref, repo)
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
  auth.credentials.permissions?.assertSpace(ref, {
    action: 'read_self',
  })
}

// The space analogue of `isUserOrAdmin`: a space credential names a syncer rather
// than an account, so it is never the repo's own account.
export function isSpaceUserOrAdmin(
  auth: SpaceReadAuth,
  repo: DidString,
): boolean {
  if (auth.credentials.type === 'admin_token') return true
  if (isSpaceCredentialOutput(auth)) return false
  return auth.credentials.did === repo
}

export function assertCredentialSpace(
  credentials: SpaceCredentialOutput['credentials'],
  ref: SpaceRef,
  audience: DidString = ref.spaceDid,
): void {
  if (credentials.audience !== audience) {
    throw new AuthRequiredError(
      'space audience does not match the request',
      'BadSpaceAudience',
    )
  }
  if (credentials.space !== ref.toString()) {
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
}): SpaceCommit | undefined {
  const { spaceUri, repo, state } = opts
  if (!state?.setHash || !state.rev) return undefined

  return RepoCommit.fromState(state.setHash).toCommit({
    space: spaceUri,
    repo,
    rev: state.rev,
  })
}

// A MAC request, with the shared secret to answer it with.
export type SpaceMacRequest = {
  request: MacRequest
  sharedSecret: Uint8Array
}

/**
 * Methods that return a commit or record require a MAC when called with a space
 * credential, requested via the `Accept-Signature` header. Returns the request
 * and the shared secret to answer it with, or undefined when an account reading
 * its own data did not ask for one.
 */
export async function getSpaceMacRequest(
  ctx: AppContext,
  opts: {
    req: IncomingMessage
    res: ServerResponse
    auth: SpaceReadAuth
    repo: DidString
    profile: MacProfile
  },
): Promise<SpaceMacRequest | undefined> {
  const { req, res, auth, repo, profile } = opts
  appendVary(res, 'Accept-Signature')

  try {
    const request = parseMacRequest(req.headers['accept-signature'], profile)
    if (!request) {
      if (isSpaceCredentialOutput(auth)) {
        throw new InvalidRequestError(
          `A MAC must be requested with tag "${profile}"`,
          'InvalidSpaceMac',
        )
      }
      return undefined
    }
    // So that a browser app can read the MAC from a cross-origin response
    res.appendHeader('Access-Control-Expose-Headers', [
      MAC_COVERED_HEADER[profile],
      'Signature-Input',
      'Signature',
    ])

    const kemKeypair = await ctx.actorStore.kemKeypair(repo)
    if (!kemKeypair) {
      throw new Error(`Account has no KEM key: ${repo}`)
    }
    return {
      request,
      sharedSecret: decapsulate(kemKeypair, request.keyShare),
    }
  } catch (err) {
    if (err instanceof SpaceMacError || err instanceof SpaceKemError) {
      throw new InvalidRequestError(err.message, 'InvalidSpaceMac', {
        cause: err,
      })
    }
    throw err
  }
}

// A malformed STAR archive in a request body is the caller's error, reported under
// the error name the method declares for it.
export function throwInvalidArchive(err: unknown, errorName: string): never {
  if (
    err instanceof StarParseError ||
    err instanceof SpaceRepoVerificationError ||
    err instanceof SpaceMetaArchiveError
  ) {
    throw new InvalidRequestError(err.message, errorName, { cause: err })
  }
  throw err
}

// The MAC response headers for a commit, when a MAC was requested.
export function commitMacHeaders(
  mac: SpaceMacRequest | undefined,
  commit: SpaceCommit,
): Record<string, string> | undefined {
  if (!mac) return undefined
  return createCommitMacHeaders(mac.request, mac.sharedSecret, commit)
}

// The MAC response headers for a record, when a MAC was requested.
export function recordMacHeaders(
  mac: SpaceMacRequest | undefined,
  uri: AtUriString,
  cid: Cid,
): Record<string, string> | undefined {
  if (!mac) return undefined
  return createRecordMacHeaders(mac.request, mac.sharedSecret, uri, cid)
}

/**
 * Resolve a `did#serviceId` reference, e.g.
 * `did:web:syncer.example.com#atproto_space_syncer`, to its service endpoint.
 */
export async function resolveServiceEndpoint(
  idResolver: IdResolver,
  service: string,
): Promise<string | undefined> {
  const [did, serviceId] = service.split('#')
  if (!serviceId) return undefined
  const didDoc = await idResolver.did.resolve(did).catch((err) => {
    spaceLogger.warn({ err, service }, 'could not resolve service did')
    return null
  })
  if (!didDoc) return undefined
  return getServiceEndpoint(didDoc, { id: `#${serviceId}` })
}

/**
 * Resolve a `did#serviceId` reference and mint the service auth to reach it. `aud`
 * is the reference itself, so the service is addressed as published.
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

/** Process a repo update notification when this PDS hosts the space authority. */
export async function processNotifyRepoUpdate(
  ctx: AppContext,
  ref: SpaceRef,
  input: com.atproto.space.notifyRepoUpdate.$InputBody,
): Promise<void> {
  const { space, repo, repoRev, data } = input
  const { spaceDid } = ref

  await assertSpaceHost(ctx, ref)
  if (TID.fromStr(repoRev).timestamp() > (Date.now() + 5 * MINUTE) * 1000) {
    throw new InvalidRequestError('Repo revision is in the future', 'FutureRev')
  }

  const { policy, recipients } = await ctx.actorStore.read(
    spaceDid,
    async (store) => ({
      policy: await store.space.getActiveSpacePolicy(space),
      recipients: await store.space.getCredentialRecipients(space),
    }),
  )

  // Apply the same account perimeter used when minting credentials. The notification
  // comes from a PDS rather than an app, so there is no app attestation to check.
  const authorized = await ctx.spacePolicyManager.authorizeRepo({
    space: ref,
    policy,
    repo,
    access: 'write',
  })
  if (!authorized) {
    throw new ForbiddenError('Repo is not authorized to write to the space')
  }

  const sequence = await ctx.actorStore.transact(spaceDid, (txn) =>
    txn.space.recordWriter(space, repo, repoRev, data),
  )
  if (!sequence) return

  // Fan-out stays queued so neither a local write nor a remote PDS waits on
  // downstream syncing services.
  const lxm = com.atproto.space.notifyRepoUpdate.$lxm
  ctx.backgroundQueue.add(async (_ctx, signal) => {
    for (const recipient of recipients) {
      try {
        const target = await resolveNotifyTarget(ctx, {
          iss: spaceDid,
          service: recipient.service,
          lxm,
        })
        if (!target) {
          spaceLogger.warn(
            { space, service: recipient.service, lxm },
            'could not resolve notify recipient',
          )
          continue
        }
        await xrpc(target.endpoint, com.atproto.space.notifyRepoUpdate, {
          headers: target.headers,
          body: { space, repo, repoRev, data, ...sequence },
          signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
        })
      } catch (err) {
        spaceLogger.warn(
          { err, space, service: recipient.service, lxm },
          'notify failed',
        )
      }
    }
  })
}

/** Send immediately after the repo commit, persisting failures for retry. */
export async function fireNotifyRepoUpdate(
  ctx: AppContext,
  opts: {
    space: SpaceRef
    writerDid: DidString
    commit: { rev: string; setHash: Uint8Array } | null
  },
): Promise<void> {
  const { space, writerDid, commit } = opts
  if (!commit) return
  await ctx.spaceNotifications.notify(space, writerDid, commit)
}
