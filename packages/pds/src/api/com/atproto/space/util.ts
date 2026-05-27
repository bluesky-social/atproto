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

/**
 * Enforce a `space:` OAuth scope check on the given auth credentials.
 *
 * Only `oauth` credentials carry granular permissions; legacy access tokens
 * (`access`) and space-credential auth pre-authorize at the auth layer and
 * skip this check. Matches the pattern used by repo handlers (e.g.
 * `com.atproto.repo.createRecord`).
 *
 * Pass the parsed (type, did, skey) tuple plus the action being performed.
 * For write actions (`create`/`update`/`delete`), pass the target collection.
 */
export function assertSpaceScope(
  auth: AccessOutput | OAuthOutput | SpaceCredentialOutput,
  spaceUri: string,
  match: Pick<SpacePermissionMatch, 'action'> & { collection?: string },
): void {
  if (auth.credentials.type !== 'oauth') return
  const parsed = new SpaceUri(spaceUri)
  auth.credentials.permissions.assertSpace({
    type: parsed.spaceType,
    did: parsed.spaceDid,
    skey: parsed.skey,
    ...match,
  } as SpacePermissionMatch)
}

/**
 * Build a wire-format `signedCommit` from the stored LtHash state + rev.
 * Returns undefined if either is missing (the repo / member list has never
 * been written to).
 *
 * `userDid` is the subject the commit is bound to: the record-author for
 * record commits, the space owner for member commits.
 */
export async function buildSignedCommit(opts: {
  spaceUri: string
  userDid: string
  scope: 'records' | 'members'
  state: { setHash: Buffer | null; rev: string | null } | null
  keypair: Keypair
}): Promise<com.atproto.space.defs.SignedCommit | undefined> {
  const { spaceUri, userDid, scope, state, keypair } = opts
  if (!state?.setHash || !state.rev) return undefined

  const uri = new SpaceUri(spaceUri)
  const spaceCtx: SpaceContext = {
    spaceDid: uri.spaceDid,
    spaceType: uri.spaceType,
    spaceKey: uri.skey,
    userDid,
    rev: state.rev,
    scope,
  }
  const lthash = new LtHash(state.setHash)
  const signed = await createCommit(lthash, spaceCtx, keypair)

  return com.atproto.space.defs.signedCommit.build({
    hash: new Uint8Array(signed.hash),
    hmac: new Uint8Array(signed.hmac),
    ikm: new Uint8Array(signed.ikm),
    sig: new Uint8Array(signed.sig),
    rev: signed.rev,
  })
}

export async function fireNotifyWrite(
  ctx: AppContext,
  space: string,
  writerDid: string,
  rev: string,
): Promise<void> {
  const ownerDid = new SpaceUri(space).spaceDid
  try {
    const ownerDidDoc = await ctx.idResolver.did.resolve(ownerDid)
    if (!ownerDidDoc) return
    const ownerPdsUrl = getPdsEndpoint(ownerDidDoc)
    if (!ownerPdsUrl) return

    const keypair = await ctx.actorStore.keypair(writerDid)
    const { headers } = await createServiceAuthHeaders({
      iss: writerDid,
      aud: ownerDid,
      lxm: com.atproto.space.notifyWrite.$lxm,
      keypair,
    })

    xrpc(ownerPdsUrl, com.atproto.space.notifyWrite, {
      headers,
      body: {
        space: space as SpaceUriString,
        did: writerDid as DidString,
        rev,
      },
    }).catch(() => {
      // best-effort notification
    })
  } catch {
    // best-effort notification
  }
}
