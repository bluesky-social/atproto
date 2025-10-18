import assert from 'node:assert'
import * as plc from '@did-plc/lib'
import express from 'express'
import { AtpAgent } from '@atproto/api'
import { Keypair, Secp256k1Keypair } from '@atproto/crypto'
import { DidCache, IdResolver, MemoryCache } from '@atproto/identity'
import { createServiceAuthHeaders } from '@atproto/xrpc-server'
import { AuthVerifier } from './auth-verifier'
import { BackgroundQueue } from './background'
import {
  CommunicationTemplateService,
  CommunicationTemplateServiceCreator,
} from './communication-service/template'
import { OzoneConfig, OzoneSecrets } from './config'
import { EventPusher } from './daemon'
import { BlobDiverter } from './daemon/blob-diverter'
import { Database } from './db'
import { ImageInvalidator } from './image-invalidator'
import { ModerationService, ModerationServiceCreator } from './mod-service'
import {
  ModerationServiceProfile,
  ModerationServiceProfileCreator,
} from './mod-service/profile'
import { StrikeService, StrikeServiceCreator } from './mod-service/strike'
import {
  SafelinkRuleService,
  SafelinkRuleServiceCreator,
} from './safelink/service'
import {
  ScheduledActionService,
  ScheduledActionServiceCreator,
} from './scheduled-action/service'
import { Sequencer } from './sequencer/sequencer'
import { SetService, SetServiceCreator } from './set/service'
import { SettingService, SettingServiceCreator } from './setting/service'
import { TeamService, TeamServiceCreator } from './team'
import {
  LABELER_HEADER_NAME,
  ParsedLabelers,
  defaultLabelerHeader,
  getSigningKeyId,
  parseLabelerHeader,
} from './util'
import {
  VerificationIssuer,
  VerificationIssuerCreator,
} from './verification/issuer'
import {
  VerificationService,
  VerificationServiceCreator,
} from './verification/service'

export type AppContextOptions = {
  db: Database
  cfg: OzoneConfig
  modService: ModerationServiceCreator
  moderationServiceProfile: ModerationServiceProfileCreator
  communicationTemplateService: CommunicationTemplateServiceCreator
  safelinkRuleService: SafelinkRuleServiceCreator
  scheduledActionService: ScheduledActionServiceCreator
  setService: SetServiceCreator
  settingService: SettingServiceCreator
  strikeService: StrikeServiceCreator
  teamService: TeamServiceCreator
  appviewAgent: AtpAgent
  pdsAgent: AtpAgent | undefined
  chatAgent: AtpAgent | undefined
  blobDiverter?: BlobDiverter
  signingKey: Keypair
  signingKeyId: number
  didCache: DidCache
  idResolver: IdResolver
  imgInvalidator?: ImageInvalidator
  backgroundQueue: BackgroundQueue
  sequencer: Sequencer
  authVerifier: AuthVerifier
  verificationService: VerificationServiceCreator
  verificationIssuer: VerificationIssuerCreator
}

export class AppContext {
  constructor(
    private opts: AppContextOptions,
    private secrets: OzoneSecrets,
  ) {}

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
    const signingKeyId = await getSigningKeyId(db, signingKey.did())
    const appviewAgent = new AtpAgent({ service: cfg.appview.url })
    const pdsAgent = cfg.pds
      ? new AtpAgent({ service: cfg.pds.url })
      : undefined
    const chatAgent = cfg.chat
      ? new AtpAgent({ service: cfg.chat.url })
      : undefined

    const didCache = new MemoryCache(
      cfg.identity.cacheStaleTTL,
      cfg.identity.cacheMaxTTL,
    )
    const idResolver = new IdResolver({
      plcUrl: cfg.identity.plcUrl,
      didCache,
    })

    const createAuthHeaders = (aud: string, lxm: string) =>
      createServiceAuthHeaders({
        iss: `${cfg.service.did}#atproto_labeler`,
        aud,
        lxm,
        keypair: signingKey,
      })

    const backgroundQueue = new BackgroundQueue(db)
    const blobDiverter = cfg.blobDivert
      ? new BlobDiverter(db, {
          idResolver,
          serviceConfig: cfg.blobDivert,
        })
      : undefined
    const eventPusher = new EventPusher(db, createAuthHeaders, {
      appview: cfg.appview.pushEvents ? cfg.appview : undefined,
      pds: cfg.pds ?? undefined,
    })

