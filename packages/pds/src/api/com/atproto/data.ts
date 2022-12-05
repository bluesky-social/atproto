import { Server } from '../../../lexicon'
import { AuthRequiredError } from '@atproto/xrpc-server'
import * as locals from '../../../locals'
import * as repo from '../../../repo'

export default function (server: Server) {
  server.com.atproto.data.uploadFile(async (_params, input, req, res) => {
    const { db, blobstore, auth } = locals.get(res)

    const requester = auth.getUserDid(req)
    if (!requester) {
      throw new AuthRequiredError()
    }
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
  })
}
