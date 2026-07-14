import { AtpAgent } from '@atproto/api'
import { allFulfilled } from '@atproto/common'
import { type Keypair, Secp256k1Keypair } from '@atproto/crypto'
import { IdResolver } from '@atproto/identity'
import { createServiceAuthHeaders } from '@atproto/xrpc-server'
import { BackgroundQueue } from '../background.js'
import type { OzoneConfig, OzoneSecrets } from '../config/index.js'
import { Database } from '../db/index.js'
import { ModerationService } from '../mod-service/index.js'
import { StrikeService } from '../mod-service/strike.js'
import { QueueService } from '../queue/service.js'
import { ReportStatsService } from '../report/stats.js'
import { ScheduledActionService } from '../scheduled-action/service.js'
import { SettingService } from '../setting/service.js'
import { TeamService } from '../team/index.js'
import { getSigningKeyId } from '../util.js'
import { EventPusher } from './event-pusher.js'
import { EventReverser } from './event-reverser.js'
import { MaterializedViewRefresher } from './materialized-view-refresher.js'
import { QueueRouter } from './queue-router.js'
import { ScheduledActionProcessor } from './scheduled-action-processor.js'
import { StatsComputer } from './stats-computer.js'
import { StrikeExpiryProcessor } from './strike-expiry-processor.js'
import { TeamProfileSynchronizer } from './team-profile-synchronizer.js'
import { VerificationListener } from './verification-listener.js'

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
  queueRouter: QueueRouter
  verificationListener?: VerificationListener
  statsComputer?: StatsComputer
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

    const backgroundQueue = new BackgroundQueue(db, { concurrency: 20 })

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

    const queueService = QueueService.creator()
    const queueRouter = new QueueRouter(db, queueService)

    const reportStatsService = ReportStatsService.creator()
    const statsComputer = new StatsComputer(
      db,
      reportStatsService,
      cfg.stats.computerIntervalMinutes,
    )

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
      queueRouter,
      verificationListener,
      statsComputer,
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

  get queueRouter(): QueueRouter {
    return this.opts.queueRouter
  }

  get verificationListener(): VerificationListener | undefined {
    return this.opts.verificationListener
  }

  get statsComputer(): StatsComputer | undefined {
    return this.opts.statsComputer
  }

  async start() {
    this.eventPusher.start()
    this.eventReverser.start()
    this.materializedViewRefresher.start()
    this.teamProfileSynchronizer.start()
    this.scheduledActionProcessor.start()
    this.strikeExpiryProcessor.start()
    this.queueRouter.start()
    this.verificationListener?.start()
    this.statsComputer?.start()
  }

  async processAll() {
    // Sequential because the materialized view values depend on the events.
    await this.eventPusher.processAll()
    // Drain pending modEventReport rows into the report table so test code
    // that calls processAll() after creating reports sees the report rows
    // immediately (in production this happens via the 1-min poll).
    await this.queueRouter.routeReports()
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
        this.queueRouter.destroy(),
        this.verificationListener?.stop(),
        this.statsComputer?.destroy(),
      ])
    } finally {
      await this.backgroundQueue.destroy()
      await this.db.close()
    }
  }
}
