import { InvalidRequestError, Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context.js'
import { com } from '../../../../lexicons/index.js'
import { spaceRecordUri } from '../../../../repo/index.js'
import { assertSpaceRead } from './util.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.getRecord, {
    auth: ctx.authVerifier.authorizationOrSpaceCredential({
      authorize: () => {
        // Performed in the handler as it requires the `space` param
      },
    }),
    handler: async ({ params, auth }) => {
      const { space, repo, collection, rkey } = params

      assertSpaceRead(auth, space, repo)

      const record = await ctx.actorStore.read(repo, (store) =>
        store.space.getRecord(space, collection, rkey),
      )
      if (!record) {
        throw new InvalidRequestError(
          `Could not locate record: ${space}/${collection}/${rkey}`,
          'RecordNotFound',
        )
      }

      return {
        encoding: 'application/json' as const,
        body: {
          uri: spaceRecordUri(space, repo, collection, rkey).toString(),
          cid: record.cid,
          value: record.value,
        },
      }
    },
  })
}
