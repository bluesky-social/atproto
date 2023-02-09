import AtpAgent from '@atproto/api'
import { HOUR, MINUTE, readFromGenerator, wait } from '@atproto/common'
import { randomStr } from '@atproto/crypto'
import { DidResolver } from '@atproto/did-resolver'
import * as repo from '@atproto/repo'
import { MemoryBlockstore } from '@atproto/repo'
import { byFrame, ErrorFrame } from '@atproto/xrpc-server'
import { WebSocket } from 'ws'
import { RepoAppend } from '../../src/lexicon/types/com/atproto/sync/subscribeAllRepos'
import { Database } from '../../src'
import { SeedClient } from '../seeds/client'
import basicSeed from '../seeds/basic'
import { CloseFn, runTestServer } from '../_util'

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

  const timeAtStart = new Date().toISOString()

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

  const verifyRepo = async (did: string, evts: RepoAppend[]) => {
    const didRepo = await getRepo(did)
    const commits = await didRepo.storage.getCommits(didRepo.cid, null)
    if (!commits) {
      return expect(commits !== null)
    }
    expect(evts.length).toBe(commits.length)
    for (let i = 0; i < commits.length; i++) {
      const commit = commits[i]
      const evt = evts[i]
      expect(evt.repo).toEqual(did)
      expect(evt.commit).toEqual(commit.commit.toString())
      expect(evt.prev).toEqual(commits[i - 1]?.commit?.toString())
      const car = await repo.readCar(evt.blocks as Uint8Array)
      expect(car.root.equals(commit.commit))
      expect(car.blocks.equals(commit.blocks))
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
      `ws://${serverHost}/xrpc/com.atproto.sync.subscribeAllRepos?backfillFrom=${timeAtStart}`,
    )

    const gen = byFrame(ws)
    const evts = await readFromGenerator(gen)
    ws.terminate()

    const byUser = evts.reduce((acc, cur) => {
      const evt = cur.body as RepoAppend
      acc[evt.repo] ??= []
      acc[evt.repo].push(evt)
      return acc
    }, {} as Record<string, RepoAppend[]>)

    await verifyRepo(alice, byUser[alice])
    await verifyRepo(bob, byUser[bob])
    await verifyRepo(carol, byUser[carol])
    await verifyRepo(dan, byUser[dan])
  })

  it('syncs new events', async () => {
    const readAfterDelay = async () => {
      await wait(200) // wait just a hair so that we catch it during cutover
      const ws = new WebSocket(
        `ws://${serverHost}/xrpc/com.atproto.sync.subscribeAllRepos?backfillFrom=${timeAtStart}`,
      )
      const evts = await readFromGenerator(byFrame(ws))
      ws.terminate()
      return evts
    }

    const [evts] = await Promise.all([readAfterDelay(), makePosts()])

    const byUser = evts.reduce((acc, cur) => {
      const evt = cur.body as RepoAppend
      acc[evt.repo] ??= []
      acc[evt.repo].push(evt)
      return acc
    }, {} as Record<string, RepoAppend[]>)

    await verifyRepo(alice, byUser[alice])
    await verifyRepo(bob, byUser[bob])
    await verifyRepo(carol, byUser[carol])
    await verifyRepo(dan, byUser[dan])
  })

  it('handles no backfill & backfill in future', async () => {
    const wsNoBackfill = new WebSocket(
      `ws://${serverHost}/xrpc/com.atproto.sync.subscribeAllRepos`,
    )
    const FUTURE = new Date(Date.now() + 100000).toISOString()
    const wsFuture = new WebSocket(
      `ws://${serverHost}/xrpc/com.atproto.sync.subscribeAllRepos?backfillFrom=${FUTURE}`,
    )

    const makePostsAfterWait = async () => {
      // give them just a second to get subscriptions set up
      await wait(200)
      await makePosts()
    }

    const [noBackfill, future] = await Promise.all([
      // give these generators a little bit more leeway time
      readFromGenerator(byFrame(wsNoBackfill)),
      readFromGenerator(byFrame(wsFuture)),
      makePostsAfterWait(),
    ])

    wsNoBackfill.terminate()
    wsFuture.terminate()

    expect(future.length).toBe(40)
    expect(noBackfill.length).toBe(40)
    expect(noBackfill).toEqual(future)
  })
  it('backfills only from provided time', async () => {
    const seqs = await db.db
      .selectFrom('repo_seq')
      .selectAll()
      .orderBy('seq', 'asc')
      .execute()
    let midPoint = Math.floor(seqs.length / 2)
    let midPointTime = seqs[midPoint].sequencedAt
    // ensure we get the earliest seq with the same timestamp as the midpoint
    while (seqs[midPoint - 1].sequencedAt === midPointTime) {
      midPoint = midPoint - 1
      midPointTime = seqs[midPoint].sequencedAt
    }

    const ws = new WebSocket(
      `ws://${serverHost}/xrpc/com.atproto.sync.subscribeAllRepos?backfillFrom=${midPointTime}`,
    )
    const evts = await readFromGenerator(byFrame(ws))
    ws.terminate()
    const seqSlice = seqs.slice(midPoint)
    expect(evts.length).toBe(seqSlice.length)
    for (let i = 0; i < evts.length; i++) {
      const evt = evts[i].body as RepoAppend
      const seq = seqSlice[i]
      expect(evt.time).toEqual(seq.sequencedAt)
      expect(evt.commit).toEqual(seq.commit)
      expect(evt.repo).toEqual(seq.did)
    }
  })

  it('errors on too old of a backfill', async () => {
    const overAnHourAgo = new Date(Date.now() - HOUR - MINUTE).toISOString()
    const ws = new WebSocket(
      `ws://${serverHost}/xrpc/com.atproto.sync.subscribeAllRepos?backfillFrom=${overAnHourAgo}`,
    )
    const frames = await readFromGenerator(byFrame(ws))
    ws.terminate()
    expect(frames.length).toBe(1)
    expect(frames[0]).toBeInstanceOf(ErrorFrame)
  })
})
