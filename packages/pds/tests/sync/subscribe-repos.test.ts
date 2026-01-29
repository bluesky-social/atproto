import { CID } from 'multiformats/cid'
import { WebSocket } from 'ws'
import { AtpAgent } from '@atproto/api'
import {
  HOUR,
  MINUTE,
  cborDecode,
  readFromGenerator,
  wait,
} from '@atproto/common'
import { randomStr } from '@atproto/crypto'
import { SeedClient, TestNetworkNoAppView } from '@atproto/dev-env'
import * as repo from '@atproto/repo'
import { readCar } from '@atproto/repo'
import { ErrorFrame, Frame, MessageFrame, byFrame } from '@atproto/xrpc-server'
import { AppContext } from '../../src'
import { AccountStatus } from '../../src/account-manager/account-manager'
import {
  Account as AccountEvt,
  Commit as CommitEvt,
  Identity as IdentityEvt,
  Sync as SyncEvt,
} from '../../src/lexicon/types/com/atproto/sync/subscribeRepos'
import basicSeed from '../seeds/basic'

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
    // @ts-expect-error Error due to circular dependency with the dev-env package
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

  const getAllEvents = (userDid: string, frames: Frame[]) => {
    const types: unknown[] = []
    for (const frame of frames) {
      if (frame instanceof MessageFrame) {
        if (
          (frame.header.t === '#commit' &&
            (frame.body as CommitEvt).repo === userDid) ||
          (frame.header.t === '#sync' &&
            (frame.body as SyncEvt).did === userDid) ||
          (frame.header.t === '#identity' &&
            (frame.body as IdentityEvt).did === userDid) ||
          (frame.header.t === '#account' &&
            (frame.body as AccountEvt).did === userDid)
        ) {
          types.push(frame.body)
        }
      }
    }
    return types
  }

  const getEventType = <T>(frames: Frame[], type: string): T[] => {
    const evts: T[] = []
    for (const frame of frames) {
      if (frame instanceof MessageFrame && frame.header.t === type) {
        evts.push(frame.body)
      }
    }
    return evts
  }

  const getSyncEvts = (frames: Frame[]): SyncEvt[] => {
    return getEventType(frames, '#sync')
  }

  const getAccountEvts = (frames: Frame[]): AccountEvt[] => {
    return getEventType(frames, '#account')
  }

  const getIdentityEvts = (frames: Frame[]): IdentityEvt[] => {
    return getEventType(frames, '#identity')
  }

  const getCommitEvents = (frames: Frame[]): CommitEvt[] => {
    return getEventType(frames, '#commit')
  }

  const verifyIdentityEvent = (
    evt: IdentityEvt,
    did: string,
    handle?: string,
  ) => {
    expect(typeof evt.seq).toBe('number')
    expect(evt.did).toBe(did)
    expect(typeof evt.time).toBe('string')
    expect(evt.handle).toEqual(handle)
  }

  const verifyAccountEvent = (
    evt: AccountEvt,
    did: string,
    active: boolean,
    status?: AccountStatus,
  ) => {
    expect(typeof evt.seq).toBe('number')
    expect(evt.did).toBe(did)
    expect(typeof evt.time).toBe('string')
    expect(evt.active).toBe(active)
    expect(evt.status).toBe(status)
  }

  const verifySyncEvent = async (
    evt: SyncEvt,
    did: string,
    commit: CID,
    rev: string,
  ) => {
    expect(typeof evt.seq).toBe('number')
    expect(evt.did).toBe(did)
    expect(typeof evt.time).toBe('string')
    expect(evt.rev).toBe(rev)
    const car = await repo.readCarWithRoot(evt.blocks)
    expect(car.root.equals(commit)).toBe(true)
    expect(car.blocks.size).toBe(1)
    expect(car.blocks.has(car.root)).toBe(true)
  }

  const verifyCommitEvents = async (frames: Frame[]) => {
    const forUser = (user: string) => (commit: CommitEvt) =>
      commit.repo === user
    const commits = getCommitEvents(frames)
    await verifyRepo(alice, commits.filter(forUser(alice)))
    await verifyRepo(bob, commits.filter(forUser(bob)))
    await verifyRepo(carol, commits.filter(forUser(carol)))
    await verifyRepo(dan, commits.filter(forUser(dan)))
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

  it('emits sync event on account creation, matching temporary commit event.', async () => {
    const ws = new WebSocket(
      `ws://${serverHost}/xrpc/com.atproto.sync.subscribeRepos?cursor=${-1}`,
    )

    const gen = byFrame(ws)
    const evts = await readTillCaughtUp(gen)
    ws.terminate()

    const syncEvts = getSyncEvts(evts)
    const commitEvts = getCommitEvents(evts).slice(0, 4)
    expect(syncEvts.length).toBe(4)

    let i = 0
    for (const did of [alice, bob, carol, dan]) {
      const syncEvt = syncEvts[i]
      const commitEvt = commitEvts[i]
      await verifySyncEvent(syncEvt, did, commitEvt.commit, commitEvt.rev)
      i++
    }
  })

  it('sync backfilled events', async () => {
    const ws = new WebSocket(
      `ws://${serverHost}/xrpc/com.atproto.sync.subscribeRepos?cursor=${-1}`,
    )

    const gen = byFrame(ws)
    const evts = await readTillCaughtUp(gen)
    ws.terminate()

    await verifyCommitEvents(evts)

    const accountEvts = getAccountEvts(evts)
    expect(accountEvts.length).toBe(4)
    verifyAccountEvent(accountEvts[0], alice, true)
    verifyAccountEvent(accountEvts[1], bob, true)
    verifyAccountEvent(accountEvts[2], carol, true)
    verifyAccountEvent(accountEvts[3], dan, true)
    const identityEvts = getIdentityEvts(evts)
    expect(identityEvts.length).toBe(4)
    verifyIdentityEvent(identityEvts[0], alice, 'alice.test')
    verifyIdentityEvent(identityEvts[1], bob, 'bob.test')
    verifyIdentityEvent(identityEvts[2], carol, 'carol.test')
    verifyIdentityEvent(identityEvts[3], dan, 'dan.test')
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
      const evt = evts[i].body as unknown as CommitEvt
      const seq = seqSlice[i]
      const seqEvt = cborDecode(seq.event) as { commit: CID }
      expect(evt.time).toEqual(seq.sequencedAt)
      expect(evt.commit.equals(seqEvt.commit)).toBeTruthy()
      expect(evt.repo).toEqual(seq.did)
    }
  })

  it('syncs handle changes (identity evts)', async () => {
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

    const identityEvts = getIdentityEvts(evts.slice(-3))
    expect(identityEvts.length).toBe(3)
    verifyIdentityEvent(identityEvts[0], alice, 'alice2.test')
    verifyIdentityEvent(identityEvts[1], bob, 'bob2.test')
    verifyIdentityEvent(identityEvts[2], bob, 'bob2.test')
  })

  it('resends identity events on idempotent updates', async () => {
    const update = sc.updateHandle(bob, 'bob2.test')

    const ws = new WebSocket(
      `ws://${serverHost}/xrpc/com.atproto.sync.subscribeRepos`,
    )

    const gen = byFrame(ws)
    const evts = await readTillCaughtUp(gen, update)
    ws.terminate()

    const identityEvts = getIdentityEvts(evts.slice(-1))
    verifyIdentityEvent(identityEvts[0], bob, 'bob2.test')
  })

  it('syncs account events', async () => {
    // deactivate then reactivate alice
    await agent.api.com.atproto.server.deactivateAccount(
      {},
      {
        encoding: 'application/json',
        headers: sc.getHeaders(alice),
      },
    )
    await agent.api.com.atproto.server.activateAccount(undefined, {
      headers: sc.getHeaders(alice),
    })

    // takedown then restore bob
    await agent.api.com.atproto.admin.updateSubjectStatus(
      {
        subject: {
          $type: 'com.atproto.admin.defs#repoRef',
          did: bob,
        },
        takedown: { applied: true },
      },
      {
        encoding: 'application/json',
        headers: network.pds.adminAuthHeaders(),
      },
    )
    await agent.api.com.atproto.admin.updateSubjectStatus(
      {
        subject: {
          $type: 'com.atproto.admin.defs#repoRef',
          did: bob,
        },
        takedown: { applied: false },
      },
      {
        encoding: 'application/json',
        headers: network.pds.adminAuthHeaders(),
      },
    )

    const ws = new WebSocket(
      `ws://${serverHost}/xrpc/com.atproto.sync.subscribeRepos?cursor=${-1}`,
    )

    const gen = byFrame(ws)
    const evts = await readTillCaughtUp(gen)
    ws.terminate()

    // @NOTE requires a larger slice because of over-emission on activateAccount - see note on route
    const accountEvts = getAccountEvts(evts.slice(-6))
    expect(accountEvts.length).toBe(4)
    verifyAccountEvent(accountEvts[0], alice, false, AccountStatus.Deactivated)
    verifyAccountEvent(accountEvts[1], alice, true)
    verifyAccountEvent(accountEvts[2], bob, false, AccountStatus.Takendown)
    verifyAccountEvent(accountEvts[3], bob, true)
  })

  it('syncs interleaved account events', async () => {
    // deactivate -> takedown -> restore -> activate
    // deactivate then reactivate alice
    await agent.api.com.atproto.server.deactivateAccount(
      {},
      {
        encoding: 'application/json',
        headers: sc.getHeaders(alice),
      },
    )
    await agent.api.com.atproto.admin.updateSubjectStatus(
      {
        subject: {
          $type: 'com.atproto.admin.defs#repoRef',
          did: alice,
        },
        takedown: { applied: true },
      },
      {
        encoding: 'application/json',
        headers: network.pds.adminAuthHeaders(),
      },
    )
    await agent.api.com.atproto.admin.updateSubjectStatus(
      {
        subject: {
          $type: 'com.atproto.admin.defs#repoRef',
          did: alice,
        },
        takedown: { applied: false },
      },
      {
        encoding: 'application/json',
        headers: network.pds.adminAuthHeaders(),
      },
    )
    await agent.api.com.atproto.server.activateAccount(undefined, {
      headers: sc.getHeaders(alice),
    })

    const ws = new WebSocket(
      `ws://${serverHost}/xrpc/com.atproto.sync.subscribeRepos?cursor=${-1}`,
    )

    const gen = byFrame(ws)
    const evts = await readTillCaughtUp(gen)
    ws.terminate()

    // @NOTE requires a larger slice because of over-emission on activateAccount - see note on route
    const accountEvts = getAccountEvts(evts.slice(-6))
    expect(accountEvts.length).toBe(4)
    verifyAccountEvent(accountEvts[0], alice, false, AccountStatus.Deactivated)
    verifyAccountEvent(accountEvts[1], alice, false, AccountStatus.Takendown)
    verifyAccountEvent(accountEvts[2], alice, false, AccountStatus.Deactivated)
    verifyAccountEvent(accountEvts[3], alice, true)
  })

  it('emits sync event on account activation', async () => {
    await agent.api.com.atproto.server.deactivateAccount(
      {},
      {
        encoding: 'application/json',
        headers: sc.getHeaders(alice),
      },
    )
    await agent.api.com.atproto.server.activateAccount(undefined, {
      headers: sc.getHeaders(alice),
    })

    const ws = new WebSocket(
      `ws://${serverHost}/xrpc/com.atproto.sync.subscribeRepos?cursor=${-1}`,
    )

    const gen = byFrame(ws)
    const evts = await readTillCaughtUp(gen)
    ws.terminate()

    const syncEvts = getSyncEvts(evts.slice(-1))
    expect(syncEvts.length).toBe(1)
    const root = await ctx.actorStore.read(alice, (store) =>
      store.repo.storage.getRootDetailed(),
    )
    await verifySyncEvent(syncEvts[0], alice, root.cid, root.rev)
  })

  it('syncs account deletions (account evt)', async () => {
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
    const deleteToken = await ctx.accountManager.createEmailToken(
      baddie1,
      'delete_account',
    )
    await agent.api.com.atproto.server.deleteAccount({
      did: baddie1,
      password: 'baddie1-pass',
      token: deleteToken,
    })
    await agent.api.com.atproto.admin.deleteAccount(
      {
        did: baddie2,
      },
      {
        encoding: 'application/json',
        headers: network.pds.adminAuthHeaders(),
      },
    )

    const ws = new WebSocket(
      `ws://${serverHost}/xrpc/com.atproto.sync.subscribeRepos?cursor=${-1}`,
    )

    const gen = byFrame(ws)
    const evts = await readTillCaughtUp(gen)
    ws.terminate()

    const accountEvts = getAccountEvts(evts.slice(-2))
    expect(accountEvts.length).toBe(2)
    verifyAccountEvent(accountEvts[0], baddie1, false, AccountStatus.Deleted)
    verifyAccountEvent(accountEvts[1], baddie2, false, AccountStatus.Deleted)
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
    verifyAccountEvent(
      didEvts[0] as AccountEvt,
      baddie3,
      false,
      AccountStatus.Deleted,
    )
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
