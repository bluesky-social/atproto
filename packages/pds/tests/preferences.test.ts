import { AtpAgent } from '@atproto/api'
import { SeedClient, TestNetworkNoAppView } from '@atproto/dev-env'
import usersSeed from './seeds/users'

describe('user preferences', () => {
  let network: TestNetworkNoAppView
  let agent: AtpAgent
  let sc: SeedClient
  let appPassHeaders: { authorization: string }

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'preferences',
    })
    agent = network.pds.getClient()
    sc = network.getSeedClient()
    await usersSeed(sc)
    const appPass = await network.pds.ctx.accountManager.createAppPassword(
      sc.dids.alice,
      'test app pass',
      false,
    )
    const res = await agent.com.atproto.server.createSession({
      identifier: sc.dids.alice,
      password: appPass.password,
    })
    appPassHeaders = { authorization: `Bearer ${res.data.accessJwt}` }
  })

  afterAll(async () => {
    await network.close()
  })

  it('requires auth to set or put preferences.', async () => {
    const tryPut = agent.api.app.bsky.actor.putPreferences({
      preferences: [
        { $type: 'app.bsky.actor.defs#adultContentPref', enabled: false },
      ],
    })
    await expect(tryPut).rejects.toThrow('Authentication Required')
    const tryGet = agent.api.app.bsky.actor.getPreferences()
    await expect(tryGet).rejects.toThrow('Authentication Required')
  })

  it('gets preferences, before any are set.', async () => {
    const { data } = await agent.api.app.bsky.actor.getPreferences(
      {},
      { headers: sc.getHeaders(sc.dids.alice) },
    )
    expect(data).toEqual({
      preferences: [],
    })
  })

  it('only gets preferences in app.bsky namespace.', async () => {
    await network.pds.ctx.actorStore.transact(sc.dids.alice, (store) =>
      store.pref.putPreferences(
        [{ $type: 'com.atproto.server.defs#unknown' }],
        'com.atproto',
        {
          hasAccessFull: true,
        },
      ),
    )
    const { data } = await agent.api.app.bsky.actor.getPreferences(
      {},
      { headers: sc.getHeaders(sc.dids.alice) },
    )
    expect(data).toEqual({ preferences: [] })
  })

  it('puts preferences, all creates.', async () => {
    await agent.api.app.bsky.actor.putPreferences(
      {
        preferences: [
          { $type: 'app.bsky.actor.defs#adultContentPref', enabled: false },
          {
            $type: 'app.bsky.actor.defs#contentLabelPref',
            label: 'dogs',
            visibility: 'show',
          },
          {
            $type: 'app.bsky.actor.defs#contentLabelPref',
            label: 'cats',
            visibility: 'warn',
          },
        ],
      },
      { headers: sc.getHeaders(sc.dids.alice), encoding: 'application/json' },
    )
    const { data } = await agent.api.app.bsky.actor.getPreferences(
      {},
      { headers: sc.getHeaders(sc.dids.alice) },
    )
    expect(data).toEqual({
      preferences: [
        { $type: 'app.bsky.actor.defs#adultContentPref', enabled: false },
        {
          $type: 'app.bsky.actor.defs#contentLabelPref',
          label: 'dogs',
          visibility: 'show',
        },
        {
          $type: 'app.bsky.actor.defs#contentLabelPref',
          label: 'cats',
          visibility: 'warn',
        },
      ],
    })
    // Ensure other prefs were not clobbered
    const otherPrefs = await network.pds.ctx.actorStore.read(
      sc.dids.alice,
      (store) =>
        store.pref.getPreferences('com.atproto', {
          hasAccessFull: true,
        }),
    )
    expect(otherPrefs).toEqual([{ $type: 'com.atproto.server.defs#unknown' }])
  })

  it('puts preferences, updates and removals.', async () => {
    await agent.api.app.bsky.actor.putPreferences(
      {
        preferences: [
          { $type: 'app.bsky.actor.defs#adultContentPref', enabled: true },
          {
            $type: 'app.bsky.actor.defs#contentLabelPref',
            label: 'dogs',
            visibility: 'warn',
          },
        ],
      },
      { headers: sc.getHeaders(sc.dids.alice), encoding: 'application/json' },
    )
    const { data } = await agent.api.app.bsky.actor.getPreferences(
      {},
      { headers: sc.getHeaders(sc.dids.alice) },
    )
    expect(data).toEqual({
      preferences: [
        { $type: 'app.bsky.actor.defs#adultContentPref', enabled: true },
        {
          $type: 'app.bsky.actor.defs#contentLabelPref',
          label: 'dogs',
          visibility: 'warn',
        },
      ],
    })
  })

  it('puts preferences, clearing them.', async () => {
    await agent.api.app.bsky.actor.putPreferences(
      { preferences: [] },
      { headers: sc.getHeaders(sc.dids.alice), encoding: 'application/json' },
    )
    const { data } = await agent.api.app.bsky.actor.getPreferences(
      {},
      { headers: sc.getHeaders(sc.dids.alice) },
    )
    expect(data).toEqual({ preferences: [] })
  })

  it('fails putting preferences outside namespace.', async () => {
    const tryPut = agent.api.app.bsky.actor.putPreferences(
      {
        preferences: [
          { $type: 'app.bsky.actor.defs#adultContentPref', enabled: false },
          {
            $type: 'com.atproto.server.defs#unknown',
            // @ts-expect-error un-spec'ed prop
            hello: 'world',
          },
        ],
      },
      { headers: sc.getHeaders(sc.dids.alice), encoding: 'application/json' },
    )
    await expect(tryPut).rejects.toThrow(
      'Some preferences are not in the app.bsky namespace',
    )
  })

  it('fails putting preferences without $type.', async () => {
    const tryPut = agent.api.app.bsky.actor.putPreferences(
      {
        preferences: [
          { $type: 'app.bsky.actor.defs#adultContentPref', enabled: false },
          // @ts-expect-error this is what we are testing !
          {
            label: 'dogs',
            visibility: 'warn',
          },
        ],
      },
      { headers: sc.getHeaders(sc.dids.alice), encoding: 'application/json' },
    )
    await expect(tryPut).rejects.toThrow(
      'Input/preferences/1 must be an object which includes the "$type" property',
    )
  })

  it('does not read permissioned preferences with an app password', async () => {
    await agent.api.app.bsky.actor.putPreferences(
      {
        preferences: [
          {
            $type: 'app.bsky.actor.defs#personalDetailsPref',
            birthDate: new Date().toISOString(),
          },
        ],
      },
      { headers: sc.getHeaders(sc.dids.alice), encoding: 'application/json' },
    )
    const res = await agent.api.app.bsky.actor.getPreferences(
      {},
      { headers: appPassHeaders },
    )
    expect(res.data.preferences).toEqual([])
  })

  it('does not write permissioned preferences with an app password', async () => {
    const tryPut = agent.api.app.bsky.actor.putPreferences(
      {
        preferences: [
          {
            $type: 'app.bsky.actor.defs#personalDetailsPref',
            birthDate: new Date().toISOString(),
          },
        ],
      },
      { headers: appPassHeaders, encoding: 'application/json' },
    )
    await expect(tryPut).rejects.toThrow(
      /Do not have authorization to set preferences/,
    )
  })

  it('does not remove permissioned preferences with an app password', async () => {
    await agent.api.app.bsky.actor.putPreferences(
      {
        preferences: [],
      },
      { headers: appPassHeaders, encoding: 'application/json' },
    )
    const res = await agent.api.app.bsky.actor.getPreferences(
      {},
      { headers: sc.getHeaders(sc.dids.alice) },
    )
    const scopedPref = res.data.preferences.find(
      (pref) => pref.$type === 'app.bsky.actor.defs#personalDetailsPref',
    )
    expect(scopedPref).toBeDefined()
  })

  describe('privacy settings (privateProfilePref)', () => {
    it('creates private profile preference with default value.', async () => {
      await agent.api.app.bsky.actor.putPreferences(
        {
          preferences: [
            {
              $type: 'app.bsky.actor.defs#privateProfilePref',
              isPrivate: false,
            },
          ],
        },
        { headers: sc.getHeaders(sc.dids.alice), encoding: 'application/json' },
      )

      const { data } = await agent.api.app.bsky.actor.getPreferences(
        {},
        { headers: sc.getHeaders(sc.dids.alice) },
      )

      expect(data.preferences).toContainEqual({
        $type: 'app.bsky.actor.defs#privateProfilePref',
        isPrivate: false,
      })
    })

    it('updates isPrivate flag to true.', async () => {
      await agent.api.app.bsky.actor.putPreferences(
        {
          preferences: [
            {
              $type: 'app.bsky.actor.defs#privateProfilePref',
              isPrivate: true,
            },
          ],
        },
        { headers: sc.getHeaders(sc.dids.alice), encoding: 'application/json' },
      )

      const { data } = await agent.api.app.bsky.actor.getPreferences(
        {},
        { headers: sc.getHeaders(sc.dids.alice) },
      )

      expect(data.preferences).toContainEqual({
        $type: 'app.bsky.actor.defs#privateProfilePref',
        isPrivate: true,
      })
    })

    it('updates isPrivate flag back to false.', async () => {
      await agent.api.app.bsky.actor.putPreferences(
        {
          preferences: [
            {
              $type: 'app.bsky.actor.defs#privateProfilePref',
              isPrivate: false,
            },
          ],
        },
        { headers: sc.getHeaders(sc.dids.alice), encoding: 'application/json' },
      )

      const { data } = await agent.api.app.bsky.actor.getPreferences(
        {},
        { headers: sc.getHeaders(sc.dids.alice) },
      )

      expect(data.preferences).toContainEqual({
        $type: 'app.bsky.actor.defs#privateProfilePref',
        isPrivate: false,
      })
    })

    it('retrieves privacy settings for multiple users independently.', async () => {
      // Set alice to private
      await agent.api.app.bsky.actor.putPreferences(
        {
          preferences: [
            {
              $type: 'app.bsky.actor.defs#privateProfilePref',
              isPrivate: true,
            },
          ],
        },
        { headers: sc.getHeaders(sc.dids.alice), encoding: 'application/json' },
      )

      // Set bob to public
      await agent.api.app.bsky.actor.putPreferences(
        {
          preferences: [
            {
              $type: 'app.bsky.actor.defs#privateProfilePref',
              isPrivate: false,
            },
          ],
        },
        { headers: sc.getHeaders(sc.dids.bob), encoding: 'application/json' },
      )

      // Check alice is private
      const aliceData = await agent.api.app.bsky.actor.getPreferences(
        {},
        { headers: sc.getHeaders(sc.dids.alice) },
      )
      expect(aliceData.data.preferences).toContainEqual({
        $type: 'app.bsky.actor.defs#privateProfilePref',
        isPrivate: true,
      })

      // Check bob is public
      const bobData = await agent.api.app.bsky.actor.getPreferences(
        {},
        { headers: sc.getHeaders(sc.dids.bob) },
      )
      expect(bobData.data.preferences).toContainEqual({
        $type: 'app.bsky.actor.defs#privateProfilePref',
        isPrivate: false,
      })
    })

    it('persists privacy settings across sessions.', async () => {
      // Set privacy setting
      await agent.api.app.bsky.actor.putPreferences(
        {
          preferences: [
            {
              $type: 'app.bsky.actor.defs#privateProfilePref',
              isPrivate: true,
            },
          ],
        },
        { headers: sc.getHeaders(sc.dids.carol), encoding: 'application/json' },
      )

      // Read directly from database
      const dbPrefs = await network.pds.ctx.actorStore.read(
        sc.dids.carol,
        (store) =>
          store.pref.getPreferences('app.bsky', { hasAccessFull: true }),
      )

      expect(dbPrefs).toContainEqual({
        $type: 'app.bsky.actor.defs#privateProfilePref',
        isPrivate: true,
      })
    })

    it('removes privacy settings when not included in put operation.', async () => {
      // First set privacy preference
      await agent.api.app.bsky.actor.putPreferences(
        {
          preferences: [
            {
              $type: 'app.bsky.actor.defs#privateProfilePref',
              isPrivate: true,
            },
          ],
        },
        { headers: sc.getHeaders(sc.dids.dan), encoding: 'application/json' },
      )

      // Verify it's set
      let { data } = await agent.api.app.bsky.actor.getPreferences(
        {},
        { headers: sc.getHeaders(sc.dids.dan) },
      )
      expect(data.preferences).toContainEqual({
        $type: 'app.bsky.actor.defs#privateProfilePref',
        isPrivate: true,
      })

      // Put preferences without privacy setting
      await agent.api.app.bsky.actor.putPreferences(
        {
          preferences: [
            { $type: 'app.bsky.actor.defs#adultContentPref', enabled: false },
          ],
        },
        { headers: sc.getHeaders(sc.dids.dan), encoding: 'application/json' },
      )

      // Verify privacy setting is removed
      ;({ data } = await agent.api.app.bsky.actor.getPreferences(
        {},
        { headers: sc.getHeaders(sc.dids.dan) },
      ))
      expect(data.preferences).not.toContainEqual(
        expect.objectContaining({
          $type: 'app.bsky.actor.defs#privateProfilePref',
        }),
      )
    })
  })
})

