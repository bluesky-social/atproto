import assert from 'node:assert'
import getPort from 'get-port'
import * as uint8arrays from 'uint8arrays'
import { wait } from '@atproto/common-web'
import { createServiceJwt } from '@atproto/xrpc-server'
import { TestBsky } from './bsky'
import { EXAMPLE_LABELER } from './const'
import { IntrospectServer } from './introspect'
import { TestNetworkNoAppView } from './network-no-appview'
import { TestOzone } from './ozone'
import { TestPds } from './pds'
import { TestPlc } from './plc'
import { LexiconAuthorityProfile } from './service-profile-lexicon'
import { OzoneServiceProfile } from './service-profile-ozone'
import { TestServerParams } from './types'
import { mockNetworkUtilities } from './util'

const ADMIN_USERNAME = 'admin'
const ADMIN_PASSWORD = 'admin-pass'

export class TestNetwork extends TestNetworkNoAppView {
  constructor(
    public plc: TestPlc,
    public pds: TestPds,
    public bsky: TestBsky,
    public ozone: TestOzone,
    public introspect?: IntrospectServer,
  ) {
    super(plc, pds)
  }

  static async create(
    params: Partial<TestServerParams> = {},
  ): Promise<TestNetwork> {
    const redisHost = process.env.REDIS_HOST
    const dbPostgresUrl = params.dbPostgresUrl || process.env.DB_POSTGRES_URL
    assert(dbPostgresUrl, 'Missing postgres url for tests')
    assert(redisHost, 'Missing redis host for tests')
    const dbPostgresSchema =
      params.dbPostgresSchema || process.env.DB_POSTGRES_SCHEMA

    const plc = await TestPlc.create(params.plc ?? {})

    const bskyPort = params.bsky?.port ?? (await getPort())
    const pdsPort = params.pds?.port ?? (await getPort())
    const ozonePort = params.ozone?.port ?? (await getPort())

    const thirdPartyPds = await TestPds.create({
      didPlcUrl: plc.url,
      ...params.pds,
      inviteRequired: false,
      port: await getPort(),
    })

    const ozoneUrl = `http://localhost:${ozonePort}`

    // @TODO (?) rework the ServiceProfile to live on a separate PDS instead of
    // requiring to migrate to the main PDS
    const ozoneServiceProfile = await OzoneServiceProfile.create(
      thirdPartyPds,
      ozoneUrl,
    )
    const lexiconAuthorityProfile =
      await LexiconAuthorityProfile.create(thirdPartyPds)

    const bsky = await TestBsky.create({
      port: bskyPort,
      plcUrl: plc.url,
      pdsPort,
      rolodexUrl: process.env.BSKY_ROLODEX_URL,
      rolodexIgnoreBadTls: true,
      repoProvider: `ws://localhost:${pdsPort}`,
      dbPostgresSchema: `appview_${dbPostgresSchema}`,
      dbPostgresUrl,
      redisHost,
      modServiceDid: ozoneServiceProfile.did,
      labelsFromIssuerDids: [ozoneServiceProfile.did, EXAMPLE_LABELER],
      // Using a static private key results in a static DID, which is useful for e2e tests with the social-app repo.
      privateKey:
        '3f916c70dc69e4c5e83877f013325b11ecac31742e6a42f5c4fb240d0703d9d5=',
      ...params.bsky,
    })

    const pds = await TestPds.create({
      port: pdsPort,
      didPlcUrl: plc.url,
      bskyAppViewUrl: bsky.url,
      bskyAppViewDid: bsky.ctx.cfg.serverDid,
      modServiceUrl: ozoneUrl,
      modServiceDid: ozoneServiceProfile.did,
      lexiconDidAuthority: lexiconAuthorityProfile.did,
      ...params.pds,
    })

    // mock before any events start flowing from pds so that we don't miss e.g. any handle resolutions.
    mockNetworkUtilities(pds, bsky)

    const ozone = await TestOzone.create({
      port: ozonePort,
      plcUrl: plc.url,
      signingKey: ozoneServiceProfile.key,
      serverDid: ozoneServiceProfile.did,
      dbPostgresSchema: `ozone_${dbPostgresSchema || 'db'}`,
      dbPostgresUrl,
      appviewUrl: bsky.url,
      appviewDid: bsky.ctx.cfg.serverDid,
      appviewPushEvents: true,
      pdsUrl: pds.url,
      pdsDid: pds.ctx.cfg.service.did,
      verifierDid: ozoneServiceProfile.did,
      verifierUrl: pds.url,
      verifierPassword: 'temp',
      ...params.ozone,
    })

    await ozoneServiceProfile.migrateTo(pds)
    await ozoneServiceProfile.createRecords()

    await lexiconAuthorityProfile.migrateTo(pds)
    await lexiconAuthorityProfile.createRecords()

    await ozone.addAdminDid(ozoneServiceProfile.did)
    await ozone.createPolicies()

    await thirdPartyPds.processAll()
    await pds.processAll()
    await ozone.processAll()
    await bsky.sub.processAll()
    await thirdPartyPds.close()

    // Weird but if we do this before pds.processAll() somehow appview loses this user and tests in different parts fail because appview doesn't return this user in various contexts anymore
    const ozoneVerifierPassword =
      await ozoneServiceProfile.createAppPasswordForVerification()
    if (ozone.daemon.ctx.cfg.verifier) {
      ozone.daemon.ctx.cfg.verifier.password = ozoneVerifierPassword
    }

    let introspect: IntrospectServer | undefined = undefined
    if (params.introspect?.port) {
      introspect = await IntrospectServer.start(
        params.introspect.port,
        plc,
        pds,
        bsky,
        ozone,
      )
    }

    return new TestNetwork(plc, pds, bsky, ozone, introspect)
  }

  async processFullSubscription(timeout = 5000) {
    const sub = this.bsky.sub
    const start = Date.now()
    const lastSeq = await this.pds.ctx.sequencer.curr()
    if (!lastSeq) return
    while (Date.now() - start < timeout) {
      await sub.processAll()
      const runnerCursor = await sub.runner.getCursor()
      // if subscription claims to be done, ensure we are at the most recent cursor from PDS, else wait to process again
      // (the subscription may claim to be finished before the PDS has even emitted it's event)
      if (runnerCursor && runnerCursor >= lastSeq) {
        return
      }
      await wait(5)
    }
    throw new Error(`Sequence was not processed within ${timeout}ms`)
  }

  async processAll(timeout?: number) {
    await this.pds.processAll()
    await this.ozone.processAll()
    await this.processFullSubscription(timeout)
  }

  async serviceHeaders(did: string, lxm: string, aud?: string) {
    const keypair = await this.pds.ctx.actorStore.keypair(did)
    const jwt = await createServiceJwt({
      iss: did,
      aud: aud ?? this.bsky.ctx.cfg.serverDid,
      lxm,
      keypair,
    })
    return { authorization: `Bearer ${jwt}` }
  }

  async adminHeaders({
    username = ADMIN_USERNAME,
    password = ADMIN_PASSWORD,
  }: {
    username?: string
    password?: string
  }) {
    return {
      authorization:
        'Basic ' +
        uint8arrays.toString(
          uint8arrays.fromString(`${username}:${password}`, 'utf8'),
          'base64pad',
        ),
    }
  }

  async close() {
    await Promise.all(this.feedGens.map((fg) => fg.close()))
    await this.ozone.close()
    await this.bsky.close()
    await this.pds.close()
    await this.plc.close()
    await this.introspect?.close()
  }
}