    const communicationTemplateService = CommunicationTemplateService.creator()
    const safelinkRuleService = SafelinkRuleService.creator()
    const scheduledActionService = ScheduledActionService.creator()
    const teamService = TeamService.creator(
      appviewAgent,
      cfg.appview.did,
      createAuthHeaders,
    )
    const setService = SetService.creator()
    const settingService = SettingService.creator()
    const strikeService = StrikeService.creator()
    const verificationService = VerificationService.creator()
    const verificationIssuer = VerificationIssuer.creator()
    const moderationServiceProfile = ModerationServiceProfile.creator(
      cfg,
      appviewAgent,
    )
    const modService = ModerationService.creator(
      signingKey,
      signingKeyId,
      cfg,
      backgroundQueue,
      idResolver,
      eventPusher,
      appviewAgent,
      createAuthHeaders,
      strikeService,
      overrides?.imgInvalidator,
    )

    const sequencer = new Sequencer(modService(db))

    const authVerifier = new AuthVerifier(idResolver, {
      serviceDid: cfg.service.did,
      adminPassword: secrets.adminPassword,
      teamService: teamService(db),
    })

    return new AppContext(
      {
        db,
        cfg,
        modService,
        moderationServiceProfile,
        communicationTemplateService,
        safelinkRuleService,
        scheduledActionService,
        teamService,
        setService,
        settingService,
        strikeService,
        appviewAgent,
        pdsAgent,
        chatAgent,
        signingKey,
        signingKeyId,
        didCache,
        idResolver,
        backgroundQueue,
        sequencer,
        authVerifier,
        blobDiverter,
        verificationService,
        verificationIssuer,
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

  get blobDiverter(): BlobDiverter | undefined {
    return this.opts.blobDiverter
  }

  get communicationTemplateService(): CommunicationTemplateServiceCreator {
    return this.opts.communicationTemplateService
  }

  get safelinkRuleService(): SafelinkRuleServiceCreator {
    return this.opts.safelinkRuleService
  }

  get scheduledActionService(): ScheduledActionServiceCreator {
    return this.opts.scheduledActionService
  }

  get teamService(): TeamServiceCreator {
    return this.opts.teamService
  }

  get setService(): SetServiceCreator {
    return this.opts.setService
  }

  get settingService(): SettingServiceCreator {
    return this.opts.settingService
  }

  get strikeService(): StrikeServiceCreator {
    return this.opts.strikeService
  }

  get verificationService(): VerificationServiceCreator {
    return this.opts.verificationService
  }

  get verificationIssuer(): VerificationIssuerCreator {
    return this.opts.verificationIssuer
  }

  get moderationServiceProfile(): ModerationServiceProfileCreator {
    return this.opts.moderationServiceProfile
  }

  get appviewAgent(): AtpAgent {
    return this.opts.appviewAgent
  }

  get pdsAgent(): AtpAgent | undefined {
    return this.opts.pdsAgent
  }

  get chatAgent(): AtpAgent | undefined {
    return this.opts.chatAgent
  }

  get signingKey(): Keypair {
    return this.opts.signingKey
  }

  get signingKeyId(): number {
    return this.opts.signingKeyId
  }

  get plcClient(): plc.Client {
    return new plc.Client(this.cfg.identity.plcUrl)
  }

  get didCache(): DidCache {
    return this.opts.didCache
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

  get authVerifier(): AuthVerifier {
    return this.opts.authVerifier
  }

  async serviceAuthHeaders(aud: string, lxm: string) {
    const iss = `${this.cfg.service.did}#atproto_labeler`
    return createServiceAuthHeaders({
      iss,
      aud,
      lxm,
      keypair: this.signingKey,
    })
  }

  async pdsAuth(lxm: string) {
    if (!this.cfg.pds) {
      return undefined
    }
    return this.serviceAuthHeaders(this.cfg.pds.did, lxm)
  }

  async appviewAuth(lxm: string) {
    return this.serviceAuthHeaders(this.cfg.appview.did, lxm)
  }

  async chatAuth(lxm: string) {
    if (!this.cfg.chat) {
      throw new Error('No chat service configured')
    }
    return this.serviceAuthHeaders(this.cfg.chat.did, lxm)
  }

  devOverride(overrides: Partial<AppContextOptions>) {
    this.opts = {
      ...this.opts,
      ...overrides,
    }
  }

  reqLabelers(req: express.Request): ParsedLabelers {
    const val = req.header(LABELER_HEADER_NAME)
    let parsed: ParsedLabelers | null
    try {
      parsed = parseLabelerHeader(val, this.cfg.service.did)
    } catch (err) {
      parsed = null
    }
    if (!parsed) return defaultLabelerHeader([])
    return parsed
  }
}