describe('privacy settings endpoints', () => {
  // Reuse the same network and agent from the parent scope
  let aliceAgent: AtpAgent
  let bobAgent: AtpAgent

  beforeAll(async () => {
    aliceAgent = network.pds.getClient()
    bobAgent = network.pds.getClient()

    await aliceAgent.createAccount({
      email: 'alice-ep@test.com',
      handle: 'alice-ep.test',
      password: 'alice-pass',
    })

    await bobAgent.createAccount({
      email: 'bob-ep@test.com',
      handle: 'bob-ep.test',
      password: 'bob-pass',
    })
  })

  describe('setPrivacySettings', () => {
    it('sets privacy to private', async () => {
      const res = await aliceAgent.api.app.bsky.actor.setPrivacySettings({
        isPrivate: true,
      })

      expect(res.data.isPrivate).toBe(true)
    })

    it('sets privacy to public', async () => {
      const res = await aliceAgent.api.app.bsky.actor.setPrivacySettings({
        isPrivate: false,
      })

      expect(res.data.isPrivate).toBe(false)
    })

    it('requires authentication', async () => {
      const unauthAgent = network.pds.getClient()

      await expect(
        unauthAgent.api.app.bsky.actor.setPrivacySettings({
          isPrivate: true,
        }),
      ).rejects.toThrow()
    })

    it('validates input type', async () => {
      await expect(
        aliceAgent.api.app.bsky.actor.setPrivacySettings({
          isPrivate: 'invalid' as any,
        }),
      ).rejects.toThrow()
    })
  })

  describe('getPrivacySettings', () => {
    beforeAll(async () => {
      // Set Bob's profile to private
      await bobAgent.api.app.bsky.actor.setPrivacySettings({
        isPrivate: true,
      })
    })

    it('gets own privacy settings when authenticated', async () => {
      const res = await bobAgent.api.app.bsky.actor.getPrivacySettings()

      expect(res.data.isPrivate).toBe(true)
    })

    it('gets other user public privacy settings', async () => {
      // Alice is public by default
      const res = await bobAgent.api.app.bsky.actor.getPrivacySettings({
        actor: aliceAgent.accountDid,
      })

      expect(res.data.isPrivate).toBe(false)
    })

    it('denies access to other user private settings', async () => {
      // Bob is private, Alice tries to view
      await expect(
        aliceAgent.api.app.bsky.actor.getPrivacySettings({
          actor: bobAgent.accountDid,
        }),
      ).rejects.toThrow(/not authorized/i)
    })

    it('returns false for users without privacy settings', async () => {
      // Carol has never set privacy settings
      const carolAgent = network.pds.getClient()
      await carolAgent.createAccount({
        email: 'carol-ep@test.com',
        handle: 'carol-ep.test',
        password: 'carol-pass',
      })

      const res = await carolAgent.api.app.bsky.actor.getPrivacySettings()
      expect(res.data.isPrivate).toBe(false)
    })

    it('requires authentication', async () => {
      const unauthAgent = network.pds.getClient()

      await expect(
        unauthAgent.api.app.bsky.actor.getPrivacySettings(),
      ).rejects.toThrow()
    })
  })

  describe('privacy settings integration', () => {
    it('updates settings multiple times', async () => {
      // Toggle privacy on
      let res = await aliceAgent.api.app.bsky.actor.setPrivacySettings({
        isPrivate: true,
      })
      expect(res.data.isPrivate).toBe(true)

      // Verify it persisted
      let getRes = await aliceAgent.api.app.bsky.actor.getPrivacySettings()
      expect(getRes.data.isPrivate).toBe(true)

      // Toggle privacy off
      res = await aliceAgent.api.app.bsky.actor.setPrivacySettings({
        isPrivate: false,
      })
      expect(res.data.isPrivate).toBe(false)

      // Verify it persisted
      getRes = await aliceAgent.api.app.bsky.actor.getPrivacySettings()
      expect(getRes.data.isPrivate).toBe(false)
    })
  })
})