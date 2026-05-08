import { InvalidRequestError, Server } from '@atproto/xrpc-server'
import { AppContext } from '../../../../context'
import { com } from '../../../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.getRecord, {
    auth: ctx.authVerifier.authorizationOrSpaceCredential({
      authorize: () => {},
    }),
    handler: async ({ params, auth }) => {
      const { space, collection, rkey, cid, repo } = params

      let repoDid: string
      if (auth.credentials.type === 'space_credential') {
        if (auth.credentials.space !== space) {
          throw new InvalidRequestError('Credential space mismatch')
        }
        if (!repo) {
          throw new InvalidRequestError(
            'repo is required for space credential auth',
          )
        }
        repoDid = repo
      } else {
        repoDid = repo ?? auth.credentials.did
      }

      const record = await ctx.actorStore.read(repoDid, (store) =>
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
          uri: `${space}/${repoDid}/${collection}/${rkey}`,
          cid: record.cid,
          value: record.value,
        },
      }
    },
  })
}
