import { Keypair } from '@atproto/crypto'
import { getPdsEndpoint } from '@atproto/common'
import { xrpc } from '@atproto/lex'
import { SpacePermissionMatch } from '@atproto/oauth-scopes'
import { LtHash, SpaceContext, createCommit } from '@atproto/space'
import { DidString, SpaceUri, SpaceUriString } from '@atproto/syntax'
import { createServiceAuthHeaders } from '@atproto/xrpc-server'
import {
  AccessOutput,
  OAuthOutput,
  SpaceCredentialOutput,
} from '../../../../auth-output.js'
import { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'

// The operation portion of a space permission check — everything except the
// (type, did, skey) tuple, which assertSpaceScope derives from the space URI.
type SpaceScopeOp = Omit<SpacePermissionMatch, 'type' | 'did' | 'skey'>

/**
 * Enforce a `space:` OAuth scope check on the given auth credentials.
 *
 * Only `oauth` credentials carry granular permissions; legacy access tokens
 * (`access`) and space-credential auth pre-authorize at the auth layer and
 * skip this check. Matches the pattern used by repo handlers (e.g.
 * `com.atproto.repo.createRecord`).
 *
 * Pass the operation being performed: a record `action` (with `collection` for
 * writes / read_self) or a `manage` verb.
 */
export function assertSpaceScope(
  auth: AccessOutput | OAuthOutput | SpaceCredentialOutput,
  spaceUri: string,
  op: SpaceScopeOp,
): void {
  if (auth.credentials.type !== 'oauth') return
  const parsed = new SpaceUri(spaceUri)
  auth.credentials.permissions.assertSpace({
    type: parsed.spaceType,
    did: parsed.spaceDid,
    skey: parsed.skey,
    ...op,
  } as SpacePermissionMatch)
}

/**
 * Build a wire-format `signedCommit` from the stored LtHash state + rev.
 * Returns undefined if either is missing (the repo has never been written to).
 * The commit binds only the space URI + rev (proposal 0016); the author is
 * identified out-of-band by whose repo is being read.
 */
export async function buildSignedCommit(opts: {
  spaceUri: string
  state: { setHash: Buffer | null; rev: string | null } | null
  keypair: Keypair
}): Promise<com.atproto.space.defs.SignedCommit | undefined> {
  const { spaceUri, state, keypair } = opts
  if (!state?.setHash || !state.rev) return undefined

  const uri = new SpaceUri(spaceUri)
  const spaceCtx: SpaceContext = {
    space: uri.space,
    rev: state.rev,
  }
  const lthash = new LtHash(state.setHash)
  const signed = await createCommit(lthash, spaceCtx, keypair)

  return com.atproto.space.defs.signedCommit.build({
    hash: new Uint8Array(signed.hash),
    mac: new Uint8Array(signed.mac),
    ikm: new Uint8Array(signed.ikm),
    sig: new Uint8Array(signed.sig),
    rev: signed.rev,
  })
}

// Notify the space host (the authority) that a repo advanced. The authority
// then forwards to registered syncers. Best-effort.
export async function fireNotifyWrite(
  ctx: AppContext,
  space: string,
  writerDid: string,
  rev: string,
): Promise<void> {
  const authorityDid = new SpaceUri(space).spaceDid
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

    xrpc(authorityPdsUrl, com.atproto.space.notifyWrite, {
      headers,
      body: {
        space: space as SpaceUriString,
        repo: writerDid as DidString,
        rev,
      },
    }).catch(() => {
      // best-effort notification
    })
  } catch {
    // best-effort notification
  }
}
