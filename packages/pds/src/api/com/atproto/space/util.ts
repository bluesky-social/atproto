import { getPdsEndpoint } from '@atproto/common'
import { Keypair } from '@atproto/crypto'
import { xrpc } from '@atproto/lex'
import { SpacePermissionMatch } from '@atproto/oauth-scopes'
import { CommitCtx, LtHash, RepoCommit } from '@atproto/space'
import { AtUriString, DidString, SpaceUri } from '@atproto/syntax'
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

// Legacy access tokens and space credentials pre-authorize at the auth layer.
export function assertSpaceScope(
  auth: AccessOutput | OAuthOutput | SpaceCredentialOutput,
  spaceUri: string,
  op: SpaceScopeOp,
): void {
  if (auth.credentials.type !== 'oauth') return
  const parsed = new SpaceUri(spaceUri)
  auth.credentials.permissions.assertSpace({
    type: parsed.spaceType,
    authority: parsed.authorityDid,
    skey: parsed.skey,
    ...op,
  } as SpacePermissionMatch)
}

export function assertSpaceRead(
  auth: AccessOutput | OAuthOutput | SpaceCredentialOutput,
  spaceUri: string,
): void {
  if (auth.credentials.type === 'space_credential') {
    assertCredentialSpace(auth.credentials, spaceUri)
  } else {
    assertSpaceScope(auth, spaceUri, { action: 'read' })
  }
}

export function assertCredentialSpace(
  credentials: SpaceCredentialOutput['credentials'],
  spaceUri: string,
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
  spaceUri: string
  author: string
  state: { setHash: Buffer | null; rev: string | null } | null
  keypair: Keypair
}): Promise<com.atproto.space.defs.SignedCommit | undefined> {
  const { spaceUri, author, state, keypair } = opts
  if (!state?.setHash || !state.rev) return undefined

  const ctx: CommitCtx = {
    space: new SpaceUri(spaceUri).space,
    author,
    rev: state.rev,
  }
  const commit = await RepoCommit.fromState(state.setHash).sign(ctx, keypair)
  return com.atproto.space.defs.signedCommit.build(commit)
}

// Best effort: the authority records the write and fans out to syncers.
export async function fireNotifyWrite(
  ctx: AppContext,
  opts: {
    space: string
    writerDid: string
    rev: string
    setHash: Uint8Array
  },
): Promise<void> {
  const { space, writerDid, rev, setHash } = opts
  const authorityDid = new SpaceUri(space).authorityDid
  try {
    const authorityDidDoc = await ctx.idResolver.did.resolve(authorityDid)
    if (!authorityDidDoc) return
    const authorityPdsUrl = getPdsEndpoint(authorityDidDoc)
    if (!authorityPdsUrl) return

    const keypair = await ctx.actorStore.keypair(writerDid)
    const { headers } = await createServiceAuthHeaders({
      iss: writerDid,
      aud: authorityDid,
      lxm: com.atproto.space.notifyWrite.$lxm,
      keypair,
    })

    await xrpc(authorityPdsUrl, com.atproto.space.notifyWrite, {
      headers,
      body: {
        space: space as AtUriString,
        repo: writerDid as DidString,
        rev,
        hash: new LtHash(setHash).digest(),
      },
    })
  } catch {
    // Sync recovers on a later notification or a sweep.
  }
}
