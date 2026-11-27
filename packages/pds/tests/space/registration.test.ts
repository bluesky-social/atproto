import { jest } from '@jest/globals'
import { SECOND, TID, createDeferrable } from '@atproto/common'
import type { TestNetworkNoAppView } from '@atproto/dev-env'
import type { SpaceRefString } from '@atproto/syntax'
import { com } from '../../src/lexicons/index.js'
import {
  type Actor,
  MockService,
  type SpaceClient,
  createSpaceNetwork,
} from '../_space.js'

const { repoWrite } = com.atproto.space.defs
const { registrationExpired, spaceDeleted } =
  com.atproto.space.notifySpaceUpdate

describe('syncer registration', () => {
  let network: TestNetworkNoAppView
  let sc: SpaceClient
  let alice: Actor
  let carol: Actor

  beforeAll(async () => {
    ;({ network, sc, alice, carol } = await createSpaceNetwork())
  })

  afterAll(async () => {
    await network?.close()
  })

  const createSyncer = (
    opts: Omit<Parameters<typeof MockService.create>[1], 'serviceId'> = {},
  ) =>
    MockService.create(network, { serviceId: 'atproto_space_syncer', ...opts })

  // A syncer reading the space for carol, a member.
  const register = (
    space: SpaceRefString,
    syncer: MockService,
    token?: string,
  ) =>
    sc.credentialFor(carol, space, { notify: syncer.notifyRegistration(token) })

  const confirmations = (syncer: MockService) =>
    syncer.callsTo(com.atproto.space.confirmRegistration.$lxm)

  // The write is recorded before it resolves; only the fan-out to syncers is queued.
  const writeAndForward = async (space: SpaceRefString) => {
    await sc.write(alice, space)
    await network.pds.ctx.backgroundQueue.processAll()
  }

  const deleteSpace = (space: SpaceRefString) =>
    alice.client.call(
      com.atproto.space.deleteSpace,
      { space },
      { headers: alice.headers },
    )

  it('confirms a new registration, and forwards writes with its token', async () => {
    await using syncer = await createSyncer()
    const space = await sc.createSpace(alice, { members: [carol] })

    await register(space, syncer, 'first-token')
    expect(confirmations(syncer).map((call) => call.body)).toEqual([
      { space, token: 'first-token', challenge: expect.any(String) },
    ])

    await writeAndForward(space)
    expect(
      syncer
        .callsTo(com.atproto.space.notifySpaceUpdate.$lxm)
        .map((call) => call.body),
    ).toEqual([
      {
        space,
        token: 'first-token',
        update: expect.objectContaining({
          $type: repoWrite.$type,
          repo: alice.did,
        }),
      },
    ])

    // Renewing with the same token is the same registration, so it is not
    // confirmed again.
    await register(space, syncer, 'first-token')
    expect(confirmations(syncer)).toHaveLength(1)
  })

  it('treats a different token as a separate registration', async () => {
    await using syncer = await createSyncer()
    const space = await sc.createSpace(alice, { members: [carol] })
    await register(space, syncer, 'first-token')
    await register(space, syncer, 'second-token')

    await writeAndForward(space)
    const tokens = syncer
      .callsTo(com.atproto.space.notifySpaceUpdate.$lxm)
      .map(
        (call) =>
          (call.body as com.atproto.space.notifySpaceUpdate.$InputBody).token,
      )
    expect(tokens.sort()).toEqual(['first-token', 'second-token'])
  })

  it('refuses an authorization whose registration is not confirmed', async () => {
    await using syncer = await createSyncer({
      confirmRegistrations: false,
      respond: () => ({ status: 200, body: { challenge: 'not-the-one' } }),
    })
    const space = await sc.createSpace(alice, { members: [carol] })

    await expect(register(space, syncer)).rejects.toMatchObject({
      error: 'RegistrationNotConfirmed',
    })
    await writeAndForward(space)
    expect(syncer.spaceUpdates()).toEqual([])
  })

  it('sends a lapsed registration one expiry notice in place of updates, until it renews', async () => {
    await using syncer = await createSyncer()
    const space = await sc.createSpace(alice, { members: [carol] })
    await register(space, syncer)
    await sc.lapseRegistration(space, syncer.url)

    await writeAndForward(space)
    const { spaceRev } = await sc.credentialFor(alice, space)
    const expired = registrationExpired.$build({ spaceRev: spaceRev! })
    expect(syncer.spaceUpdates()).toEqual([expired])

    await writeAndForward(space)
    expect(syncer.spaceUpdates()).toEqual([expired])

    await register(space, syncer)
    await writeAndForward(space)
    expect(syncer.spaceUpdates()).toEqual([
      expired,
      expect.objectContaining({ $type: repoWrite.$type }),
    ])
  })

  it.each(['deactivated', 'takendown'] as const)(
    'notifies no one while the authority is %s, then prompts a lapsed registration on the first update after',
    async (status) => {
      await using active = await createSyncer()
      await using lapsed = await createSyncer()
      const space = await sc.createSpace(alice, { members: [carol] })
      await register(space, active)
      await register(space, lapsed)
      {
        await using _ = await sc.withStatus(alice, status)
        await sc.lapseRegistration(space, lapsed.url)
        await sc.write(carol, space)
        await network.pds.ctx.backgroundQueue.processAll()
        expect(active.spaceUpdates()).toEqual([])
        expect(lapsed.spaceUpdates()).toEqual([])
      }

      await writeAndForward(space)
      expect(active.spaceUpdates()).toEqual([
        expect.objectContaining({ $type: repoWrite.$type, repo: alice.did }),
      ])
      expect(lapsed.spaceUpdates()).toEqual([
        expect.objectContaining({ $type: registrationExpired.$type }),
      ])
    },
  )

  it('unregisters a syncer that rejects its expiry notice', async () => {
    await using syncer = await createSyncer({
      respond: () => ({ status: 400, body: { error: 'InvalidToken' } }),
    })
    const space = await sc.createSpace(alice, { members: [carol] })
    await register(space, syncer)
    await sc.lapseRegistration(space, syncer.url)

    await writeAndForward(space)
    expect(syncer.spaceUpdates()).toEqual([
      expect.objectContaining({ $type: registrationExpired.$type }),
    ])

    // Registering again is a new registration, so it is confirmed again.
    await register(space, syncer)
    expect(confirmations(syncer)).toHaveLength(2)
  })

  it('keeps an active registration through a rejected update', async () => {
    await using syncer = await createSyncer({
      respond: () => ({ status: 401, body: { error: 'InvalidToken' } }),
    })
    const space = await sc.createSpace(alice, { members: [carol] })
    await register(space, syncer)

    await writeAndForward(space)
    await writeAndForward(space)
    expect(syncer.spaceUpdates()).toEqual([
      expect.objectContaining({ $type: repoWrite.$type }),
      expect.objectContaining({ $type: repoWrite.$type }),
    ])
  })

  it('withdraws the registration carried by a refused authorization, matched by token', async () => {
    await using syncer = await createSyncer()
    const space = await sc.createSpace(alice, { members: [carol] })
    await register(space, syncer, 'syncer-token')
    await sc.removeMember(alice, space, carol)

    await expect(
      register(space, syncer, 'guessed-token'),
    ).rejects.toMatchObject({ error: 'SpaceNotFound' })
    await writeAndForward(space)
    expect(syncer.spaceUpdates()).toHaveLength(1)

    await expect(register(space, syncer, 'syncer-token')).rejects.toMatchObject(
      { error: 'SpaceNotFound' },
    )
    await writeAndForward(space)
    expect(syncer.spaceUpdates()).toHaveLength(1)
  })

  it('keeps the registration through an authorization that fails to decide', async () => {
    let answer: { status: number; body: unknown } = {
      status: 200,
      body: { read: true, write: true },
    }
    await using app = await MockService.create(network, {
      serviceId: 'atproto_forum',
      respond: () => answer,
    })
    await using syncer = await createSyncer()
    const space = await sc.createSpace(alice, {
      policy: com.atproto.managedspace.policy.$build({
        managingApp: app.serviceRef,
      }),
    })
    await register(space, syncer)

    answer = { status: 500, body: { error: 'InternalError' } }
    await expect(register(space, syncer)).rejects.toMatchObject({
      error: 'UpstreamFailure',
    })
    await writeAndForward(space)
    expect(syncer.spaceUpdates()).toEqual([
      expect.objectContaining({ $type: repoWrite.$type }),
    ])
  })

  it('delivers to each registration without waiting on a slow one', async () => {
    const slowReleased = createDeferrable()
    const fastDelivered = createDeferrable()
    await using syncer = await createSyncer({
      respond: async (call) => {
        const { token } = call.body as { token?: string }
        if (token === 'a-slow-token') await slowReleased.complete
        if (token === 'b-fast-token') fastDelivered.resolve()
        return { status: 200, body: {} }
      },
    })
    const space = await sc.createSpace(alice, { members: [carol] })
    // Registered in token order, so a serial delivery would wait on the slow one first.
    await register(space, syncer, 'a-slow-token')
    await register(space, syncer, 'b-fast-token')

    await sc.write(alice, space)
    let timer: NodeJS.Timeout | undefined
    try {
      // Well short of the timeout that would end a serial wait on the slow one.
      const first = await Promise.race([
        fastDelivered.complete.then(() => 'fast'),
        new Promise((resolve) => {
          timer = setTimeout(() => resolve('timeout'), 2 * SECOND)
        }),
      ])
      expect(first).toBe('fast')
    } finally {
      clearTimeout(timer)
      slowReleased.resolve()
    }
    await network.pds.ctx.backgroundQueue.processAll()
  })

  it('sends a deletion notice to every registration, including lapsed ones', async () => {
    await using active = await createSyncer()
    await using lapsed = await createSyncer()
    const space = await sc.createSpace(alice, { members: [carol] })
    await register(space, active)
    await register(space, lapsed)
    await sc.lapseRegistration(space, lapsed.url)
    await writeAndForward(space)

    await deleteSpace(space)
    await network.pds.ctx.backgroundQueue.processAll()

    expect(active.spaceUpdates()).toEqual([
      expect.objectContaining({ $type: repoWrite.$type }),
      spaceDeleted.$build({}),
    ])
    expect(lapsed.spaceUpdates()).toEqual([
      expect.objectContaining({ $type: registrationExpired.$type }),
      spaceDeleted.$build({}),
    ])
  })

  it('refuses a registration made as the space is deleted', async () => {
    await using syncer = await createSyncer()
    const skey = TID.nextStr()
    const space = await sc.createSpace(alice, { skey, members: [carol] })
    const delegationToken = await sc.delegationTokenFor(carol, space)

    {
      // Delete the space once the authorization has checked it, before the
      // registration is written: the authority's key is fetched in between, to
      // sign the credential.
      const { actorStore } = network.pds.ctx
      const keypair = actorStore.keypair.bind(actorStore)
      let deleted = false
      using _keypair = jest
        .spyOn(actorStore, 'keypair')
        .mockImplementation(async (did) => {
          if (did === alice.did && !deleted) {
            deleted = true
            await deleteSpace(space)
          }
          return keypair(did)
        })

      await expect(
        sc.authorize(space, {
          delegationToken,
          notify: syncer.notifyRegistration(),
        }),
      ).rejects.toMatchObject({ error: 'SpaceDeleted' })
      expect(deleted).toBe(true)
    }

    // A registration that outlived the deletion would carry over to the
    // re-created space.
    await sc.createSpace(alice, { skey })
    await writeAndForward(space)
    expect(syncer.spaceUpdates()).toEqual([])
  })
})
