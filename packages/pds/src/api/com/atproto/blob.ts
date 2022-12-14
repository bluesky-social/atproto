import { Server } from '../../../lexicon'
import * as locals from '../../../locals'
import ServerAuth from '../../../auth'

export default function (server: Server) {
  server.com.atproto.blob.upload({
    auth: ServerAuth.verifier,
    handler: async ({ input, res }) => {
      const { db, services } = locals.get(res)

      const cid = await services
        .repo(db)
        .blobs.addUntetheredBlob(input.encoding, input.body)

      return {
        encoding: 'application/json',
        body: {
          cid: cid.toString(),
        },
      }
    },
  })
}
