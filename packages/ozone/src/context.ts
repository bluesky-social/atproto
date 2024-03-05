import * as plc from '@did-plc/lib'
import { IdResolver } from '@atproto/identity'
import { AtpAgent } from '@atproto/api'
import { Keypair, Secp256k1Keypair } from '@atproto/crypto'
import { createServiceAuthHeaders } from '@atproto/xrpc-server'
import { Database } from './db'
import { OzoneConfig, OzoneSecrets } from './config'
import { ModerationService, ModerationServiceCreator } from './mod-service'
import * as auth from './auth'
import { BackgroundQueue } from './background'
import assert from 'assert'
import { EventPusher } from './daemon'
import Sequencer from './sequencer/sequencer'
import {
  CommunicationTemplateService,
  CommunicationTemplateServiceCreator,
} from './communication-service/template'
import { ImageInvalidator } from './image-invalidator'

export type AppContextOptions = {
  db: Database
  cfg: OzoneConfig
  modService: ModerationServiceCreator
  communicationTemplateService: CommunicationTemplateServiceCreator
  appviewAgent: AtpAgent
  pdsAgent: AtpAgent | undefined
  signingKey: Keypair
  idResolver: IdResolver
  imgInvalidator?: ImageInvalidator
  backgroundQueue: BackgroundQueue
  sequencer: Sequencer
}

export class AppContext {
  constructor(private opts: AppContextOptions, private secrets: OzoneSecrets) {}

  static async fromConfig(
    cfg: OzoneConfig,
    secrets: OzoneSecrets,
    overrides?: Partial<AppContextOptions>,
  ): Promise<AppContext> {
    const db = new Database({
      url: cfg.db.postgresUrl,
      schema: cfg.db.postgresSchema,
      poolSize: cfg.db.poolSize,
      poolMaxUses: cfg.db.poolMaxUses,
      poolIdleTimeoutMs: cfg.db.poolIdleTimeoutMs,
    })
    const signingKey = await Secp256k1Keypair.import(secrets.signingKeyHex)
    const appviewAgent = new AtpAgent({ service: cfg.appview.url })
    const pdsAgent = cfg.pds
      ? new AtpAgent({ service: cfg.pds.url })
      : undefined

    const createAuthHeaders = (aud: string) =>
      createServiceAuthHeaders({
        iss: cfg.service.did,
        aud,
        keypair: signingKey,
      })

    const backgroundQueue = new BackgroundQueue(db)
    const eventPusher = new EventPusher(db, createAuthHeaders, {
      appview: cfg.appview,
      pds: cfg.pds ?? undefined,
    })

    const idResolver = new IdResolver({
      plcUrl: cfg.identity.plcUrl,
    })

    const modService = ModerationService.creator(
      cfg,
      backgroundQueue,
      idResolver,
      eventPusher,
      appviewAgent,
      createAuthHeaders,
      cfg.service.did,
      overrides?.imgInvalidator,
      cfg.cdn.paths,
    )

    const communicationTemplateService = CommunicationTemplateService.creator()

    const sequencer = new Sequencer(db)

    return new AppContext(
      {
        db,
        cfg,
        modService,
        communicationTemplateService,
        appviewAgent,
        pdsAgent,
        signingKey,
        idResolver,
        backgroundQueue,
        sequencer,
        ...(overrides ?? {}),
      },
      secrets,
    )
  }

  assignPort(port: number) {
    assert(
      !this.cfg.service.port || this.cfg.service.port === port,
      'Conflicting port in config',
    )
    this.opts.cfg.service.port = port
  }

  get db(): Database {
    return this.opts.db
  }

  get cfg(): OzoneConfig {
    return this.opts.cfg
  }

  get modService(): ModerationServiceCreator {
    return this.opts.modService
  }

  get communicationTemplateService(): CommunicationTemplateServiceCreator {
    return this.opts.communicationTemplateService
  }

  get appviewAgent(): AtpAgent {
    return this.opts.appviewAgent
  }

  get pdsAgent(): AtpAgent | undefined {
    return this.opts.pdsAgent
  }

  get signingKey(): Keypair {
    return this.opts.signingKey
  }

  get plcClient(): plc.Client {
    return new plc.Client(this.cfg.identity.plcUrl)
  }

  get idResolver(): IdResolver {
    return this.opts.idResolver
  }

  get backgroundQueue(): BackgroundQueue {
    return this.opts.backgroundQueue
  }

  get sequencer(): Sequencer {
    return this.opts.sequencer
  }

  get authVerifier() {
    return auth.authVerifier(this.idResolver, { aud: this.cfg.service.did })
  }

  get authVerifierAnyAudience() {
    return auth.authVerifier(this.idResolver, { aud: null })
  }

  get authOptionalVerifierAnyAudience() {
    return auth.authOptionalVerifier(this.idResolver, { aud: null })
  }

  get authOptionalVerifier() {
    return auth.authOptionalVerifier(this.idResolver, {
      aud: this.cfg.service.did,
    })
  }

  get authOptionalAccessOrRoleVerifier() {
    return auth.authOptionalAccessOrRoleVerifier(
      this.idResolver,
      this.secrets,
      this.cfg.service.did,
    )
  }

  get roleVerifier() {
    return auth.roleVerifier(this.secrets)
  }

  async serviceAuthHeaders(aud: string) {
    const iss = this.cfg.service.did
    return createServiceAuthHeaders({
      iss,
      aud,
      keypair: this.signingKey,
    })
  }

  async pdsAuth() {
    if (!this.cfg.pds) {
      return undefined
    }
    return this.serviceAuthHeaders(this.cfg.pds.did)
  }

  async appviewAuth() {
    return this.serviceAuthHeaders(this.cfg.appview.did)
  }
}

export default AppContext
