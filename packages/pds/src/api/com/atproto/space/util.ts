import { getPdsEndpoint } from '@atproto/common'
import { xrpc } from '@atproto/lex'
import { SpacePermissionMatch } from '@atproto/oauth-scopes'
import { DidString, SpaceUri, SpaceUriString } from '@atproto/syntax'
import { createServiceAuthHeaders } from '@atproto/xrpc-server'
import {
  AccessOutput,
  OAuthOutput,
  SpaceCredentialOutput,
} from '../../../../auth-output'
import { AppContext } from '../../../../context'
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
