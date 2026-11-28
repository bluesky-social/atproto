import { describe, expect, it, vi } from 'vitest'
import { TestBsky } from './bsky.js'
import { TestBsync } from './bsync.js'
import { TestNetwork } from './network.js'
import { TestOzone } from './ozone.js'
import { TestPds } from './pds.js'
import { TestPlc } from './plc.js'
import { LexiconAuthorityProfile } from './service-profile-lexicon.js'
import { OzoneServiceProfile } from './service-profile-ozone.js'

// @NOTE Disposing a fixture closes it, so both go through the same mock.
function fixture<T extends object>(members: T) {
  const close = vi.fn(async () => {})
  return { ...members, close, [Symbol.asyncDispose]: close }
}

// @NOTE Every service TestNetwork.create starts is replaced by a fake that only
// has the members create() touches, so these tests need no postgres or redis.
function stubServices() {
  const idResolver = () => ({ did: {}, handle: {} })
  const services = {
    plc: fixture({ url: 'http://localhost:1' }),
    thirdPartyPds: fixture({ processAll: vi.fn() }),
    bsync: fixture({
      url: 'http://localhost:2',
      ctx: {},
      getStreamHeads: vi.fn(async () => ({})),
    }),
    bsky: fixture({
      url: 'http://localhost:3',
      ctx: {
        cfg: { serverDid: 'did:example:bsky' },
        dataplane: {},
        idResolver: idResolver(),
      },
      dataplane: { idResolver: idResolver() },
      sub: { processAll: vi.fn() },
      bsyncSub: { processAll: vi.fn() },
    }),
    pds: fixture({
      url: 'http://localhost:4',
      ctx: {
        cfg: { service: { did: 'did:example:pds' } },
        idResolver: idResolver(),
      },
      processAll: vi.fn(),
    }),
    ozone: fixture({
      daemon: { ctx: { cfg: {} } },
      addAdminDid: vi.fn(),
      createPolicies: vi.fn(),
      processAll: vi.fn(),
    }),
  }
  const ozoneProfile = {
    did: 'did:example:ozone',
    key: {},
    migrateTo: vi.fn(),
    createRecords: vi.fn(),
    createAppPasswordForVerification: vi.fn(async () => 'password'),
  }
  const lexiconProfile = {
    did: 'did:example:lexicon',
    migrateTo: vi.fn(),
    createRecords: vi.fn(),
  }

  const fake = <T>(value: object) => value as T
  const spies = {
    plcCreate: vi
      .spyOn(TestPlc, 'create')
      .mockResolvedValue(fake<TestPlc>(services.plc)),
    pdsCreate: vi
      .spyOn(TestPds, 'create')
      .mockResolvedValueOnce(fake<TestPds>(services.thirdPartyPds))
      .mockResolvedValueOnce(fake<TestPds>(services.pds)),
    ozoneProfileCreate: vi
      .spyOn(OzoneServiceProfile, 'create')
      .mockResolvedValue(fake<OzoneServiceProfile>(ozoneProfile)),
    lexiconProfileCreate: vi
      .spyOn(LexiconAuthorityProfile, 'create')
      .mockResolvedValue(fake<LexiconAuthorityProfile>(lexiconProfile)),
    bsyncCreate: vi
      .spyOn(TestBsync, 'create')
      .mockResolvedValue(fake<TestBsync>(services.bsync)),
    bskyCreate: vi
      .spyOn(TestBsky, 'create')
      .mockResolvedValue(fake<TestBsky>(services.bsky)),
    ozoneCreate: vi
      .spyOn(TestOzone, 'create')
      .mockResolvedValue(fake<TestOzone>(services.ozone)),
  }
  vi.stubEnv('REDIS_HOST', 'localhost:6379')

  return {
    services,
    ozoneProfile,
    spies,
    [Symbol.dispose]() {
      for (const spy of Object.values(spies)) spy.mockRestore()
      vi.unstubAllEnvs()
    },
  }
}

const params = { dbPostgresUrl: 'postgres://unused' }

describe('TestNetwork.create', () => {
  it('closes the services already started when a later one fails', async () => {
    using stubs = stubServices()
    const { plc, thirdPartyPds, bsync } = stubs.services
    const error = new Error('bsky failed to start')
    stubs.spies.bskyCreate.mockRejectedValueOnce(error)

    await expect(TestNetwork.create(params)).rejects.toBe(error)

    for (const service of [plc, thirdPartyPds, bsync]) {
      expect(service.close).toHaveBeenCalledOnce()
    }
    // @NOTE the main pds and ozone start after bsky, so were never created
    expect(stubs.spies.pdsCreate).toHaveBeenCalledOnce()
    expect(stubs.spies.ozoneCreate).not.toHaveBeenCalled()
  })

  it('closes every service, the third-party pds only once, when a step after them fails', async () => {
    using stubs = stubServices()
    const error = new Error('app password creation failed')
    stubs.ozoneProfile.createAppPasswordForVerification.mockRejectedValueOnce(
      error,
    )

    await expect(TestNetwork.create(params)).rejects.toBe(error)

    for (const service of Object.values(stubs.services)) {
      expect(service.close).toHaveBeenCalledOnce()
    }
  })

  it('closes nothing when every service starts', async () => {
    using stubs = stubServices()

    const network = await TestNetwork.create(params)

    const { plc, thirdPartyPds, bsync, bsky, pds, ozone } = stubs.services
    expect(network.pds).toBe(pds)
    for (const service of [plc, bsync, bsky, pds, ozone]) {
      expect(service.close).not.toHaveBeenCalled()
    }
    // @NOTE the third-party pds is only needed during setup
    expect(thirdPartyPds.close).toHaveBeenCalledOnce()
  })
})
