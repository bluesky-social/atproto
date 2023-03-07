import AtpAgent from '@atproto/api'
import {
  cidForCbor,
  HOUR,
  MINUTE,
  readFromGenerator,
  wait,
} from '@atproto/common'
import { randomStr } from '@atproto/crypto'
import { DidResolver } from '@atproto/did-resolver'
import * as repo from '@atproto/repo'
import { getWriteLog, MemoryBlockstore, WriteOpAction } from '@atproto/repo'
import { byFrame, ErrorFrame, Frame, InfoFrame } from '@atproto/xrpc-server'
import { WebSocket } from 'ws'
import { OutputSchema as RepoEvent } from '../../src/lexicon/types/com/atproto/sync/subscribeAllRepos'
import { Database } from '../../src'
import { SeedClient } from '../seeds/client'
import basicSeed from '../seeds/basic'
import { CloseFn, runTestServer } from '../_util'
import { sql } from 'kysely'

describe('repo subscribe all repos', () => {
  let serverHost: string

  let db: Database

  let didResolver: DidResolver
  let agent: AtpAgent
  let sc: SeedClient
  let alice: string
  let bob: string
  let carol: string
  let dan: string

  let close: CloseFn

  beforeAll(async () => {
    const server = await runTestServer({
      dbPostgresSchema: 'repo_subscribe_all_repos',
    })
    serverHost = server.url.replace('http://', '')
    db = server.ctx.db
    close = server.close
    agent = new AtpAgent({ service: server.url })
    sc = new SeedClient(agent)
    await basicSeed(sc)
    alice = sc.dids.alice
    bob = sc.dids.bob
    carol = sc.dids.carol
    dan = sc.dids.dan
    didResolver = new DidResolver({ plcUrl: server.ctx.cfg.didPlcUrl })
  })

  afterAll(async () => {
    await close()
  })

  const getRepo = async (did: string) => {
    const car = await agent.api.com.atproto.sync.getRepo({ did })
    const storage = new MemoryBlockstore()
    const synced = await repo.loadFullRepo(
      storage,
      new Uint8Array(car.data),
      didResolver,
    )
    return repo.Repo.load(storage, synced.root)
  }

  const verifyEvents = async (evts: Frame[]) => {
    const byUser = evts.reduce((acc, cur) => {
      const evt = cur.body as RepoEvent
      acc[evt.repo] ??= []
      acc[evt.repo].push(evt)
      return acc
    }, {} as Record<string, RepoEvent[]>)

    await verifyRepo(alice, byUser[alice])
    await verifyRepo(bob, byUser[bob])
    await verifyRepo(carol, byUser[carol])
    await verifyRepo(dan, byUser[dan])
  }

  const verifyRepo = async (did: string, evts: RepoEvent[]) => {
    const didRepo = await getRepo(did)
    const writeLog = await getWriteLog(didRepo.storage, didRepo.cid, null)
    const commits = await didRepo.storage.getCommits(didRepo.cid, null)
    if (!commits) {
      return expect(commits !== null)
    }
    expect(evts.length).toBe(commits.length)
    expect(evts.length).toBe(writeLog.length)
    for (let i = 0; i < commits.length; i++) {
      const commit = commits[i]
      const evt = evts[i]
      expect(evt.repo).toEqual(did)
      expect(evt.commit).toEqual(commit.commit.toString())
      expect(evt.prev).toEqual(commits[i - 1]?.commit?.toString() ?? null)
      const car = await repo.readCarWithRoot(evt.blocks as Uint8Array)
      expect(car.root.equals(commit.commit))
      expect(car.blocks.equals(commit.blocks))
      const writes = writeLog[i].map((w) => ({
        action: w.action,
        path: w.collection + '/' + w.rkey,
        cid: w.action === WriteOpAction.Delete ? null : w.cid.toString(),
      }))
      const sortedOps = evt.ops.sort((a, b) => a.path.localeCompare(b.path))
      const sortedWrites = evt.ops.sort((a, b) => a.path.localeCompare(b.path))
      expect(sortedOps).toEqual(sortedWrites)
    }
  }

  const randomPost = async (by: string) => sc.post(by, randomStr(8, 'base32'))
  const makePosts = async () => {
    const promises: Promise<unknown>[] = []
    for (let i = 0; i < 10; i++) {
      promises.push(randomPost(alice))
      promises.push(randomPost(bob))
      promises.push(randomPost(carol))
      promises.push(randomPost(dan))
    }
    await Promise.all(promises)
  }

  it('sync backfilled events', async () => {
    const ws = new WebSocket(
      `ws://${serverHost}/xrpc/com.atproto.sync.subscribeAllRepos?cursor=${-1}`,
    )

    const gen = byFrame(ws)
    const evts = await readFromGenerator(gen)
    ws.terminate()

    await verifyEvents(evts)
  })

  it('syncs new events', async () => {
    const readAfterDelay = async () => {
      await wait(200) // wait just a hair so that we catch it during cutover
      const ws = new WebSocket(
        `ws://${serverHost}/xrpc/com.atproto.sync.subscribeAllRepos?cursor=${-1}`,
      )
      const evts = await readFromGenerator(byFrame(ws))
      ws.terminate()
      return evts
    }

    const [evts] = await Promise.all([readAfterDelay(), makePosts()])

    await verifyEvents(evts)
  })

  it('handles no backfill', async () => {
    const ws = new WebSocket(
      `ws://${serverHost}/xrpc/com.atproto.sync.subscribeAllRepos`,
    )

    const makePostsAfterWait = async () => {
      // give them just a second to get subscriptions set up
      await wait(200)
      await makePosts()
    }

    const [evts] = await Promise.all([
      readFromGenerator(byFrame(ws)),
      makePostsAfterWait(),
    ])

    ws.terminate()

    expect(evts.length).toBe(40)
  })

  it('backfills only from provided cursor', async () => {
    const seqs = await db.db
      .selectFrom('repo_seq')
      .selectAll()
      .orderBy('seq', 'asc')
      .execute()
    const midPoint = Math.floor(seqs.length / 2)
    const midPointSeq = seqs[midPoint].seq

    const ws = new WebSocket(
      `ws://${serverHost}/xrpc/com.atproto.sync.subscribeAllRepos?cursor=${midPointSeq}`,
    )
    const evts = await readFromGenerator(byFrame(ws))
    ws.terminate()
    const seqSlice = seqs.slice(midPoint + 1)
    expect(evts.length).toBe(seqSlice.length)
    for (let i = 0; i < evts.length; i++) {
      const evt = evts[i].body as RepoEvent
      const seq = seqSlice[i]
      expect(evt.time).toEqual(seq.sequencedAt)
      expect(evt.commit).toEqual(seq.commit)
      expect(evt.repo).toEqual(seq.did)
    }
  })

  it('sends info frame on out of date cursor', async () => {
    // we stick three new seqs in with a date past the backfill cutoff
    // then we increment the sequence number of everything else to test out of date cursor
    const cid = await cidForCbor({ test: 123 })
    const overAnHourAgo = new Date(Date.now() - HOUR - MINUTE).toISOString()
    const dummySeq = {
      did: 'did:example:test',
      commit: cid.toString(),
      eventType: 'repo_append' as const,
      sequencedAt: overAnHourAgo,
    }
    const newRows = await db.db
      .insertInto('repo_seq')
      .values([dummySeq, dummySeq, dummySeq])
      .returning('seq')
      .execute()
    const newSeqs = newRows.map((r) => r.seq)
    const movedToFuture = await db.db
      .updateTable('repo_seq')
      .set({ seq: sql`seq+1000` })
      .where('seq', 'not in', newSeqs)
      .returning('seq')
      .execute()

    const ws = new WebSocket(
      `ws://${serverHost}/xrpc/com.atproto.sync.subscribeAllRepos?cursor=${newSeqs[0]}`,
    )
    const [info, ...evts] = await readFromGenerator(byFrame(ws))
    ws.terminate()

    if (!(info instanceof InfoFrame)) {
      throw new Error('Expected first frame to be an InfoFrame')
    }
    expect(info.code).toBe('OutdatedCursor')
    expect(evts.length).toBe(movedToFuture.length)
  })

  it('errors on future cursor', async () => {
    const ws = new WebSocket(
      `ws://${serverHost}/xrpc/com.atproto.sync.subscribeAllRepos?cursor=${100000}`,
    )
    const frames = await readFromGenerator(byFrame(ws))
    ws.terminate()
    expect(frames.length).toBe(1)
    if (!(frames[0] instanceof ErrorFrame)) {
      throw new Error('Expected ErrorFrame')
    }
    expect(frames[0].body.error).toBe('FutureCursor')
  })
})
