import { Server } from '../../../xrpc'
import * as util from '../../../util'

export default function (server: Server) {
  server.todo.adx.resolveName((_params, _in, _req, res) => {
    const keypair = util.getKeypair(res)
    // Return the server's did
    // TODO check params.name
    return {
      encoding: 'application/json',
      body: { did: keypair.did() },
    }
  })
}
