import { randomBytes } from '@atproto/crypto'
import { cborEncode } from '@atproto/common'
import { TestServerInfo, runTestServer } from '../tests/_util'
import { randomCid } from '@atproto/repo/tests/_util'
import { BlockMap, blocksToCarFile } from '@atproto/repo'
import { byFrame } from '@atproto/xrpc-server'
import { WebSocket } from 'ws'
import { Database } from '../src'

describe('sequencer bench', () => {
  let server: TestServerInfo

  let db: Database

  beforeAll(async () => {
    server = await runTestServer({
      dbPostgresSchema: 'sequencer_bench',
      maxSubscriptionBuffer: 20000,
    })
    if (!server.ctx.cfg.dbPostgresUrl) {
      throw new Error('no postgres url')
    }
    db = Database.postgres({
      url: server.ctx.cfg.dbPostgresUrl,
      schema: server.ctx.cfg.dbPostgresSchema,
      txLockNonce: server.ctx.cfg.dbTxLockNonce,
      poolSize: 50,
    })

    server.ctx.sequencerLeader?.destroy()
  })

  afterAll(async () => {
    await server.close()
  })

  const doWrites = async (batches: number, batchSize: number) => {
    const cid = await randomCid()
    const blocks = new BlockMap()
    await blocks.add(randomBytes(500))
    await blocks.add(randomBytes(500))
    await blocks.add(randomBytes(500))
    await blocks.add(randomBytes(500))
    await blocks.add(randomBytes(500))
    await blocks.add(randomBytes(500))

    const car = await blocksToCarFile(cid, blocks)
    const evt = {
      rebase: false,
      tooBig: false,
      repo: 'did:plc:123451234',
      commit: cid,
      prev: cid,
      ops: [{ action: 'create', path: 'app.bsky.feed.post/abcdefg1234', cid }],
      blocks: car,
      blobs: [],
    }
    const encodeEvt = cborEncode(evt)

    const promises: Promise<unknown>[] = []
    for (let i = 0; i < batches; i++) {
      const rows: any[] = []
      for (let j = 0; j < batchSize; j++) {
        rows.push({
          did: 'did:web:example.com',
          eventType: 'append',
          event: encodeEvt,
          sequencedAt: new Date().toISOString(),
        })
      }
      const insert = db.db.insertInto('repo_seq').values(rows).execute()
      promises.push(insert)
    }
    await Promise.all(promises)
  }

  const readAll = async (
    totalToRead: number,
    cursor?: number,
  ): Promise<number> => {
    const serverHost = server.url.replace('http://', '')
    let url = `ws://${serverHost}/xrpc/com.atproto.sync.subscribeRepos`
    if (cursor !== undefined) {
      url += `?cursor=${cursor}`
    }
    const ws = new WebSocket(url)

    let start = Date.now()
    let count = 0
    const gen = byFrame(ws)
    for await (const _frame of gen) {
      if (count === 0) {
        start = Date.now()
      }
      count++
      if (count >= totalToRead) {
        break
      }
    }
    if (count < totalToRead) {
      throw new Error('Did not read full websocket')
    }
    return Date.now() - start
  }

  it('benches', async () => {
    const BATCHES = 100
    const BATCH_SIZE = 100
    const TOTAL = BATCHES * BATCH_SIZE
    const readAllPromise = readAll(TOTAL, 0)

    const start = Date.now()

    await doWrites(BATCHES, BATCH_SIZE)
    const setup = Date.now()

    await server.ctx.sequencerLeader?.sequenceOutgoing()
    const sequencingTime = Date.now() - setup

    const liveTailTime = await readAllPromise
    const backfillTime = await readAll(TOTAL, 0)

    console.log(`
${TOTAL} events
Setup: ${setup - start} ms
Sequencing: ${sequencingTime} ms
Sequencing Rate: ${formatRate(TOTAL, sequencingTime)} evt/s
Live tail: ${liveTailTime} ms
Live tail Rate: ${formatRate(TOTAL, liveTailTime)} evt/s
Backfilled: ${backfillTime} ms
Backfill Rate: ${formatRate(TOTAL, backfillTime)} evt/s`)
  })
})

const formatRate = (evts: number, timeMs: number): string => {
  const evtPerSec = (evts * 1000) / timeMs
  return evtPerSec.toFixed(3)
}
