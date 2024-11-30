import getPort from 'get-port'
import * as ui8 from 'uint8arrays'
import * as plc from '@did-plc/lib'
import * as ozone from '@atproto/ozone'
import { AtpAgent } from '@atproto/api'
import { createServiceJwt } from '@atproto/xrpc-server'
import { Keypair, Secp256k1Keypair } from '@atproto/crypto'
import { DidAndKey, OzoneConfig } from './types'
import { ADMIN_PASSWORD, EXAMPLE_LABELER } from './const'
import { createDidAndKey } from './util'
import { ModeratorClient } from './moderator-client'

export class TestOzone {
  constructor(
    public url: string,
    public port: number,
    public server: ozone.OzoneService,
    public daemon: ozone.OzoneDaemon,
    public adminAccnt: DidAndKey,
    public moderatorAccnt: DidAndKey,
    public triageAccnt: DidAndKey,
  ) {}

  static async create(config: OzoneConfig): Promise<TestOzone> {
    const serviceKeypair =
      config.signingKey ?? (await Secp256k1Keypair.create({ exportable: true }))
    const signingKeyHex = ui8.toString(await serviceKeypair.export(), 'hex')
    let serverDid = config.serverDid
    if (!serverDid) {
      serverDid = await createOzoneDid(config.plcUrl, serviceKeypair)
    }

    const admin = await createDidAndKey({
      plcUrl: config.plcUrl,
      handle: 'admin.ozone',
      pds: 'https://pds.invalid',
    })

    const moderator = await createDidAndKey({
      plcUrl: config.plcUrl,
      handle: 'moderator.ozone',
      pds: 'https://pds.invalid',
    })

    const triage = await createDidAndKey({
      plcUrl: config.plcUrl,
      handle: 'triage.ozone',
      pds: 'https://pds.invalid',
    })

    const port = config.port || (await getPort())
    const url = `http://localhost:${port}`

    const env: ozone.OzoneEnvironment = {
      devMode: true,
      version: '0.0.0',
      port,
      didPlcUrl: config.plcUrl,
      publicUrl: url,
      serverDid,
      signingKeyHex,
      ...config,
      adminPassword: ADMIN_PASSWORD,
      adminDids: [...(config.adminDids ?? []), admin.did],
      moderatorDids: [
        ...(config.moderatorDids ?? []),
        config.appviewDid,
        moderator.did,
      ],
      triageDids: [...(config.triageDids ?? []), triage.did],
    }

    // Separate migration db in case migration changes some connection state that we need in the tests, e.g. "alter database ... set ..."
    const migrationDb = new ozone.Database({
      schema: config.dbPostgresSchema,
      url: config.dbPostgresUrl,
    })
    if (config.migration) {
      await migrationDb.migrateToOrThrow(config.migration)
    } else {
      await migrationDb.migrateToLatestOrThrow()
    }
    await migrationDb.close()

    const cfg = ozone.envToCfg(env)
    const secrets = ozone.envToSecrets(env)

    // api server
    const server = await ozone.OzoneService.create(cfg, secrets, {
      imgInvalidator: config.imgInvalidator,
    })
    await server.start()

    const daemon = await ozone.OzoneDaemon.create(cfg, secrets)
    await daemon.start()
    // don't do event reversal in dev-env
    await daemon.ctx.eventReverser.destroy()

    return new TestOzone(url, port, server, daemon, admin, moderator, triage)
  }

  get ctx(): ozone.AppContext {
    return this.server.ctx
  }

  getClient(): AtpAgent {
    const agent = new AtpAgent({ service: this.url })
    agent.configureLabelers([EXAMPLE_LABELER])
    return agent
  }

  getModClient() {
    return new ModeratorClient(this)
  }

  async addAdminDid(did: string) {
    await this.ctx.teamService(this.ctx.db).create({
      did,
      disabled: false,
      lastUpdatedBy: this.ctx.cfg.service.did,
      role: 'tools.ozone.team.defs#roleAdmin',
    })
    this.ctx.cfg.access.admins.push(did)
  }

  async addModeratorDid(did: string) {
    await this.ctx.teamService(this.ctx.db).create({
      did,
      disabled: false,
      lastUpdatedBy: this.ctx.cfg.service.did,
      role: 'tools.ozone.team.defs#roleModerator',
    })
    this.ctx.cfg.access.moderators.push(did)
  }

  async addTriageDid(did: string) {
    await this.ctx.teamService(this.ctx.db).create({
      did,
      disabled: false,
      lastUpdatedBy: this.ctx.cfg.service.did,
      role: 'tools.ozone.team.defs#roleTriage',
    })
    this.ctx.cfg.access.triage.push(did)
  }

  async modHeaders(
    lxm: string,
    role: 'admin' | 'moderator' | 'triage' = 'moderator',
  ) {
    const account =
      role === 'admin'
        ? this.adminAccnt
        : role === 'moderator'
          ? this.moderatorAccnt
          : this.triageAccnt
    const jwt = await createServiceJwt({
      iss: account.did,
      aud: this.ctx.cfg.service.did,
      lxm,
      keypair: account.key,
    })
    return { authorization: `Bearer ${jwt}` }
  }

  async processAll() {
    await this.ctx.backgroundQueue.processAll()
    await this.daemon.processAll()
  }

  async close() {
    await this.daemon.destroy()
    await this.server.destroy()
  }
}

export const createOzoneDid = async (
  plcUrl: string,
  keypair: Keypair,
): Promise<string> => {
  const plcClient = new plc.Client(plcUrl)
  const plcOp = await plc.signOperation(
    {
      type: 'plc_operation',
      alsoKnownAs: [],
      rotationKeys: [keypair.did()],
      verificationMethods: {
        atproto_label: keypair.did(),
      },
      services: {
        atproto_labeler: {
          type: 'AtprotoLabeler',
          endpoint: 'https://ozone.public.url',
        },
      },
      prev: null,
    },
    keypair,
  )
  const did = await plc.didForCreateOp(plcOp)
  await plcClient.sendOperation(did, plcOp)
  return did
}
