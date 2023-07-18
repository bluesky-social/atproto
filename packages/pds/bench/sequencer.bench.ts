import { randomBytes } from '@atproto/crypto'
import { cborEncode } from '@atproto/common'
import { TestServerInfo, runTestServer } from '../tests/_util'
import { randomCid } from '@atproto/repo/tests/_util'
import { BlockMap, blocksToCarFile } from '@atproto/repo'
import { byFrame } from '@atproto/xrpc-server'
import { WebSocket } from 'ws'

describe('sequencer bench', () => {
  let server: TestServerInfo

  beforeAll(async () => {
    server = await runTestServer({
      dbPostgresSchema: 'sequencer_bench',
    })
  })

  afterAll(async () => {
    await server.close()
  })

  it('benches', async () => {
    server.ctx.sequencerLeader?.destroy()

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

    const BATCHES = 100
    const BATCH_SIZE = 100
    const TOTAL = BATCHES * BATCH_SIZE

    const readAll = async (cursor?: number): Promise<number> => {
      const serverHost = server.url.replace('http://', '')
      let url = `ws://${serverHost}/xrpc/com.atproto.sync.subscribeRepos`
      if (cursor !== undefined) {
        url += `?cursor=${cursor}`
      }
      const ws = new WebSocket(url)

      let count = 0
      const gen = byFrame(ws)
      for await (const _frame of gen) {
        count++
        if (count >= TOTAL) {
          break
        }
      }
      return count
    }

    const readAllPromise = readAll()

    const start = Date.now()
    await server.ctx.db.transaction(async (dbTxn) => {
      for (let i = 0; i < BATCHES; i++) {
        const rows: any[] = []
        for (let j = 0; j < BATCH_SIZE; j++) {
          rows.push({
            did: 'did:web:example.com',
            eventType: 'append',
            event: encodeEvt,
            sequencedAt: new Date().toISOString(),
          })
        }
        await dbTxn.db.insertInto('repo_seq').values(rows).execute()
      }
    })

    const setup = Date.now()

    await server.ctx.sequencerLeader?.sequenceOutgoing()
    const sequenced = Date.now()

    await readAllPromise
    const consumed = Date.now()

    await readAll(0)
    const backfilled = Date.now()

    console.log(`
${TOTAL} events
Setup: ${setup - start} ms
Sequencing: ${sequenced - setup} ms
Live tail: ${consumed - sequenced} ms
Backfilled: ${backfilled - consumed} ms`)
  })
})
