import { decodeJwt } from 'jose'
import type { TestNetworkNoAppView } from '@atproto/dev-env'
import { JoseKey } from '@atproto/oauth-provider/provider'
import { spaceHostAud } from '@atproto/space'
import type { UriString } from '@atproto/syntax'
import { com } from '../../src/lexicons/index.js'
import {
  type Actor,
  MockClientApp,
  MockService,
  type SpaceClient,
  createSpaceNetwork,
} from '../_space.js'

const { personalspace, memberspace, managedspace } = com.atproto

describe('space access', () => {
  let network: TestNetworkNoAppView
  let sc: SpaceClient
  let alice: Actor
  let dan: Actor
  let bob: Actor
  let carol: Actor
  let clientApp: MockClientApp

  beforeAll(async () => {
    ;({ network, sc, alice, dan, bob, carol } = await createSpaceNetwork())
    clientApp = await MockClientApp.create()
    clientApp.installOn(network.pds)
  })

  afterAll(async () => {
    await clientApp?.close()
    await network?.close()
  })

  const attest = ({
    app = clientApp,
    signWith,
  }: { app?: MockClientApp; signWith?: JoseKey } = {}) =>
    app.attest(spaceHostAud(alice.did), { signWith })

  const memberspaceWith = (
    config: Parameters<typeof memberspace.policy.$build>[0],
  ) => sc.createSpace(alice, { policy: memberspace.policy.$build(config) })

  it("always admits the authority's account, whatever the policy", async () => {
    for (const policy of [
      personalspace.policy.$build({}),
      managedspace.policy.$build({
        managingApp: 'did:web:unreachable.invalid#forum',
      }),
    ]) {
      const space = await sc.createSpace(alice, { policy })
      await sc.credentialFor(alice, space)
    }
  })

  describe('memberspace', () => {
    const OTHER_APP =
      'https://other.example.com/client-metadata.json' as UriString

    it('mints for anyone when read access is public, with or without a delegation token', async () => {
      const space = await memberspaceWith({ publicRead: true })
      await sc.credentialFor(carol, space)
      await sc.authorize(space)
    })

    it('hides the space from a non-member or a tokenless request when read access is not public', async () => {
      const space = await memberspaceWith({})
      await expect(sc.credentialFor(carol, space)).rejects.toMatchObject({
        error: 'SpaceNotFound',
      })
      await expect(sc.authorize(space)).rejects.toMatchObject({
        error: 'SpaceNotFound',
      })
    })

    it('hides the space from a member without read access', async () => {
      const space = await memberspaceWith({})
      await sc.putMember(alice, space, carol, { read: false, write: true })
      await expect(sc.credentialFor(carol, space)).rejects.toMatchObject({
        error: 'SpaceNotFound',
      })
    })

    it('hides the space before checking the app', async () => {
      const space = await memberspaceWith({ allowedApps: [OTHER_APP] })
      await expect(sc.credentialFor(carol, space)).rejects.toMatchObject({
        error: 'SpaceNotFound',
      })
      await expect(sc.authorize(space)).rejects.toMatchObject({
        error: 'SpaceNotFound',
      })
    })

    it('refuses an unattested request when apps are restricted', async () => {
      const space = await memberspaceWith({
        publicRead: true,
        allowedApps: [OTHER_APP],
      })
      await expect(sc.authorize(space)).rejects.toMatchObject({
        error: 'AppNotAuthorized',
      })
    })
  })

  describe('client attestation', () => {
    const allowingClientApp = () =>
      memberspaceWith({ publicRead: true, allowedApps: [clientApp.clientId] })

    it('mints for an allow-listed app, with or without a delegation token', async () => {
      const space = await allowingClientApp()
      await sc.credentialFor(carol, space, {
        clientAttestation: await attest(),
      })
      await sc.authorize(space, { clientAttestation: await attest() })
    })

    it("refuses an attestation not signed by the app's published key", async () => {
      const space = await allowingClientApp()
      const forged = await attest({
        signWith: await JoseKey.generate(['ES256'], 'key-1'),
      })
      await expect(
        sc.authorize(space, { clientAttestation: forged }),
      ).rejects.toMatchObject({
        error: 'InvalidClientAttestation',
        message: `Invalid client attestation for "${clientApp.clientId}"`,
      })
    })

    it('refuses an attestation addressed to another space host', async () => {
      const space = await allowingClientApp()
      const misaddressed = await clientApp.attest(spaceHostAud(bob.did))
      await expect(
        sc.authorize(space, { clientAttestation: misaddressed }),
      ).rejects.toMatchObject({
        error: 'InvalidClientAttestation',
        message: `Invalid client attestation for "${clientApp.clientId}"`,
      })
    })

    it('refuses an app that is not allow-listed', async () => {
      await using other = await MockClientApp.create()
      const space = await allowingClientApp()
      await expect(
        sc.authorize(space, {
          clientAttestation: await attest({ app: other }),
        }),
      ).rejects.toMatchObject({ error: 'AppNotAuthorized' })
    })
  })

  describe('personalspace', () => {
    const personalSpace = () =>
      sc.createSpace(alice, { policy: personalspace.policy.$build({}) })

    it('hides the space from anyone but the authority', async () => {
      const space = await personalSpace()
      await expect(sc.credentialFor(carol, space)).rejects.toMatchObject({
        error: 'SpaceNotFound',
      })
      await expect(sc.authorize(space)).rejects.toMatchObject({
        error: 'SpaceNotFound',
      })
    })

    it('tracks no writer but the authority', async () => {
      const space = await personalSpace()
      await sc.write(alice, space)
      // Dan may write to his own repo in the space, but the authority refuses
      // its notification.
      await sc.write(dan, space)

      expect(await sc.writers(space, alice)).toEqual([alice.did])
    })
  })

  describe('managedspace', () => {
    const { checkAccess } = managedspace

    type Answer = { status: number; body: unknown }
    const OUTAGE: Answer = { status: 500, body: { error: 'InternalError' } }

    const managingApp = (respond: () => Answer) =>
      MockService.create(network, { serviceId: 'atproto_forum', respond })

    const answering = (access: { read: boolean; write: boolean }) =>
      managingApp(() => ({ status: 200, body: access }))

    const managedSpace = (app: MockService | string) =>
      sc.createSpace(alice, {
        policy: managedspace.policy.$build({
          managingApp: typeof app === 'string' ? app : app.serviceRef,
        }),
      })

    const questions = (app: MockService) =>
      app.callsTo(checkAccess.$lxm).map((call) => call.body)

    it('asks the managing app, with service auth from the authority', async () => {
      await using app = await answering({ read: true, write: true })
      const space = await managedSpace(app)

      await sc.credentialFor(carol, space)
      expect(questions(app)).toEqual([{ space, repo: carol.did }])

      const [scheme, jwt] = app.callsTo(checkAccess.$lxm)[0].auth!.split(' ')
      expect(scheme).toBe('Bearer')
      expect(decodeJwt(jwt)).toMatchObject({
        iss: alice.did,
        aud: app.serviceRef,
        lxm: checkAccess.$lxm,
      })
    })

    it('asks the managing app about a tokenless request', async () => {
      await using app = await answering({ read: true, write: true })
      const space = await managedSpace(app)

      await sc.authorize(space)
      expect(questions(app)).toEqual([{ space }])
    })

    it('tells the managing app which client is asking', async () => {
      await using app = await answering({ read: true, write: true })
      const space = await managedSpace(app)

      await sc.credentialFor(carol, space, {
        clientAttestation: await attest(),
      })
      expect(questions(app)).toEqual([
        { space, repo: carol.did, clientId: clientApp.clientId },
      ])
    })

    it('hides the space from a user the managing app declines', async () => {
      await using app = await answering({ read: false, write: false })
      const space = await managedSpace(app)

      await expect(sc.credentialFor(carol, space)).rejects.toMatchObject({
        error: 'SpaceNotFound',
      })
      await expect(sc.authorize(space)).rejects.toMatchObject({
        error: 'SpaceNotFound',
      })
    })

    it('fails with UpstreamFailure when the managing app errors or cannot be resolved', async () => {
      await using app = await managingApp(() => OUTAGE)
      const failing = await managedSpace(app)
      const unresolvable = await managedSpace(
        'did:web:nonexistent.invalid#forum',
      )

      for (const space of [failing, unresolvable]) {
        await expect(sc.credentialFor(carol, space)).rejects.toMatchObject({
          error: 'UpstreamFailure',
        })
      }
    })

    it('records a writer the managing app admits, even one it does not let read', async () => {
      await using app = await answering({ read: false, write: true })
      const space = await managedSpace(app)

      await sc.write(dan, space)
      expect(await sc.writers(space, alice)).toEqual([dan.did])
      expect(questions(app)).toEqual([{ space, repo: dan.did }])

      await expect(sc.credentialFor(dan, space)).rejects.toMatchObject({
        error: 'SpaceNotFound',
      })
    })

    it('retries a write notification through a managing app outage', async () => {
      let answer = OUTAGE
      await using app = await managingApp(() => answer)
      const space = await managedSpace(app)

      await sc.write(bob, space)
      expect(await sc.writers(space, alice)).toEqual([])

      answer = { status: 200, body: { read: false, write: true } }
      await sc.retryNotifications(bob.pds)
      expect(await sc.writers(space, alice)).toEqual([bob.did])
    })
  })
})
