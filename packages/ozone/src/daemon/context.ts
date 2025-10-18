import { AtpAgent } from '@atproto/api'
import { allFulfilled } from '@atproto/common'
import { Keypair, Secp256k1Keypair } from '@atproto/crypto'
import { IdResolver } from '@atproto/identity'
import { createServiceAuthHeaders } from '@atproto/xrpc-server'
import { BackgroundQueue } from '../background'
import { OzoneConfig, OzoneSecrets } from '../config'
import { Database } from '../db'
import { ModerationService } from '../mod-service'
import { StrikeService } from '../mod-service/strike'
import { ScheduledActionService } from '../scheduled-action/service'
import { SettingService } from '../setting/service'
import { TeamService } from '../team'
import { getSigningKeyId } from '../util'
import { EventPusher } from './event-pusher'
import { EventReverser } from './event-reverser'
import { MaterializedViewRefresher } from './materialized-view-refresher'
import { ScheduledActionProcessor } from './scheduled-action-processor'
import { StrikeExpiryProcessor } from './strike-expiry-processor'
import { TeamProfileSynchronizer } from './team-profile-synchronizer'
import { VerificationListener } from './verification-listener'

export type DaemonContextOptions = {
  db: Database
  cfg: OzoneConfig
  backgroundQueue: BackgroundQueue
  signingKey: Keypair
  eventPusher: EventPusher
  eventReverser: EventReverser
  materializedViewRefresher: MaterializedViewRefresher
  teamProfileSynchronizer: TeamProfileSynchronizer
  scheduledActionProcessor: ScheduledActionProcessor
  strikeExpiryProcessor: StrikeExpiryProcessor
  verificationListener?: VerificationListener
}

export class DaemonContext {
  constructor(private opts: DaemonContextOptions) {}

  static async fromConfig(
    cfg: OzoneConfig,
    secrets: OzoneSecrets,
    overrides?: Partial<DaemonContextOptions>,
  ): Promise<DaemonContext> {
    const db = new Database({
      url: cfg.db.postgresUrl,
      schema: cfg.db.postgresSchema,
    })
    const signingKey = await Secp256k1Keypair.import(secrets.signingKeyHex)
    const signingKeyId = await getSigningKeyId(db, signingKey.did())

    const idResolver = new IdResolver({
      plcUrl: cfg.identity.plcUrl,
    })

    const appviewAgent = new AtpAgent({ service: cfg.appview.url })
    const createAuthHeaders = (aud: string, lxm: string) =>
      createServiceAuthHeaders({
        iss: `${cfg.service.did}#atproto_labeler`,
        aud,
        lxm,
        keypair: signingKey,
      })

    const eventPusher = new EventPusher(db, createAuthHeaders, {
      appview: cfg.appview.pushEvents ? cfg.appview : undefined,
      pds: cfg.pds ?? undefined,
    })

    const backgroundQueue = new BackgroundQueue(db)

    const settingService = SettingService.creator()
    const strikeService = StrikeService.creator()
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
    )
    const scheduledActionService = ScheduledActionService.creator()
    const teamService = TeamService.creator(
      appviewAgent,
      cfg.appview.did,
      createAuthHeaders,
    )
    const teamProfileSynchronizer = new TeamProfileSynchronizer(
      backgroundQueue,
      teamService(db),
      cfg.db.teamProfileRefreshIntervalMs,
    )

    const eventReverser = new EventReverser(db, modService)

    const materializedViewRefresher = new MaterializedViewRefresher(
      backgroundQueue,
      cfg.db.materializedViewRefreshIntervalMs,
    )

    const scheduledActionProcessor = new ScheduledActionProcessor(
      db,
      cfg.service.did,
      settingService,
      modService,
      scheduledActionService,
    )

    const strikeExpiryProcessor = new StrikeExpiryProcessor(db, strikeService)

    // Only spawn the listener if verifier config exists and a jetstream URL is provided
    const verificationListener =
      cfg.verifier && cfg.jetstreamUrl
        ? new VerificationListener(
            db,
            cfg.jetstreamUrl,
            cfg.verifier?.issuersToIndex,
          )
        : undefined

    return new DaemonContext({
      db,
      cfg,
      backgroundQueue,
      signingKey,
      eventPusher,
      eventReverser,
      materializedViewRefresher,
      teamProfileSynchronizer,
      scheduledActionProcessor,
      strikeExpiryProcessor,
      verificationListener,
      ...(overrides ?? {}),
    })
  }

  get db(): Database {
    return this.opts.db
  }

  get cfg(): OzoneConfig {
    return this.opts.cfg
  }

  get backgroundQueue(): BackgroundQueue {
    return this.opts.backgroundQueue
  }

  get eventPusher(): EventPusher {
    return this.opts.eventPusher
  }

  get eventReverser(): EventReverser {
    return this.opts.eventReverser
  }

  get materializedViewRefresher(): MaterializedViewRefresher {
    return this.opts.materializedViewRefresher
  }

  get teamProfileSynchronizer(): TeamProfileSynchronizer {
    return this.opts.teamProfileSynchronizer
  }

  get scheduledActionProcessor(): ScheduledActionProcessor {
    return this.opts.scheduledActionProcessor
  }

  get strikeExpiryProcessor(): StrikeExpiryProcessor {
    return this.opts.strikeExpiryProcessor
  }

  get verificationListener(): VerificationListener | undefined {
    return this.opts.verificationListener
  }

  async start() {
    this.eventPusher.start()
    this.eventReverser.start()
    this.materializedViewRefresher.start()
    this.teamProfileSynchronizer.start()
    this.scheduledActionProcessor.start()
    this.strikeExpiryProcessor.start()
    this.verificationListener?.start()
  }

  async processAll() {
    // Sequential because the materialized view values depend on the events.
    await this.eventPusher.processAll()
    await this.materializedViewRefresher.run()
    await this.teamProfileSynchronizer.run()
  }

  async destroy() {
    try {
      await allFulfilled([
        this.eventReverser.destroy(),
        this.eventPusher.destroy(),
        this.materializedViewRefresher.destroy(),
        this.teamProfileSynchronizer.destroy(),
        this.scheduledActionProcessor.destroy(),
        this.strikeExpiryProcessor.destroy(),
        this.verificationListener?.stop(),
      ])
    } finally {
      await this.backgroundQueue.destroy()
      await this.db.close()
    }
  }
}
