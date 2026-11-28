import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { AtpAgent } from '@atproto/api'
import { TestNetworkNoAppView } from '@atproto/dev-env'

// @NOTE behaviors that @atproto/api's session and preference helpers rely on,
// and which its own tests can only stub
describe('session and preferences contract', () => {
  let network: TestNetworkNoAppView
  let agent: AtpAgent

  beforeAll(async () => {
    network = await TestNetworkNoAppView.create({
      dbPostgresSchema: 'session_and_preferences_contract',
      pds: { enableDidDocWithSession: true },
    })
    agent = network.pds.getAgent()
  })

  afterAll(async () => {
    await network?.close()
  })

  const createAccount = async (name: string) => {
    const email = `${name}@test.com`
    const { data } = await agent.com.atproto.server.createAccount({
      handle: `${name}.test`,
      email,
      password: 'password',
    })
    return { ...data, email }
  }

  const authHeaders = (jwt: string) => ({ authorization: `Bearer ${jwt}` })

  describe('sessions', () => {
    it('returns the did document with every session when enableDidDocWithSession is set', async () => {
      const account = await createAccount('diddoc')
      const didDoc = {
        id: account.did,
        alsoKnownAs: [`at://${account.handle}`],
        service: expect.arrayContaining([
          expect.objectContaining({
            id: '#atproto_pds',
            type: 'AtprotoPersonalDataServer',
            serviceEndpoint: network.pds.url,
          }),
        ]),
      }

      expect(account.didDoc).toMatchObject(didDoc)

      const { data: created } = await agent.com.atproto.server.createSession({
        identifier: account.handle,
        password: 'password',
      })
      expect(created.didDoc).toMatchObject(didDoc)

      const { data: info } = await agent.com.atproto.server.getSession(
        {},
        { headers: authHeaders(created.accessJwt) },
      )
      expect(info.didDoc).toMatchObject(didDoc)

      const { data: refreshed } = await agent.com.atproto.server.refreshSession(
        undefined,
        {
          headers: authHeaders(created.refreshJwt),
        },
      )
      expect(refreshed.didDoc).toMatchObject(didDoc)
    })

    it('returns the email and its confirmation status on session creation and refresh', async () => {
      const account = await createAccount('emailinfo')

      const { data: created } = await agent.com.atproto.server.createSession({
        identifier: account.handle,
        password: 'password',
      })
      expect(created).toMatchObject({
        email: account.email,
        emailConfirmed: false,
      })

      const { data: refreshed } = await agent.com.atproto.server.refreshSession(
        undefined,
        {
          headers: authHeaders(created.refreshJwt),
        },
      )
      expect(refreshed).toMatchObject({
        email: account.email,
        emailConfirmed: false,
      })
    })

    it('rejects a malformed refresh token with InvalidToken', async () => {
      await expect(
        agent.com.atproto.server.refreshSession(undefined, {
          headers: authHeaders('bad'),
        }),
      ).rejects.toMatchObject({ status: 400, error: 'InvalidToken' })
    })
  })

  describe('preferences', () => {
    it('computes a declaredAgePref with every flag unset for a minor', async () => {
      const account = await createAccount('minor')
      const birthDate = new Date()
      birthDate.setFullYear(birthDate.getFullYear() - 3)

      await agent.app.bsky.actor.putPreferences(
        {
          preferences: [
            {
              $type: 'app.bsky.actor.defs#personalDetailsPref',
              birthDate: birthDate.toISOString(),
            },
          ],
        },
        { headers: authHeaders(account.accessJwt) },
      )
      const { data } = await agent.app.bsky.actor.getPreferences(
        {},
        { headers: authHeaders(account.accessJwt) },
      )
      expect(data.preferences).toContainEqual({
        $type: 'app.bsky.actor.defs#declaredAgePref',
        isOverAge13: false,
        isOverAge16: false,
        isOverAge18: false,
      })
    })

    it('preserves fields that the lexicon does not define', async () => {
      const account = await createAccount('unspecced')
      const preferences = [
        {
          $type: 'app.bsky.actor.defs#bskyAppStatePref',
          activeProgressGuide: { guide: 'test-guide', numThings: 1 },
        },
      ]

      await agent.app.bsky.actor.putPreferences(
        { preferences },
        { headers: authHeaders(account.accessJwt) },
      )
      const { data } = await agent.app.bsky.actor.getPreferences(
        {},
        { headers: authHeaders(account.accessJwt) },
      )
      expect(data.preferences).toEqual(preferences)
    })
  })
})
