import { getPdsEndpoint, getServiceEndpoint } from '@atproto/common'
import { Keypair } from '@atproto/crypto'
import { xrpc } from '@atproto/lex'
import { SpacePermissionMatch } from '@atproto/oauth-scopes'
import { CommitCtx, LtHash, RepoCommit, SignedCommit } from '@atproto/space'
import { AtUri, DidString, SpaceRef, SpaceRefString } from '@atproto/syntax'
import {
  InvalidRequestError,
  createServiceAuthHeaders,
} from '@atproto/xrpc-server'
import {
  AccessOutput,
  OAuthOutput,
  SpaceCredentialOutput,
} from '../../../../auth-output.js'
import { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'

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
  state: { setHash: Buffer | null; rev: string | null } | null
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

// The fragment is required: it names the DID document entry to deliver to.
export async function resolveNotifyService(
  ctx: AppContext,
  service: string,
): Promise<string | undefined> {
  const [did, fragment] = service.split('#')
  if (!fragment) return undefined
  const didDoc = await ctx.idResolver.did.resolve(did).catch(() => null)
  if (!didDoc) return undefined
  return getServiceEndpoint(didDoc, { id: `#${fragment}` })
}

// Best effort: the authority records the write and fans out to syncers.
export async function fireNotifyWrite(
  ctx: AppContext,
  opts: {
    space: SpaceRefString
    writerDid: string
    rev: string
    setHash: Uint8Array
  },
): Promise<void> {
  const { space, writerDid, rev, setHash } = opts
  const { spaceDid } = toSpaceRef(space)
  try {
    const spaceDidDoc = await ctx.idResolver.did.resolve(spaceDid)
    if (!spaceDidDoc) return
    const spacePdsUrl = getPdsEndpoint(spaceDidDoc)
    if (!spacePdsUrl) return

    const keypair = await ctx.actorStore.keypair(writerDid)
    const { headers } = await createServiceAuthHeaders({
      iss: writerDid,
      aud: spaceDid,
      lxm: com.atproto.space.notifyWrite.$lxm,
      keypair,
    })

    await xrpc(spacePdsUrl, com.atproto.space.notifyWrite, {
      headers,
      body: {
        space,
        repo: writerDid as DidString,
        rev,
        hash: new LtHash(setHash).digest(),
      },
    })
  } catch {
    // Sync recovers on a later notification or a sweep.
  }
}
