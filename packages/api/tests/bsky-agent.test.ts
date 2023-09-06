import {
  CloseFn,
  runTestServer,
  TestServerInfo,
} from '@atproto/pds/tests/_util'
import { BskyAgent, ComAtprotoRepoPutRecord, AppBskyActorProfile } from '..'

describe('agent', () => {
  let server: TestServerInfo
  let close: CloseFn

  beforeAll(async () => {
    server = await runTestServer({
      dbPostgresSchema: 'bsky_agent',
    })
    close = server.close
  })

  afterAll(async () => {
    await close()
  })

  it('upsertProfile correctly creates and updates profiles.', async () => {
    const agent = new BskyAgent({ service: server.url })

    await agent.createAccount({
      handle: 'user1.test',
      email: 'user1@test.com',
      password: 'password',
    })

    const profile1 = await agent.getProfile({ actor: agent.session?.did || '' })
    expect(profile1.data.displayName).toBeFalsy()

    await agent.upsertProfile((existing) => {
      expect(existing).toBeFalsy()
      return {
        displayName: 'Bob',
      }
    })

    const profile2 = await agent.getProfile({ actor: agent.session?.did || '' })
    expect(profile2.data.displayName).toBe('Bob')

    await agent.upsertProfile((existing) => {
      expect(existing).toBeTruthy()
      return {
        displayName: existing?.displayName?.toUpperCase(),
      }
    })

    const profile3 = await agent.getProfile({ actor: agent.session?.did || '' })
    expect(profile3.data.displayName).toBe('BOB')
  })

  it('upsertProfile correctly handles CAS failures.', async () => {
    const agent = new BskyAgent({ service: server.url })

    await agent.createAccount({
      handle: 'user2.test',
      email: 'user2@test.com',
      password: 'password',
    })

    const profile1 = await agent.getProfile({ actor: agent.session?.did || '' })
    expect(profile1.data.displayName).toBeFalsy()

    let hasConflicted = false
    let ranTwice = false
    await agent.upsertProfile(async (existing) => {
      if (!hasConflicted) {
        await agent.com.atproto.repo.putRecord({
          repo: agent.session?.did || '',
          collection: 'app.bsky.actor.profile',
          rkey: 'self',
          record: {
            $type: 'app.bsky.actor.profile',
            displayName: String(Math.random()),
          },
        })
        hasConflicted = true
      } else {
        ranTwice = true
      }
      return {
        displayName: 'Bob',
      }
    })
    expect(ranTwice).toBe(true)

    const profile2 = await agent.getProfile({ actor: agent.session?.did || '' })
    expect(profile2.data.displayName).toBe('Bob')
  })

  it('upsertProfile wont endlessly retry CAS failures.', async () => {
    const agent = new BskyAgent({ service: server.url })

    await agent.createAccount({
      handle: 'user3.test',
      email: 'user3@test.com',
      password: 'password',
    })

    const profile1 = await agent.getProfile({ actor: agent.session?.did || '' })
    expect(profile1.data.displayName).toBeFalsy()

    const p = agent.upsertProfile(async (existing) => {
      await agent.com.atproto.repo.putRecord({
        repo: agent.session?.did || '',
        collection: 'app.bsky.actor.profile',
        rkey: 'self',
        record: {
          $type: 'app.bsky.actor.profile',
          displayName: String(Math.random()),
        },
      })
      return {
        displayName: 'Bob',
      }
    })
    await expect(p).rejects.toThrow(ComAtprotoRepoPutRecord.InvalidSwapError)
  })

  it('upsertProfile validates the record.', async () => {
    const agent = new BskyAgent({ service: server.url })

    await agent.createAccount({
      handle: 'user4.test',
      email: 'user4@test.com',
      password: 'password',
    })

    const p = agent.upsertProfile((existing) => {
      return {
        displayName: { string: 'Bob' },
      } as unknown as AppBskyActorProfile.Record
    })
    await expect(p).rejects.toThrow('Record/displayName must be a string')
  })

  describe('app', () => {
    it('should retrieve the api app', () => {
      const agent = new BskyAgent({ service: server.url })
      expect(agent.app).toBe(agent.api.app)
    })
  })

  describe('post', () => {
    it('should throw if no session', async () => {
      const agent = new BskyAgent({ service: server.url })
      await expect(agent.post({ text: 'foo' })).rejects.toThrow('Not logged in')
    })
  })

  describe('deletePost', () => {
    it('should throw if no session', async () => {
      const agent = new BskyAgent({ service: server.url })
      await expect(agent.deletePost('foo')).rejects.toThrow('Not logged in')
    })
  })

  describe('like', () => {
    it('should throw if no session', async () => {
      const agent = new BskyAgent({ service: server.url })
      await expect(agent.like('foo', 'bar')).rejects.toThrow('Not logged in')
    })
  })

  describe('deleteLike', () => {
    it('should throw if no session', async () => {
      const agent = new BskyAgent({ service: server.url })
      await expect(agent.deleteLike('foo')).rejects.toThrow('Not logged in')
    })
  })

  describe('repost', () => {
    it('should throw if no session', async () => {
      const agent = new BskyAgent({ service: server.url })
      await expect(agent.repost('foo', 'bar')).rejects.toThrow('Not logged in')
    })
  })

  describe('deleteRepost', () => {
    it('should throw if no session', async () => {
      const agent = new BskyAgent({ service: server.url })
      await expect(agent.deleteRepost('foo')).rejects.toThrow('Not logged in')
    })
  })

  describe('follow', () => {
    it('should throw if no session', async () => {
      const agent = new BskyAgent({ service: server.url })
      await expect(agent.follow('foo')).rejects.toThrow('Not logged in')
    })
  })

  describe('deleteFollow', () => {
    it('should throw if no session', async () => {
      const agent = new BskyAgent({ service: server.url })
      await expect(agent.deleteFollow('foo')).rejects.toThrow('Not logged in')
    })
  })

  describe('preferences methods', () => {
    it('gets and sets preferences correctly', async () => {
      const agent = new BskyAgent({ service: server.url })

      await agent.createAccount({
        handle: 'user5.test',
        email: 'user5@test.com',
        password: 'password',
      })

      await expect(agent.getPreferences()).resolves.toStrictEqual({
        feeds: { pinned: undefined, saved: undefined },
        adultContentEnabled: false,
        contentLabels: {},
      })

      await agent.setAdultContentEnabled(true)
      await expect(agent.getPreferences()).resolves.toStrictEqual({
        feeds: { pinned: undefined, saved: undefined },
        adultContentEnabled: true,
        contentLabels: {},
      })

      await agent.setAdultContentEnabled(false)
      await expect(agent.getPreferences()).resolves.toStrictEqual({
        feeds: { pinned: undefined, saved: undefined },
        adultContentEnabled: false,
        contentLabels: {},
      })

      await agent.setContentLabelPref('impersonation', 'warn')
      await expect(agent.getPreferences()).resolves.toStrictEqual({
        feeds: { pinned: undefined, saved: undefined },
        adultContentEnabled: false,
        contentLabels: {
          impersonation: 'warn',
        },
      })

      await agent.setContentLabelPref('spam', 'show') // will convert to 'ignore'
      await agent.setContentLabelPref('impersonation', 'hide')
      await expect(agent.getPreferences()).resolves.toStrictEqual({
        feeds: { pinned: undefined, saved: undefined },
        adultContentEnabled: false,
        contentLabels: {
          impersonation: 'hide',
          spam: 'ignore',
        },
      })

      await agent.addSavedFeed('at://bob.com/app.bsky.feed.generator/fake')
      await expect(agent.getPreferences()).resolves.toStrictEqual({
        feeds: {
          pinned: [],
          saved: ['at://bob.com/app.bsky.feed.generator/fake'],
        },
        adultContentEnabled: false,
        contentLabels: {
          impersonation: 'hide',
          spam: 'ignore',
        },
      })

      await agent.addPinnedFeed('at://bob.com/app.bsky.feed.generator/fake')
      await expect(agent.getPreferences()).resolves.toStrictEqual({
        feeds: {
          pinned: ['at://bob.com/app.bsky.feed.generator/fake'],
          saved: ['at://bob.com/app.bsky.feed.generator/fake'],
        },
        adultContentEnabled: false,
        contentLabels: {
          impersonation: 'hide',
          spam: 'ignore',
        },
      })

      await agent.removePinnedFeed('at://bob.com/app.bsky.feed.generator/fake')
      await expect(agent.getPreferences()).resolves.toStrictEqual({
        feeds: {
          pinned: [],
          saved: ['at://bob.com/app.bsky.feed.generator/fake'],
        },
        adultContentEnabled: false,
        contentLabels: {
          impersonation: 'hide',
          spam: 'ignore',
        },
      })

      await agent.removeSavedFeed('at://bob.com/app.bsky.feed.generator/fake')
      await expect(agent.getPreferences()).resolves.toStrictEqual({
        feeds: {
          pinned: [],
          saved: [],
        },
        adultContentEnabled: false,
        contentLabels: {
          impersonation: 'hide',
          spam: 'ignore',
        },
      })

      await agent.addPinnedFeed('at://bob.com/app.bsky.feed.generator/fake')
      await expect(agent.getPreferences()).resolves.toStrictEqual({
        feeds: {
          pinned: ['at://bob.com/app.bsky.feed.generator/fake'],
          saved: ['at://bob.com/app.bsky.feed.generator/fake'],
        },
        adultContentEnabled: false,
        contentLabels: {
          impersonation: 'hide',
          spam: 'ignore',
        },
      })

      await agent.addPinnedFeed('at://bob.com/app.bsky.feed.generator/fake2')
      await expect(agent.getPreferences()).resolves.toStrictEqual({
        feeds: {
          pinned: [
            'at://bob.com/app.bsky.feed.generator/fake',
            'at://bob.com/app.bsky.feed.generator/fake2',
          ],
          saved: [
            'at://bob.com/app.bsky.feed.generator/fake',
            'at://bob.com/app.bsky.feed.generator/fake2',
          ],
        },
        adultContentEnabled: false,
        contentLabels: {
          impersonation: 'hide',
          spam: 'ignore',
        },
      })

      await agent.removeSavedFeed('at://bob.com/app.bsky.feed.generator/fake')
      await expect(agent.getPreferences()).resolves.toStrictEqual({
        feeds: {
          pinned: ['at://bob.com/app.bsky.feed.generator/fake2'],
          saved: ['at://bob.com/app.bsky.feed.generator/fake2'],
        },
        adultContentEnabled: false,
        contentLabels: {
          impersonation: 'hide',
          spam: 'ignore',
        },
      })
    })
  })
})
