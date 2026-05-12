import { NsidString } from '@atproto/syntax'
import { InvalidRequestError, Server } from '@atproto/xrpc-server'
import { formatListCursor } from '../../../../actor-store/space/reader'
import { AppContext } from '../../../../context'
import { com } from '../../../../lexicons/index.js'

export default function (server: Server, ctx: AppContext) {
  server.add(com.atproto.space.listRecords, {
    auth: ctx.authVerifier.authorizationOrSpaceCredential({
      authorize: () => {},
    }),
    handler: async ({ params, auth }) => {
      const { space, collection, limit, cursor, reverse, repo } = params

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

      const records = await ctx.actorStore.read(repoDid, (store) =>
        store.space.listRecords(space, {
          limit: limit ?? 50,
          cursor,
          reverse,
          collection,
        }),
      )

      const last = records.at(-1)
      const nextCursor = last
        ? formatListCursor(last.collection, last.rkey)
        : undefined

      return {
        encoding: 'application/json' as const,
        body: {
          cursor: nextCursor,
          records: records.map((r) => ({
            collection: r.collection as NsidString,
            rkey: r.rkey,
            cid: r.cid,
          })),
        },
      }
    },
  })
}
