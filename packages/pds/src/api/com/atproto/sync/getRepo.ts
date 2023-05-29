import { CID } from 'multiformats/cid'
import * as repo from '@atproto/repo'
import { InvalidRequestError } from '@atproto/xrpc-server'
import { Server } from '../../../../lexicon'
import SqlRepoStorage from '../../../../sql-repo-storage'
import AppContext from '../../../../context'
import { byteIterableToStream, chunkArray } from '@atproto/common'

export default function (server: Server, ctx: AppContext) {
  server.com.atproto.sync.getRepo(async ({ params }) => {
    const { did } = params
    const storage = new SqlRepoStorage(ctx.db, did)
    const earliest = params.earliest ? CID.parse(params.earliest) : null
    const latest = params.latest
      ? CID.parse(params.latest)
      : await storage.getHead()
    if (latest === null) {
      throw new InvalidRequestError(`Could not find repo for DID: ${did}`)
    }
    const commitPath = await storage.getCommitPath(latest, earliest)
    if (commitPath === null) {
      throw new InvalidRequestError(`Could not find shared history`)
    }

    const commitChunks = chunkArray(commitPath, 25)
    const carStream = repo.writeCar(latest, async (car) => {
      for (const chunk of commitChunks) {
        const blocks = await storage.getAllBlocksForCommits(chunk)
        for (const block of blocks) {
          await car.put({ cid: block.cid, bytes: block.bytes })
        }
      }
    })

    return {
      encoding: 'application/vnd.ipld.car',
      body: byteIterableToStream(carStream),
    }
  })
}
