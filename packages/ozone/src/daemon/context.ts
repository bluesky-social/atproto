import { Keypair, Secp256k1Keypair } from '@atproto/crypto'
import { createServiceAuthHeaders } from '@atproto/xrpc-server'
import AtpAgent from '@atproto/api'
import { OzoneConfig, OzoneSecrets } from '../config'
import { Database } from '../db'
import { EventPusher } from './event-pusher'
import { EventReverser } from './event-reverser'
import { ModerationService, ModerationServiceCreator } from '../mod-service'
import { BackgroundQueue } from '../background'
import { IdResolver } from '@atproto/identity'
import { getSigningKeyId } from '../util'

export type DaemonContextOptions = {
  db: Database
  cfg: OzoneConfig
  modService: ModerationServiceCreator
  signingKey: Keypair
  eventPusher: EventPusher
  eventReverser: EventReverser
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

    const appviewAgent = new AtpAgent({ service: cfg.appview.url })
    const createAuthHeaders = (aud: string) =>
      createServiceAuthHeaders({
        iss: `${cfg.service.did}#atproto_labeler`,
        aud,
        keypair: signingKey,
      })

    const eventPusher = new EventPusher(db, createAuthHeaders, {
      appview: cfg.appview.pushEvents ? cfg.appview : undefined,
      pds: cfg.pds ?? undefined,
    })

    const backgroundQueue = new BackgroundQueue(db)
    const idResolver = new IdResolver({
      plcUrl: cfg.identity.plcUrl,
    })

    const modService = ModerationService.creator(
      signingKey,
      signingKeyId,
      cfg,
      backgroundQueue,
      idResolver,
      eventPusher,
      appviewAgent,
      createAuthHeaders,
    )

    const eventReverser = new EventReverser(db, modService)

    return new DaemonContext({
      db,
      cfg,
      modService,
      signingKey,
      eventPusher,
      eventReverser,
      ...(overrides ?? {}),
    })
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

  get eventPusher(): EventPusher {
    return this.opts.eventPusher
  }

  get eventReverser(): EventReverser {
    return this.opts.eventReverser
  }
}

export default DaemonContext
