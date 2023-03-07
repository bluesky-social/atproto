import * as plc from '@did-plc/lib'
import * as crypto from '@atproto/crypto'
import { DidResolver } from '@atproto/did-resolver'
import { Database } from './db'
import { ServerConfig } from './config'
import * as auth from './auth'
import { ServerMailer } from './mailer'
import { BlobStore } from '@atproto/repo'
import { ImageUriBuilder } from './image/uri'
import { Services } from './services'
import { MessageQueue } from './event-stream/types'
import { MessageDispatcher } from './event-stream/message-queue'
import Sequencer from './sequencer'

export class AppContext {
  constructor(
    private opts: {
      db: Database
      blobstore: BlobStore
      repoSigningKey: crypto.Keypair
      plcRotationKey: crypto.Keypair
      auth: auth.ServerAuth
      imgUriBuilder: ImageUriBuilder
      cfg: ServerConfig
      mailer: ServerMailer
      services: Services
      messageQueue: MessageQueue
      messageDispatcher: MessageDispatcher
      sequencer: Sequencer
    },
  ) {}

  get db(): Database {
    return this.opts.db
  }

  get blobstore(): BlobStore {
    return this.opts.blobstore
  }

  get repoSigningKey(): crypto.Keypair {
    return this.opts.repoSigningKey
  }

  get plcRotationKey(): crypto.Keypair {
    return this.opts.plcRotationKey
  }

  get auth(): auth.ServerAuth {
    return this.opts.auth
  }

  get accessVerifier() {
    return auth.accessVerifier(this.auth)
  }

  get accessVerifierCheckTakedown() {
    return auth.accessVerifierCheckTakedown(this.auth, this)
  }

  get refreshVerifier() {
    return auth.refreshVerifier(this.auth)
  }

  get adminVerifier() {
    return auth.adminVerifier(this.auth)
  }

  get imgUriBuilder(): ImageUriBuilder {
    return this.opts.imgUriBuilder
  }

  get cfg(): ServerConfig {
    return this.opts.cfg
  }

  get mailer(): ServerMailer {
    return this.opts.mailer
  }

  get services(): Services {
    return this.opts.services
  }

  get messageQueue(): MessageQueue {
    return this.opts.messageQueue
  }

  get messageDispatcher(): MessageDispatcher {
    return this.opts.messageDispatcher
  }

  get sequencer(): Sequencer {
    return this.opts.sequencer
  }

  get plcClient(): plc.Client {
    return new plc.Client(this.cfg.didPlcUrl)
  }

  get didResolver(): DidResolver {
    return new DidResolver({ plcUrl: this.cfg.didPlcUrl })
  }
}

export default AppContext
