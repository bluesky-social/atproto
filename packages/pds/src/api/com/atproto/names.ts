import { Server } from '../../../lexicon'
import { InvalidRequestError } from '@atproto/xrpc-server'
import * as locals from '../../../locals'

export default function (server: Server) {
  server.com.atproto.resolveName((params, _in, _req, res) => {
    const { config, keypair } = locals.get(res)

    let did = ''
    if (!params.name || params.name === config.hostname) {
      // self
      did = keypair.did()
    } else if (params.name.endsWith('.test') && config.testNameRegistry) {
      did = config.testNameRegistry[params.name]
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
