import { AtpAgent } from '@atproto/api'
import { TestNetworkNoAppView } from '@atproto/dev-env'
import { AppContext } from '../src/context'
import { AccessControlService } from '../src/services/access-control'

describe('access control', () => {
  let network: TestNetworkNoAppView
  let ctx: AppContext
  let agent: AtpAgent
  let aliceAgent: AtpAgent
  let bobAgent: AtpAgent
  let carolAgent: AtpAgent
  let accessControl: AccessControlService

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'access_control',
    })
    // @ts-expect-error Error due to circular dependency with the dev-env package
    ctx = network.pds.ctx
    agent = network.pds.getClient()
    aliceAgent = network.pds.getClient()
    bobAgent = network.pds.getClient()
    carolAgent = network.pds.getClient()

    accessControl = new AccessControlService(ctx.actorStore)

    await aliceAgent.createAccount({
      email: 'alice@test.com',
      handle: 'alice.test',
      password: 'alice-pass',
    })

    await bobAgent.createAccount({
      email: 'bob@test.com',
      handle: 'bob.test',
      password: 'bob-pass',
    })

    await carolAgent.createAccount({
      email: 'carol@test.com',
      handle: 'carol.test',
      password: 'carol-pass',
    })
  })

  afterAll(async () => {
    await network.close()
  })

  describe('AccessControlService', () => {
    describe('getPrivacySettings', () => {
      it('returns isPrivate: false for profiles without privacy settings', async () => {
        const settings = await accessControl.getPrivacySettings(
          bobAgent.accountDid,
        )
        expect(settings.isPrivate).toBe(false)
      })

      it('returns isPrivate: true when privacy is enabled', async () => {
        // Set Alice's profile to private
        await aliceAgent.api.app.bsky.actor.putPreferences({
          preferences: [
            {
              $type: 'app.bsky.actor.defs#privateProfilePref',
              isPrivate: true,
            },
          ],
        })

        const settings = await accessControl.getPrivacySettings(
          aliceAgent.accountDid,
        )
        expect(settings.isPrivate).toBe(true)
      })
    })

    describe('canViewProfile', () => {
      it('allows anyone to view public profiles', async () => {
        const result = await accessControl.canViewProfile(
          bobAgent.accountDid,
          carolAgent.accountDid,
        )

        expect(result.canView).toBe(true)
        expect(result.isPrivate).toBe(false)
        expect(result.isOwnProfile).toBe(false)
      })

      it('allows owner to view their own private profile', async () => {
        // Ensure Alice's profile is private
        await aliceAgent.api.app.bsky.actor.putPreferences({
          preferences: [
            {
              $type: 'app.bsky.actor.defs#privateProfilePref',
              isPrivate: true,
            },
          ],
        })

        const result = await accessControl.canViewProfile(
          aliceAgent.accountDid,
          aliceAgent.accountDid,
        )

        expect(result.canView).toBe(true)
        expect(result.isPrivate).toBe(true)
        expect(result.isOwnProfile).toBe(true)
      })

      it('denies unauthenticated users access to private profiles', async () => {
        // Ensure Alice's profile is private
        await aliceAgent.api.app.bsky.actor.putPreferences({
          preferences: [
            {
              $type: 'app.bsky.actor.defs#privateProfilePref',
              isPrivate: true,
            },
          ],
        })

        const result = await accessControl.canViewProfile(
          null,
          aliceAgent.accountDid,
        )

        expect(result.canView).toBe(false)
        expect(result.isPrivate).toBe(true)
        expect(result.isOwnProfile).toBe(false)
      })

      it('denies non-followers access to private profiles', async () => {
        // Ensure Alice's profile is private
        await aliceAgent.api.app.bsky.actor.putPreferences({
          preferences: [
            {
              $type: 'app.bsky.actor.defs#privateProfilePref',
              isPrivate: true,
            },
          ],
        })

        const result = await accessControl.canViewProfile(
          bobAgent.accountDid,
          aliceAgent.accountDid,
        )

        expect(result.canView).toBe(false)
        expect(result.isPrivate).toBe(true)
        expect(result.isOwnProfile).toBe(false)
      })

      it('allows followers to view private profiles', async () => {
        // Ensure Alice's profile is private
        await aliceAgent.api.app.bsky.actor.putPreferences({
          preferences: [
            {
              $type: 'app.bsky.actor.defs#privateProfilePref',
              isPrivate: true,
            },
          ],
        })

        // Bob creates a follow record for Alice
        await bobAgent.api.com.atproto.repo.createRecord({
          repo: bobAgent.accountDid,
          collection: 'app.bsky.graph.follow',
          record: {
            $type: 'app.bsky.graph.follow',
            subject: aliceAgent.accountDid,
            createdAt: new Date().toISOString(),
          },
        })

        const result = await accessControl.canViewProfile(
          bobAgent.accountDid,
          aliceAgent.accountDid,
        )

        expect(result.canView).toBe(true)
        expect(result.isPrivate).toBe(true)
        expect(result.isOwnProfile).toBe(false)
      })

      it('handles profile transitioning from public to private', async () => {
        // Start with Carol as public
        const publicResult = await accessControl.canViewProfile(
          bobAgent.accountDid,
          carolAgent.accountDid,
        )
        expect(publicResult.canView).toBe(true)
        expect(publicResult.isPrivate).toBe(false)

        // Set Carol's profile to private
        await carolAgent.api.app.bsky.actor.putPreferences({
          preferences: [
            {
              $type: 'app.bsky.actor.defs#privateProfilePref',
              isPrivate: true,
            },
          ],
        })

        // Bob should no longer have access
        const privateResult = await accessControl.canViewProfile(
          bobAgent.accountDid,
          carolAgent.accountDid,
        )
        expect(privateResult.canView).toBe(false)
        expect(privateResult.isPrivate).toBe(true)
      })

      it('revokes access when follow is removed', async () => {
        // Dan creates account
        const danAgent = network.pds.getClient()
        await danAgent.createAccount({
          email: 'dan@test.com',
          handle: 'dan.test',
          password: 'dan-pass',
        })

        // Set Dan's profile to private
        await danAgent.api.app.bsky.actor.putPreferences({
          preferences: [
            {
              $type: 'app.bsky.actor.defs#privateProfilePref',
              isPrivate: true,
            },
          ],
        })

        // Bob creates follow for Dan
        const followRes = await bobAgent.api.com.atproto.repo.createRecord({
          repo: bobAgent.accountDid,
          collection: 'app.bsky.graph.follow',
          record: {
            $type: 'app.bsky.graph.follow',
            subject: danAgent.accountDid,
            createdAt: new Date().toISOString(),
          },
        })

        // Bob should have access
        let result = await accessControl.canViewProfile(
          bobAgent.accountDid,
          danAgent.accountDid,
        )
        expect(result.canView).toBe(true)

        // Bob deletes the follow
        const uri = new URL(followRes.data.uri)
        const rkey = uri.pathname.split('/').pop()!
        await bobAgent.api.com.atproto.repo.deleteRecord({
          repo: bobAgent.accountDid,
          collection: 'app.bsky.graph.follow',
          rkey,
        })

        // Bob should no longer have access
        result = await accessControl.canViewProfile(
          bobAgent.accountDid,
          danAgent.accountDid,
        )
        expect(result.canView).toBe(false)
      })
    })
  })

  describe('getProfile endpoint', () => {
    it('returns full profile for public accounts', async () => {
      // Bob has public profile
      const profile = await agent.api.app.bsky.actor.getProfile({
        actor: bobAgent.accountDid,
      })

      expect(profile.data.did).toBe(bobAgent.accountDid)
      expect(profile.data.handle).toBe('bob.test')
    })

    it('returns full profile for owner viewing their own private profile', async () => {
      // Alice sets her profile to private
      await aliceAgent.api.app.bsky.actor.putPreferences({
        preferences: [
          {
            $type: 'app.bsky.actor.defs#privateProfilePref',
            isPrivate: true,
          },
        ],
      })

      // Alice views her own profile
      const profile = await aliceAgent.api.app.bsky.actor.getProfile({
        actor: aliceAgent.accountDid,
      })

      expect(profile.data.did).toBe(aliceAgent.accountDid)
      expect(profile.data.handle).toBe('alice.test')
    })

    it('returns minimal profile for unauthorized viewers', async () => {
      // Ensure Alice's profile is private
      await aliceAgent.api.app.bsky.actor.putPreferences({
        preferences: [
          {
            $type: 'app.bsky.actor.defs#privateProfilePref',
            isPrivate: true,
          },
        ],
      })

      // Carol tries to view Alice's profile
      const profile = await carolAgent.api.app.bsky.actor.getProfile({
        actor: aliceAgent.accountDid,
      })

      expect(profile.data.did).toBe(aliceAgent.accountDid)
      expect(profile.data.handle).toBe('alice.test')
      // Other fields should be minimal/missing
      expect(Object.keys(profile.data)).toHaveLength(2)
    })

    it('returns full profile for approved followers', async () => {
      // Ensure Alice's profile is private
      await aliceAgent.api.app.bsky.actor.putPreferences({
        preferences: [
          {
            $type: 'app.bsky.actor.defs#privateProfilePref',
            isPrivate: true,
          },
        ],
      })

      // Carol creates a follow record for Alice
      await carolAgent.api.com.atproto.repo.createRecord({
        repo: carolAgent.accountDid,
        collection: 'app.bsky.graph.follow',
        record: {
          $type: 'app.bsky.graph.follow',
          subject: aliceAgent.accountDid,
          createdAt: new Date().toISOString(),
        },
      })

      // Carol views Alice's profile
      const profile = await carolAgent.api.app.bsky.actor.getProfile({
        actor: aliceAgent.accountDid,
      })

      expect(profile.data.did).toBe(aliceAgent.accountDid)
      expect(profile.data.handle).toBe('alice.test')
      // Should have more than just did and handle
      expect(Object.keys(profile.data).length).toBeGreaterThan(2)
    })
  })

  describe('getAuthorFeed endpoint', () => {
    it('allows viewing public profile feeds', async () => {
      // Bob has public profile
      const feed = await agent.api.app.bsky.feed.getAuthorFeed({
        actor: bobAgent.accountDid,
      })

      expect(feed.data.feed).toBeDefined()
    })

    it('allows owner to view their own private feed', async () => {
      // Alice has private profile
      await aliceAgent.api.app.bsky.actor.putPreferences({
        preferences: [
          {
            $type: 'app.bsky.actor.defs#privateProfilePref',
            isPrivate: true,
          },
        ],
      })

      const feed = await aliceAgent.api.app.bsky.feed.getAuthorFeed({
        actor: aliceAgent.accountDid,
      })

      expect(feed.data.feed).toBeDefined()
    })

    it('returns 403 for unauthorized viewers of private feeds', async () => {
      // Ensure Alice's profile is private
      await aliceAgent.api.app.bsky.actor.putPreferences({
        preferences: [
          {
            $type: 'app.bsky.actor.defs#privateProfilePref',
            isPrivate: true,
          },
        ],
      })

      // Carol tries to view Alice's feed
      const feedAttempt = carolAgent.api.app.bsky.feed.getAuthorFeed({
        actor: aliceAgent.accountDid,
      })

      await expect(feedAttempt).rejects.toThrow(/Profile is private/)
    })

    it('allows approved followers to view private feeds', async () => {
      // Ensure Alice's profile is private
      await aliceAgent.api.app.bsky.actor.putPreferences({
        preferences: [
          {
            $type: 'app.bsky.actor.defs#privateProfilePref',
            isPrivate: true,
          },
        ],
      })

      // Create follow record if it doesn't exist
      await bobAgent.api.com.atproto.repo.createRecord({
        repo: bobAgent.accountDid,
        collection: 'app.bsky.graph.follow',
        record: {
          $type: 'app.bsky.graph.follow',
          subject: aliceAgent.accountDid,
          createdAt: new Date().toISOString(),
        },
      })

      // Bob views Alice's feed
      const feed = await bobAgent.api.app.bsky.feed.getAuthorFeed({
        actor: aliceAgent.accountDid,
      })

      expect(feed.data.feed).toBeDefined()
    })
  })

  describe('multiple users with different access levels', () => {
    it('correctly handles different access levels for same profile', async () => {
      // Eve creates account with private profile
      const eveAgent = network.pds.getClient()
      await eveAgent.createAccount({
        email: 'eve@test.com',
        handle: 'eve.test',
        password: 'eve-pass',
      })

      await eveAgent.api.app.bsky.actor.putPreferences({
        preferences: [
          {
            $type: 'app.bsky.actor.defs#privateProfilePref',
            isPrivate: true,
          },
        ],
      })

      // Alice creates follow
      await aliceAgent.api.com.atproto.repo.createRecord({
        repo: aliceAgent.accountDid,
        collection: 'app.bsky.graph.follow',
        record: {
          $type: 'app.bsky.graph.follow',
          subject: eveAgent.accountDid,
          createdAt: new Date().toISOString(),
        },
      })

      // Check access for different users
      const eveResult = await accessControl.canViewProfile(
        eveAgent.accountDid,
        eveAgent.accountDid,
      )
      expect(eveResult.canView).toBe(true) // Owner
      expect(eveResult.isOwnProfile).toBe(true)

      const aliceResult = await accessControl.canViewProfile(
        aliceAgent.accountDid,
        eveAgent.accountDid,
      )
      expect(aliceResult.canView).toBe(true) // Has follow

      const bobResult = await accessControl.canViewProfile(
        bobAgent.accountDid,
        eveAgent.accountDid,
      )
      expect(bobResult.canView).toBe(false) // No follow

      const unauthResult = await accessControl.canViewProfile(
        null,
        eveAgent.accountDid,
      )
      expect(unauthResult.canView).toBe(false) // Unauthenticated
    })
  })
})

