import { Server } from '../../../lexicon'
import * as locals from '../../../locals'
import * as repo from '../../../repo'
import ServerAuth from '../../../auth'

export default function (server: Server) {
  server.com.atproto.blob.upload({
    auth: ServerAuth.verifier,
    handler: async ({ input, res }) => {
      const { db, blobstore } = locals.get(res)

      const cid = await repo.addUntetheredBlob(
        db,
        blobstore,
        input.encoding,
        input.body,
      )

      return {
        encoding: 'application/json',
        body: {
          cid: cid.toString(),
        },
      }
    },
  })
}
