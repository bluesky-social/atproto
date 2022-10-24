import { Server } from '../../../lexicon'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { def as common } from '@atproto/common'
import * as locals from '../../../locals'

export default function (server: Server) {
  server.com.atproto.syncGetRoot(async (params, _in, _req, res) => {
    const { did } = params
    const db = locals.db(res)
    const root = await db.getRepoRoot(did)
    if (root === null) {
      throw new InvalidRequestError(`Could not find root for DID: ${did}`)
    }
    return {
      encoding: 'application/json',
      body: { root: root.toString() },
    }
  })

  server.com.atproto.syncGetRepo(async (params, _in, _req, res) => {
    const { did, from = null } = params
    const fromCid = from ? common.strToCid.parse(from) : null
    const repo = await locals.loadRepo(res, did)
    if (repo === null) {
      throw new InvalidRequestError(`Could not find repo for DID: ${did}`)
    }
    const diff = await repo.getDiffCar(fromCid)
    return {
      encoding: 'application/cbor',
      body: Buffer.from(diff),
    }
  })

  server.com.atproto.syncUpdateRepo(async (_params, _input, _req, _res) => {
    throw new InvalidRequestError('Not implemented')
  })
}
