import { getPdsEndpoint } from '@atproto/common'
import { xrpc } from '@atproto/lex'
import { DidString, SpaceUri, SpaceUriString } from '@atproto/syntax'
import { createServiceAuthHeaders } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { com } from '../../../../lexicons/index.js'

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
