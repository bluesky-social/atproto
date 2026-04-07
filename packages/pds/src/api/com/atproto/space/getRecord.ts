import { InvalidRequestError, Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { com } from '../../../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.getRecord, {
    auth: ctx.authVerifier.authorization({ authorize: () => {} }),
    handler: async ({ params, auth }) => {
      const did = auth.credentials.did
      const { space, collection, rkey, cid } = params

      const record = await ctx.actorStore.read(did, (store) =>
        store.space.getRecord(space, collection, rkey, cid),
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
          uri: `${space}/${did}/${collection}/${rkey}`,
          cid: record.cid,
          value: record.value,
        },
      }
    },
  })
}
