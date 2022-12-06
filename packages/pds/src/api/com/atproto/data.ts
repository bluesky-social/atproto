import { Server } from '../../../lexicon'
import * as locals from '../../../locals'
import * as repo from '../../../repo'
import ServerAuth from '../../../auth'

export default function (server: Server) {
  server.com.atproto.data.uploadFile({
    auth: ServerAuth.verifier,
    handler: async ({ input, req, res }) => {
      const { db, blobstore } = locals.get(res)

      const cid = await repo.addUntetheredBlobStream(
        db,
        blobstore,
        input.encoding,
        req,
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
