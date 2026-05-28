import { TID } from '@atproto/common'
import { MemberOpAction, SpaceMembers } from '@atproto/space'
import { SpaceUri } from '@atproto/syntax'
import { InvalidRequestError, Server } from '@atproto/xrpc-server'
import { SqlMembersStorage } from '../../../../actor-store/space/index.js'
import { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { assertSpaceScope } from './util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.createSpace, {
    auth: ctx.authVerifier.authorization({
      authorize: () => {
        // Performed in the handler as it requires the request body
      },
    }),
    handler: async ({ input, auth }) => {
      const did = auth.credentials.did
      const { type, managingApp, isPublic, appAccessMode, appExceptions } =
        input.body
      const skey = input.body.skey ?? TID.nextStr()
      const spaceUri = SpaceUri.make(input.body.did, type, skey)
      const space = spaceUri.toString()
      const isOwner = input.body.did === did

      // createSpace is a space-level "manage" operation.
      assertSpaceScope(auth, space, { action: 'manage' })

      await ctx.actorStore.transact(did, async (actorTxn) => {
        const alreadyExists = await actorTxn.space.getSpace(space)
        if (alreadyExists) {
          throw new InvalidRequestError(
            'Space already exists',
            'SpaceAlreadyExists',
          )
        }
        await actorTxn.space.createSpace(space, isOwner, {
          managingApp,
          isPublic,
          appAccessMode,
          appExceptions,
        })

        if (isOwner) {
          const storage = new SqlMembersStorage(actorTxn.space, space)
          const members = await SpaceMembers.loadOrCreate(storage)
          const commit = await members.formatCommit({
            action: MemberOpAction.Add,
            did,
          })
          await actorTxn.space.applyMemberCommit(space, commit)
          await actorTxn.space.updateMembership(space, true)
        }
      })

      return {
        encoding: 'application/json' as const,
        body: {
          uri: space,
        },
      }
    },
  })
}
