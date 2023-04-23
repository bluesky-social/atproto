import AtpAgent from '@atproto/api'
import {
  cborDecode,
  HOUR,
  MINUTE,
  readFromGenerator,
  wait,
} from '@atproto/common'
import { randomStr } from '@atproto/crypto'
import * as repo from '@atproto/repo'
import {
  getWriteLog,
  MemoryBlockstore,
  readCar,
  WriteOpAction,
} from '@atproto/repo'
import { byFrame, ErrorFrame, Frame, MessageFrame } from '@atproto/xrpc-server'
import { WebSocket } from 'ws'
import {
  Commit as CommitEvt,
  Handle as HandleEvt,
} from '../../src/lexicon/types/com/atproto/sync/subscribeRepos'
import { AppContext, Database } from '../../src'
import { SeedClient } from '../seeds/client'
import basicSeed from '../seeds/basic'
import { CloseFn, runTestServer } from '../_util'
import { CID } from 'multiformats/cid'

describe('repo subscribe repos', () => {
  let serverHost: string

  let db: Database
  let ctx: AppContext

  let agent: AtpAgent
  let sc: SeedClient
  let alice: string
  let bob: string
  let carol: string
  let dan: string

  let close: CloseFn

  beforeAll(async () => {
    const server = await runTestServer({
      dbPostgresSchema: 'repo_subscribe_repos',
    })
    serverHost = server.url.replace('http://', '')
    ctx = server.ctx
    db = server.ctx.db
    close = server.close
    agent = new AtpAgent({ service: server.url })
    sc = new SeedClient(agent)
    await basicSeed(sc)
    alice = sc.dids.alice
    bob = sc.dids.bob
    carol = sc.dids.carol
    dan = sc.dids.dan
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
      did,
      ctx.repoSigningKey.did(),
    )
    return repo.Repo.load(storage, synced.root)
  }

  const getHandleEvts = (frames: Frame[]): HandleEvt[] => {
    const evts: HandleEvt[] = []
    for (const frame of frames) {
      if (frame instanceof MessageFrame && frame.header.t === '#handle') {
        evts.push(frame.body)
      }
    }
    return evts
  }

  const verifyHandleEvent = (evt: HandleEvt, did: string, handle: string) => {
    expect(evt.did).toBe(did)
    expect(evt.handle).toBe(handle)
    expect(typeof evt.time).toBe('string')
    expect(typeof evt.seq).toBe('number')
  }

  const getCommitEvents = (userDid: string, frames: Frame[]) => {
    const evts: CommitEvt[] = []
    for (const frame of frames) {
      if (frame instanceof MessageFrame && frame.header.t === '#commit') {
        const body = frame.body as CommitEvt
        if (body.repo === userDid) {
          evts.push(frame.body)
        }
      }
    }
    return evts
  }

  const verifyCommitEvents = async (frames: Frame[]) => {
    await verifyRepo(alice, getCommitEvents(alice, frames))
    await verifyRepo(bob, getCommitEvents(bob, frames))
    await verifyRepo(carol, getCommitEvents(carol, frames))
    await verifyRepo(dan, getCommitEvents(dan, frames))
  }

  const verifyRepo = async (did: string, evts: CommitEvt[]) => {
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
      expect(evt.commit.toString()).toEqual(commit.commit.toString())
      expect(evt.prev?.toString()).toEqual(commits[i - 1]?.commit?.toString())
      const car = await repo.readCarWithRoot(evt.blocks as Uint8Array)
      expect(car.root.equals(commit.commit))
      expect(car.blocks.equals(commit.blocks))
      const writes = writeLog[i].map((w) => ({
        action: w.action,
        path: w.collection + '/' + w.rkey,
        cid: w.action === WriteOpAction.Delete ? null : w.cid.toString(),
      }))
      const sortedOps = evt.ops
        .sort((a, b) => a.path.localeCompare(b.path))
        .map((op) => ({ ...op, cid: op.cid?.toString() ?? null }))
      const sortedWrites = writes.sort((a, b) => a.path.localeCompare(b.path))
      expect(sortedOps).toEqual(sortedWrites)
    }
  }

  const randomPost = (by: string) => sc.post(by, randomStr(8, 'base32'))
  const makePosts = async () => {
    for (let i = 0; i < 3; i++) {
      await Promise.all([
        randomPost(alice),
        randomPost(bob),
        randomPost(carol),
        randomPost(dan),
      ])
    }
  }

  const readTillCaughtUp = async <T>(
    gen: AsyncGenerator<T>,
    waitFor?: Promise<unknown>,
  ) => {
    const isDone = async (evt: any) => {
      if (evt === undefined) return false
      if (evt instanceof ErrorFrame) return true
      const curr = await db.db
        .selectFrom('repo_seq')
        .select('seq')
        .limit(1)
        .orderBy('seq', 'desc')
        .executeTakeFirst()
      return curr !== undefined && evt.body.seq === curr.seq
    }

    return readFromGenerator(gen, isDone, waitFor)
  }

  it('sync backfilled events', async () => {
    const ws = new WebSocket(
      `ws://${serverHost}/xrpc/com.atproto.sync.subscribeRepos?cursor=${-1}`,
    )

    const gen = byFrame(ws)
    const evts = await readTillCaughtUp(gen)
    ws.terminate()

    await verifyCommitEvents(evts)
  })

  it('syncs new events', async () => {
    const postPromise = makePosts()

    const readAfterDelay = async () => {
      await wait(200) // wait just a hair so that we catch it during cutover
      const ws = new WebSocket(
        `ws://${serverHost}/xrpc/com.atproto.sync.subscribeRepos?cursor=${-1}`,
      )
      const evts = await readTillCaughtUp(byFrame(ws), postPromise)
      ws.terminate()
      return evts
    }

    const [evts] = await Promise.all([readAfterDelay(), postPromise])

    await verifyCommitEvents(evts)
  })

  it('handles no backfill', async () => {
    const ws = new WebSocket(
      `ws://${serverHost}/xrpc/com.atproto.sync.subscribeRepos`,
    )

    const makePostsAfterWait = async () => {
      // give them just a second to get subscriptions set up
      await wait(200)
      await makePosts()
    }

    const postPromise = makePostsAfterWait()

    const [evts] = await Promise.all([
      readTillCaughtUp(byFrame(ws), postPromise),
      postPromise,
    ])

    ws.terminate()

    expect(evts.length).toBe(12)

    await wait(100) // Let cleanup occur on server
    expect(ctx.sequencer.listeners('events').length).toEqual(0)
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
      `ws://${serverHost}/xrpc/com.atproto.sync.subscribeRepos?cursor=${midPointSeq}`,
    )
    const evts = await readTillCaughtUp(byFrame(ws))
    ws.terminate()
    const seqSlice = seqs.slice(midPoint + 1)
    expect(evts.length).toBe(seqSlice.length)
    for (let i = 0; i < evts.length; i++) {
      const evt = evts[i].body as CommitEvt
      const seq = seqSlice[i]
      const seqEvt = cborDecode(seq.event) as { commit: CID }
      expect(evt.time).toEqual(seq.sequencedAt)
      expect(evt.commit.equals(seqEvt.commit)).toBeTruthy()
      expect(evt.repo).toEqual(seq.did)
    }
  })

  it('syncs handle changes', async () => {
    await sc.updateHandle(alice, 'alice2.test')
    await sc.updateHandle(bob, 'bob2.test')

    const ws = new WebSocket(
      `ws://${serverHost}/xrpc/com.atproto.sync.subscribeRepos?cursor=${-1}`,
    )

    const gen = byFrame(ws)
    const evts = await readTillCaughtUp(gen)
    ws.terminate()

    await verifyCommitEvents(evts)
    const handleEvts = getHandleEvts(evts.slice(-2))
    verifyHandleEvent(handleEvts[0], alice, 'alice2.test')
    verifyHandleEvent(handleEvts[1], bob, 'bob2.test')
  })

  it('does not return invalidated events', async () => {
    await sc.updateHandle(alice, 'alice3.test')
    await sc.updateHandle(alice, 'alice4.test')
    await sc.updateHandle(alice, 'alice5.test')
    await sc.updateHandle(bob, 'bob3.test')
    await sc.updateHandle(bob, 'bob4.test')
    await sc.updateHandle(bob, 'bob5.test')

    const ws = new WebSocket(
      `ws://${serverHost}/xrpc/com.atproto.sync.subscribeRepos?cursor=${-1}`,
    )

    const gen = byFrame(ws)
    const evts = await readTillCaughtUp(gen)
    ws.terminate()

    const handleEvts = getHandleEvts(evts)
    expect(handleEvts.length).toBe(2)
    verifyHandleEvent(handleEvts[0], alice, 'alice5.test')
    verifyHandleEvent(handleEvts[1], bob, 'bob5.test')
  })

  it('sync rebases', async () => {
    const prevHead = await agent.api.com.atproto.sync.getHead({ did: alice })
    await ctx.db.transaction((dbTxn) =>
      ctx.services.repo(dbTxn).rebaseRepo(alice, new Date().toISOString()),
    )
    const currHead = await agent.api.com.atproto.sync.getHead({ did: alice })

    const ws = new WebSocket(
      `ws://${serverHost}/xrpc/com.atproto.sync.subscribeRepos?cursor=${-1}`,
    )

    const gen = byFrame(ws)
    const frames = await readTillCaughtUp(gen)
    ws.terminate()

    const aliceEvts = getCommitEvents(alice, frames)
    expect(aliceEvts.length).toBe(1)
    const evt = aliceEvts[0]
    expect(evt.rebase).toBe(true)
    expect(evt.tooBig).toBe(false)
    expect(evt.commit.toString()).toEqual(currHead.data.root)
    expect(evt.prev?.toString()).toEqual(prevHead.data.root)
    expect(evt.ops).toEqual([])
    expect(evt.blobs).toEqual([])
    const car = await readCar(evt.blocks)
    expect(car.blocks.size).toBe(1)
    expect(car.roots.length).toBe(1)
    expect(car.roots[0].toString()).toEqual(currHead.data.root)

    // did not affect other users
    const bobEvts = getCommitEvents(bob, frames)
    expect(bobEvts.length).toBeGreaterThan(10)
  })

  it('sends info frame on out of date cursor', async () => {
    // we rewrite the sequenceAt time for existing seqs to be past the backfill cutoff
    // then we create some new posts
    const overAnHourAgo = new Date(Date.now() - HOUR - MINUTE).toISOString()
    await db.db
      .updateTable('repo_seq')
      .set({ sequencedAt: overAnHourAgo })
      .execute()

    await makePosts()

    const ws = new WebSocket(
      `ws://${serverHost}/xrpc/com.atproto.sync.subscribeRepos?cursor=${-1}`,
    )
    const [info, ...evts] = await readTillCaughtUp(byFrame(ws))
    ws.terminate()

    if (!(info instanceof MessageFrame)) {
      throw new Error('Expected first frame to be a MessageFrame')
    }
    expect(info.header.t).toBe('#info')
    const body = info.body as Record<string, unknown>
    expect(body.name).toEqual('OutdatedCursor')
    expect(evts.length).toBe(12)
  })

  it('errors on future cursor', async () => {
    const ws = new WebSocket(
      `ws://${serverHost}/xrpc/com.atproto.sync.subscribeRepos?cursor=${100000}`,
    )
    const frames = await readTillCaughtUp(byFrame(ws))
    ws.terminate()
    expect(frames.length).toBe(1)
    if (!(frames[0] instanceof ErrorFrame)) {
      throw new Error('Expected ErrorFrame')
    }
    expect(frames[0].body.error).toBe('FutureCursor')
  })
})
