import { Server } from '../../../lexicon'
import { AuthRequiredError } from '@atproto/xrpc-server'
import * as locals from '../../../locals'

export default function (server: Server) {
  server.com.atproto.data.uploadFile(async (_params, input, req, res) => {
    const { repoStorage, auth } = locals.get(res)

    const requester = auth.getUserDid(req)
    if (!requester) {
      throw new AuthRequiredError()
    }

    const cid = await repoStorage.addUntetheredBlob(
      requester,
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
