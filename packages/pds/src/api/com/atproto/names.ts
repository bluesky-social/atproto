import { Server } from '../../../lexicon'
import { InvalidRequestError } from '@atproto/xrpc-server'
import * as locals from '../../../locals'

export default function (server: Server) {
  server.com.atproto.resolveName(async (params, _in, _req, res) => {
    const { db, config } = locals.get(res)

    const name = params.name

    let did = ''
    if (!name || name === config.hostname) {
      // self
      did = config.serverDid
    } else {
      const supportedUsername = config.availableUserDomains.some((host) =>
        name.endsWith(host),
      )
      if (!supportedUsername) {
        throw new InvalidRequestError('Not a supported username domain')
      }
      const user = await db.getUser(name)
      if (!user) {
        throw new InvalidRequestError('Unable to resolve namej')
      }
      did = user.did
    }

    return {
      encoding: 'application/json',
      body: { did },
    }
  })
}
