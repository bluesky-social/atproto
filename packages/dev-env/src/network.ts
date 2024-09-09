import assert from 'assert'
import * as uint8arrays from 'uint8arrays'
import getPort from 'get-port'
import { wait } from '@atproto/common-web'
import { createServiceJwt } from '@atproto/xrpc-server'
import { TestServerParams } from './types'
import { TestPlc } from './plc'
import { TestPds } from './pds'
import { TestBsky } from './bsky'
import { TestOzone } from './ozone'
import { OzoneServiceProfile } from './ozone-service-profile'
import { mockNetworkUtilities } from './util'
import { TestNetworkNoAppView } from './network-no-appview'
import { EXAMPLE_LABELER } from './const'
import { IntrospectServer } from './introspect'

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

    const thirdPartyPdsProps = {
      didPlcUrl: plc.url,
      ...params.pds,
      inviteRequired: false,
      port: await getPort(),
    }
    const thirdPartyPds = await TestPds.create(thirdPartyPdsProps)
    const ozoneServiceProfile = new OzoneServiceProfile(thirdPartyPds)
    const { did: ozoneDid, key: ozoneKey } =
      await ozoneServiceProfile.createDidAndKey()

    const bsky = await TestBsky.create({
      port: bskyPort,
      plcUrl: plc.url,
      pdsPort,
      repoProvider: `ws://localhost:${pdsPort}`,
      dbPostgresSchema: `appview_${dbPostgresSchema}`,
      dbPostgresUrl,
      redisHost,
      modServiceDid: ozoneDid,
      labelsFromIssuerDids: [ozoneDid, EXAMPLE_LABELER],
      ...params.bsky,
    })

    const modServiceUrl = `http://localhost:${ozonePort}`
    const pdsProps = {
      port: pdsPort,
      didPlcUrl: plc.url,
      bskyAppViewUrl: bsky.url,
      bskyAppViewDid: bsky.ctx.cfg.serverDid,
      modServiceUrl,
      modServiceDid: ozoneDid,
      ...params.pds,
    }

    const pds = await TestPds.create(pdsProps)

    const ozone = await TestOzone.create({
      port: ozonePort,
      plcUrl: plc.url,
      signingKey: ozoneKey,
      serverDid: ozoneDid,
      dbPostgresSchema: `ozone_${dbPostgresSchema || 'db'}`,
      dbPostgresUrl,
      appviewUrl: bsky.url,
      appviewDid: bsky.ctx.cfg.serverDid,
      appviewPushEvents: true,
      pdsUrl: pds.url,
      pdsDid: pds.ctx.cfg.service.did,
      ...params.ozone,
    })

    let inviteCode: string | undefined
    if (pdsProps.inviteRequired) {
      const { data: invite } = await pds
        .getClient()
        .api.com.atproto.server.createInviteCode(
          { useCount: 1 },
          {
            encoding: 'application/json',
            headers: pds.adminAuthHeaders(),
          },
        )
      inviteCode = invite.code
    }
    await ozoneServiceProfile.createServiceDetails(pds, modServiceUrl, {
      inviteCode,
    })

    await ozone.addAdminDid(ozoneDid)

    mockNetworkUtilities(pds, bsky)
    await pds.processAll()
    await bsky.sub.processAll()
    await thirdPartyPds.close()

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
