import { getPdsEndpoint } from '@atproto/common'
import { xrpc } from '@atproto/lex'
import { SpaceUri } from '@atproto/syntax'
import {
  InvalidRequestError,
  Server,
  createServiceAuthHeaders,
} from '@atproto/xrpc-server'
import { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { assertSpaceScope } from './util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.deleteSpace, {
    auth: ctx.authVerifier.authorization({
      authorize: () => {
        // Performed in the handler as it requires the request body
      },
    }),
    handler: async ({ input, auth }) => {
      const ownerDid = auth.credentials.did
      const { space } = input.body

      assertSpaceScope(auth, space, { action: 'manage' })

      const spaceDid = new SpaceUri(space).spaceDid
      if (spaceDid !== ownerDid) {
        throw new InvalidRequestError('Not the space owner', 'NotSpaceOwner')
      }

      const spaceRow = await ctx.actorStore.read(ownerDid, (store) =>
        store.space.getSpace(space),
      )
      if (!spaceRow) {
        throw new InvalidRequestError('Space not found', 'SpaceNotFound')
      }
      if (!spaceRow.isOwner) {
        throw new InvalidRequestError('Not the space owner', 'NotSpaceOwner')
      }
      if (spaceRow.deletedAt) {
        // Idempotent: already deleted is fine
        return
      }

      // Snapshot membership + recipients before purge so we can fan out.
      const { members, recipients } = await ctx.actorStore.read(
        ownerDid,
        async (store) => {
          const [members, recipients] = await Promise.all([
            store.space.listMembers(space, { limit: 10000 }),
            store.space.getCredentialRecipients(space),
          ])
          return { members, recipients }
        },
      )

      // Mark deleted and purge owner-scoped data.
      await ctx.actorStore.transact(ownerDid, async (actorTxn) => {
        await actorTxn.space.markSpaceDeleted(space)
        await actorTxn.space.purgeOwnerSpaceData(space)
      })

      // Fan out notifySpaceDeleted to members + credential recipients.
      const keypair = await ctx.actorStore.keypair(ownerDid)
      const notifyTargets: Array<{ aud: string; endpoint: string }> = []
      for (const member of members) {
        try {
          const didDoc = await ctx.idResolver.did.resolve(member.did)
          if (!didDoc) continue
          const pdsUrl = getPdsEndpoint(didDoc)
          if (!pdsUrl) continue
          notifyTargets.push({ aud: member.did, endpoint: pdsUrl })
        } catch {
          // skip members we can't resolve
        }
      }
      for (const recipient of recipients) {
        notifyTargets.push({
          aud: recipient.serviceDid,
          endpoint: recipient.serviceEndpoint,
        })
      }

      for (const target of notifyTargets) {
        try {
          const { headers } = await createServiceAuthHeaders({
            iss: ownerDid,
            aud: target.aud,
            lxm: com.atproto.space.notifySpaceDeleted.$lxm,
            keypair,
          })
          xrpc(target.endpoint, com.atproto.space.notifySpaceDeleted, {
            headers,
            body: { space },
          }).catch(() => {
            // best-effort
          })
        } catch {
          // best-effort
        }
      }
    },
  })
}
