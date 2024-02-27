import { TestNetworkNoAppView, SeedClient } from '@atproto/dev-env'
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
import { readCar } from '@atproto/repo'
import { byFrame, ErrorFrame, Frame, MessageFrame } from '@atproto/xrpc-server'
import { WebSocket } from 'ws'
import {
  Commit as CommitEvt,
  Handle as HandleEvt,
  Tombstone as TombstoneEvt,
} from '../../src/lexicon/types/com/atproto/sync/subscribeRepos'
import { AppContext } from '../../src'
import basicSeed from '../seeds/basic'
import { CID } from 'multiformats/cid'

describe('repo subscribe repos', () => {
  let serverHost: string

  let network: TestNetworkNoAppView
  let ctx: AppContext

  let agent: AtpAgent
  let sc: SeedClient
  let alice: string
  let bob: string
  let carol: string
  let dan: string

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'repo_subscribe_repos',
      pds: {
        repoBackfillLimitMs: HOUR,
      },
    })
    serverHost = network.pds.url.replace('http://', '')
    ctx = network.pds.ctx
    agent = network.pds.getClient()
    sc = network.getSeedClient()
    await basicSeed(sc)
    alice = sc.dids.alice
    bob = sc.dids.bob
    carol = sc.dids.carol
    dan = sc.dids.dan
  })

  afterAll(async () => {
    await network.close()
  })

  const getRepo = async (did: string): Promise<repo.VerifiedRepo> => {
    const carRes = await agent.api.com.atproto.sync.getRepo({ did })
    const car = await repo.readCarWithRoot(carRes.data)
    const signingKey = await network.pds.ctx.actorStore.keypair(did)
    return repo.verifyRepo(car.blocks, car.root, did, signingKey.did())
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

  const getAllEvents = (userDid: string, frames: Frame[]) => {
    const types: unknown[] = []
    for (const frame of frames) {
      if (frame instanceof MessageFrame) {
        if (
          (frame.header.t === '#commit' &&
            (frame.body as CommitEvt).repo === userDid) ||
          (frame.header.t === '#handle' &&
            (frame.body as HandleEvt).did === userDid) ||
          (frame.header.t === '#tombstone' &&
            (frame.body as TombstoneEvt).did === userDid)
        ) {
          types.push(frame.body)
        }
      }
    }
    return types
  }

  const getTombstoneEvts = (frames: Frame[]): TombstoneEvt[] => {
    const evts: TombstoneEvt[] = []
    for (const frame of frames) {
      if (frame instanceof MessageFrame && frame.header.t === '#tombstone') {
        evts.push(frame.body)
      }
    }
    return evts
  }

  const verifyHandleEvent = (evt: unknown, did: string, handle: string) => {
    expect(evt?.['did']).toBe(did)
    expect(evt?.['handle']).toBe(handle)
    expect(typeof evt?.['time']).toBe('string')
    expect(typeof evt?.['seq']).toBe('number')
  }

  const verifyTombstoneEvent = (evt: unknown, did: string) => {
    expect(evt?.['did']).toBe(did)
    expect(typeof evt?.['time']).toBe('string')
    expect(typeof evt?.['seq']).toBe('number')
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
    const fromRpc = await getRepo(did)
    const contents = {} as Record<string, Record<string, CID>>
    const allBlocks = new repo.BlockMap()
    for (const evt of evts) {
      const car = await readCar(evt.blocks)
      allBlocks.addMap(car.blocks)
      for (const op of evt.ops) {
        const { collection, rkey } = repo.parseDataKey(op.path)
        if (op.action === 'delete') {
          delete contents[collection][rkey]
        } else {
          if (op.cid) {
            contents[collection] ??= {}
            contents[collection][rkey] ??= op.cid
          }
        }
      }
    }
    for (const write of fromRpc.creates) {
      expect(contents[write.collection][write.rkey].equals(write.cid)).toBe(
        true,
      )
    }
    const lastCommit = evts.at(-1)?.commit
    if (!lastCommit) {
      throw new Error('no last commit')
    }
    const signingKey = await network.pds.ctx.actorStore.keypair(did)
    const fromStream = await repo.verifyRepo(
      allBlocks,
      lastCommit,
      did,
      signingKey.did(),
    )
    const fromRpcOps = fromRpc.creates
    const fromStreamOps = fromStream.creates
    expect(fromStreamOps.length).toEqual(fromRpcOps.length)
    for (let i = 0; i < fromRpcOps.length; i++) {
      expect(fromStreamOps[i].collection).toEqual(fromRpcOps[i].collection)
      expect(fromStreamOps[i].rkey).toEqual(fromRpcOps[i].rkey)
      expect(fromStreamOps[i].cid).toEqual(fromRpcOps[i].cid)
    }
  }

  const randomPost = (by: string) => sc.post(by, randomStr(8, 'base32'))
  const makePosts = async () => {
    for (let i = 0; i < 10; i++) {
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
      const curr = await ctx.sequencer.curr()
      return evt.body.seq === curr
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

    expect(evts.length).toBe(40)

    await wait(100) // Let cleanup occur on server
    expect(ctx.sequencer.listeners('events').length).toEqual(0)
  })

  it('backfills only from provided cursor', async () => {
    const seqs = await ctx.sequencer.db.db
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
    await sc.updateHandle(bob, 'bob2.test') // idempotent update re-sends

    const ws = new WebSocket(
      `ws://${serverHost}/xrpc/com.atproto.sync.subscribeRepos?cursor=${-1}`,
    )

    const gen = byFrame(ws)
    const evts = await readTillCaughtUp(gen)
    ws.terminate()

    await verifyCommitEvents(evts)
    const handleEvts = getHandleEvts(evts.slice(-6))
    verifyHandleEvent(handleEvts[0], alice, 'alice2.test')
    verifyHandleEvent(handleEvts[1], bob, 'bob2.test')
  })

  it('resends handle events on idempotent updates', async () => {
    const update = sc.updateHandle(bob, 'bob2.test')

    const ws = new WebSocket(
      `ws://${serverHost}/xrpc/com.atproto.sync.subscribeRepos`,
    )

    const gen = byFrame(ws)
    const evts = await readTillCaughtUp(gen, update)
    ws.terminate()

    const handleEvts = getHandleEvts(evts.slice(-2))
    verifyHandleEvent(handleEvts[0], bob, 'bob2.test')
  })

  it('syncs tombstones', async () => {
    const baddie1 = (
      await sc.createAccount('baddie1.test', {
        email: 'baddie1@test.com',
        handle: 'baddie1.test',
        password: 'baddie1-pass',
      })
    ).did
    const baddie2 = (
      await sc.createAccount('baddie2.test', {
        email: 'baddie2@test.com',
        handle: 'baddie2.test',
        password: 'baddie2-pass',
      })
    ).did

    for (const did of [baddie1, baddie2]) {
      await ctx.sequencer.sequenceTombstone(did)
    }

    const ws = new WebSocket(
      `ws://${serverHost}/xrpc/com.atproto.sync.subscribeRepos?cursor=${-1}`,
    )

    const gen = byFrame(ws)
    const evts = await readTillCaughtUp(gen)
    ws.terminate()

    const tombstoneEvts = getTombstoneEvts(evts.slice(-2))
    verifyTombstoneEvent(tombstoneEvts[0], baddie1)
    verifyTombstoneEvent(tombstoneEvts[1], baddie2)
  })

  it('account deletions invalidate all seq ops', async () => {
    const baddie3 = (
      await sc.createAccount('baddie3', {
        email: 'baddie3@test.com',
        handle: 'baddie3.test',
        password: 'baddie3-pass',
      })
    ).did

    await randomPost(baddie3)
    await sc.updateHandle(baddie3, 'baddie3-update.test')
    const token = await network.pds.ctx.accountManager.createEmailToken(
      baddie3,
      'delete_account',
    )
    await agent.api.com.atproto.server.deleteAccount({
      token,
      did: baddie3,
      password: sc.accounts[baddie3].password,
    })

    const ws = new WebSocket(
      `ws://${serverHost}/xrpc/com.atproto.sync.subscribeRepos?cursor=${-1}`,
    )

    const gen = byFrame(ws)
    const evts = await readTillCaughtUp(gen)
    ws.terminate()

    const didEvts = getAllEvents(baddie3, evts)
    expect(didEvts.length).toBe(1)
    verifyTombstoneEvent(didEvts[0], baddie3)
  })

  it('sends info frame on out of date cursor', async () => {
    // we rewrite the sequenceAt time for existing seqs to be past the backfill cutoff
    // then we create some new posts
    const overAnHourAgo = new Date(Date.now() - HOUR - MINUTE).toISOString()
    await ctx.sequencer.db.db
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
    expect(evts.length).toBe(40)
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
