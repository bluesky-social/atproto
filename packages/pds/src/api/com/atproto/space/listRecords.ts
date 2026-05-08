import { NsidString } from '@atproto/syntax'
import { InvalidRequestError, Server } from '@atproto/xrpc-server'
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

      if (collection) {
        const records = await ctx.actorStore.read(repoDid, (store) =>
          store.space.listRecords(space, collection, {
            limit: limit ?? 50,
            cursor,
            reverse,
          }),
        )
        return {
          encoding: 'application/json' as const,
          body: {
            cursor: records.at(-1)?.rkey,
            records: records.map((r) => ({
              collection,
              rkey: r.rkey,
              cid: r.cid,
            })),
          },
        }
      }

      // List across all collections
      const collections = await ctx.actorStore.read(repoDid, (store) =>
        store.space.listCollections(space),
      )
      const allRecords: {
        collection: NsidString
        rkey: string
        cid: string
      }[] = []
      for (const col of collections) {
        const records = await ctx.actorStore.read(repoDid, (store) =>
          store.space.listRecords(space, col, {
            limit: limit ?? 50,
          }),
        )
        for (const r of records) {
          allRecords.push({
            collection: col as NsidString,
            rkey: r.rkey,
            cid: r.cid,
          })
        }
      }
      return {
        encoding: 'application/json' as const,
        body: {
          records: allRecords,
        },
      }
    },
  })
}
