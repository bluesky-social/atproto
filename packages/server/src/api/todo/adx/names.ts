import { Server } from '../../../lexicon'
import { InvalidRequestError } from '@adxp/xrpc-server'
import * as util from '../../../util'

export default function (server: Server) {
  server.todo.adx.resolveName((params, _in, _req, res) => {
    const cfg = util.getConfig(res)

    let did = ''
    if (!params.name || params.name === cfg.hostname) {
      // self
      const keypair = util.getKeypair(res)
      did = keypair.did()
    } else if (params.name.endsWith('.test') && cfg.testNameRegistry) {
      did = cfg.testNameRegistry[params.name]
    } else {
      // @TODO
    }
    if (!did) {
      throw new InvalidRequestError(`Unable to resolve name`)
    }

    return {
      encoding: 'application/json',
      body: { did },
    }
  })
}
