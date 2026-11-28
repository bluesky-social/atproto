import { describe, expect, it, test, vi } from 'vitest'
import {
  DID,
  type XrpcHandler,
  createAgent,
  xrpcError,
  xrpcFetch,
} from './_xrpc-fetch.test.js'
import { Agent } from './agent.js'
import { AtpAgent } from './atp-agent.js'
import {
  type AppBskyActorProfile,
  ComAtprotoRepoPutRecord,
} from './client/index.js'

const PROFILE_URI = `at://${DID}/app.bsky.actor.profile/self`
const CID_1 = 'bafyreiclp443lavogvhj3d2ob2cxbfuscni2k5jk7bebjzg7khl3esabwq'
const CID_2 = 'bafyreie5737gdxlw5i64vzichcalba3z2v5n6icifvx5xytvske7mr3hpm'

const profile = (displayName: string) => ({
  $type: 'app.bsky.actor.profile',
  displayName,
})

const putProfileBody = (displayName: string, swapRecord: string | null) =>
  expect.objectContaining({
    body: {
      repo: DID,
      collection: 'app.bsky.actor.profile',
      rkey: 'self',
      record: profile(displayName),
      swapRecord,
    },
  })

describe(Agent, () => {
  describe('upsertProfile', () => {
    it('creates the profile when there is none.', async () => {
      const putRecord = vi.fn(() => ({ uri: PROFILE_URI, cid: CID_1 }))
      using fetch = xrpcFetch({
        'com.atproto.repo.getRecord': () => xrpcError(400, 'RecordNotFound'),
        'com.atproto.repo.putRecord': putRecord,
      })
      const updateFn = vi.fn(() => ({ displayName: 'Bob' }))

      await createAgent(fetch).upsertProfile(updateFn)

      expect(updateFn).toHaveBeenCalledExactlyOnceWith(undefined)
      expect(putRecord).toHaveBeenCalledExactlyOnceWith(
        putProfileBody('Bob', null),
      )
    })

    it('updates the existing profile.', async () => {
      const putRecord = vi.fn(() => ({ uri: PROFILE_URI, cid: CID_2 }))
      using fetch = xrpcFetch({
        'com.atproto.repo.getRecord': () => ({
          uri: PROFILE_URI,
          cid: CID_1,
          value: profile('Bob'),
        }),
        'com.atproto.repo.putRecord': putRecord,
      })
      const updateFn = vi.fn((existing?: AppBskyActorProfile.Record) => ({
        displayName: existing?.displayName?.toUpperCase(),
      }))

      await createAgent(fetch).upsertProfile(updateFn)

      expect(updateFn).toHaveBeenCalledExactlyOnceWith(profile('Bob'))
      expect(putRecord).toHaveBeenCalledExactlyOnceWith(
        putProfileBody('BOB', CID_1),
      )
    })

    it('correctly handles CAS failures.', async () => {
      const getRecord = vi
        .fn<XrpcHandler>(() => ({
          uri: PROFILE_URI,
          cid: CID_1,
          value: profile('Alice'),
        }))
        .mockImplementationOnce(() => xrpcError(400, 'RecordNotFound'))
      const putRecord = vi
        .fn<XrpcHandler>(() => ({ uri: PROFILE_URI, cid: CID_2 }))
        .mockImplementationOnce(() => xrpcError(400, 'InvalidSwap'))
      using fetch = xrpcFetch({
        'com.atproto.repo.getRecord': getRecord,
        'com.atproto.repo.putRecord': putRecord,
      })
      const updateFn = vi.fn(() => ({ displayName: 'Bob' }))

      await createAgent(fetch).upsertProfile(updateFn)

      // re-reads the record and runs the update again
      expect(getRecord).toHaveBeenCalledTimes(2)
      expect(updateFn).toHaveBeenCalledTimes(2)
      expect(putRecord).toHaveBeenCalledTimes(2)
      expect(putRecord).toHaveBeenLastCalledWith(putProfileBody('Bob', CID_1))
    })

    it('wont endlessly retry CAS failures.', async () => {
      const putRecord = vi.fn(() => xrpcError(400, 'InvalidSwap'))
      using fetch = xrpcFetch({
        'com.atproto.repo.getRecord': () => xrpcError(400, 'RecordNotFound'),
        'com.atproto.repo.putRecord': putRecord,
      })

      const p = createAgent(fetch).upsertProfile(() => ({
        displayName: 'Bob',
      }))
      await expect(p).rejects.toThrow(ComAtprotoRepoPutRecord.InvalidSwapError)
      expect(putRecord).toHaveBeenCalledTimes(6)
    })

    it('validates the record.', async () => {
      const putRecord = vi.fn()
      using fetch = xrpcFetch({
        'com.atproto.repo.getRecord': () => xrpcError(400, 'RecordNotFound'),
        'com.atproto.repo.putRecord': putRecord,
      })

      const p = createAgent(fetch).upsertProfile((_existing) => {
        return {
          displayName: { string: 'Bob' },
        } as unknown as AppBskyActorProfile.Record
      })
      await expect(p).rejects.toThrow('Record/displayName must be a string')
      expect(putRecord).not.toHaveBeenCalled()
    })
  })

  describe('app', () => {
    it('should retrieve the api app', () => {
      const agent = new AtpAgent({ service: 'https://pds.test' })
      expect(agent.api).toBe(agent)
      expect(agent.app).toBeDefined()
    })
  })

  test.each([
    { note: 'post', call: (a: Agent) => a.post({ text: 'foo' }) },
    { note: 'deletePost', call: (a: Agent) => a.deletePost('foo') },
    { note: 'like', call: (a: Agent) => a.like('foo', 'bar') },
    { note: 'deleteLike', call: (a: Agent) => a.deleteLike('foo') },
    { note: 'repost', call: (a: Agent) => a.repost('foo', 'bar') },
    { note: 'deleteRepost', call: (a: Agent) => a.deleteRepost('foo') },
    { note: 'follow', call: (a: Agent) => a.follow('foo') },
    { note: 'deleteFollow', call: (a: Agent) => a.deleteFollow('foo') },
  ])('$note throws if no session', async ({ call }) => {
    const agent = new AtpAgent({ service: 'https://pds.test' })
    await expect(call(agent)).rejects.toThrow('Not logged in')
  })
})
